using MediatR;
using Dapper;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using CabtechCrm.Api.Services;
using BCrypt.Net;

namespace CabtechCrm.Api.Handlers.Auth
{
    public record LoginCommand(string Username, string Password) : IRequest<LoginResponse>;

    public record LoginResponse(bool Success, string? Token = null, string? Message = null, string? Role = null, string? Username = null);

    public class LoginHandler : IRequestHandler<LoginCommand, LoginResponse>
    {
        private readonly DapperContext _context;
        private readonly IJwtService _jwtService;
        private readonly IAuditService _auditService;
        private readonly ILogger<LoginHandler> _logger;

        /// <summary>Picks a stable primary role for the client when a user has several (SQL join order is not guaranteed).</summary>
        private static string ResolvePrimaryRole(IList<Role> roles)
        {
            if (roles == null || roles.Count == 0)
                return "User";

            static bool Has(IList<Role> list, string name) =>
                list.Any(r => r.Name != null && r.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

            if (Has(roles, "SuperAdmin"))
                return roles.First(r => r.Name!.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase)).Name!;
            if (Has(roles, "DevAdmin"))
                return roles.First(r => r.Name!.Equals("DevAdmin", StringComparison.OrdinalIgnoreCase)).Name!;
            if (Has(roles, "Admin"))
                return roles.First(r => r.Name!.Equals("Admin", StringComparison.OrdinalIgnoreCase)).Name!;
            if (Has(roles, "User"))
                return roles.First(r => r.Name!.Equals("User", StringComparison.OrdinalIgnoreCase)).Name!;

            return roles[0].Name ?? "User";
        }

        public LoginHandler(DapperContext context, IJwtService jwtService, IAuditService auditService, ILogger<LoginHandler> logger)
        {
            _context = context;
            _jwtService = jwtService;
            _auditService = auditService;
            _logger = logger;
        }

        public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();

            // 1. Fetch user with Roles and Permissions
            var userSql = @"
                SELECT u.*, r.*, p.*
                FROM Users u
                LEFT JOIN UserRoles ur ON u.Id = ur.UserId
                LEFT JOIN Roles r ON ur.RoleId = r.Id
                LEFT JOIN RolePermissions rp ON r.Id = rp.RoleId
                LEFT JOIN Permissions p ON rp.PermissionId = p.Id
                WHERE LOWER(u.Username) = LOWER(@Username) AND u.IsActive = @IsActive";

            var userDictionary = new Dictionary<int, User>();

            var users = await connection.QueryAsync<User, Role, Permission, User>(
                userSql,
                (u, r, p) =>
                {
                    if (!userDictionary.TryGetValue(u.Id, out var userEntry))
                    {
                        userEntry = u;
                        userEntry.Roles = new List<Role>();
                        userDictionary.Add(u.Id, userEntry);
                    }

                    if (r != null)
                    {
                        var roleEntry = userEntry.Roles.FirstOrDefault(x => x.Id == r.Id);
                        if (roleEntry == null)
                        {
                            roleEntry = r;
                            roleEntry.Permissions = new List<Permission>();
                            userEntry.Roles.Add(roleEntry);
                        }

                        if (p != null && !roleEntry.Permissions.Any(x => x.Id == p.Id))
                        {
                            roleEntry.Permissions.Add(p);
                        }
                    }

                    return userEntry;
                },
                new { Username = request.Username, IsActive = true },
                splitOn: "Id,Id"
            );

            var user = userDictionary.Values.FirstOrDefault();

            if (user == null)
                return new LoginResponse(false, Message: "Invalid credentials");

            // 2. Check Lockout
            if (user.IsLockedOut && user.LockedOutUntil > DateTime.UtcNow)
            {
                var remaining = user.LockedOutUntil.Value - DateTime.UtcNow;
                return new LoginResponse(false, Message: $"Account locked. Try again in {remaining.Minutes}m {remaining.Seconds}s.");
            }

            // 3. Verify Password
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                var attempts = user.FailedLoginAttempts + 1;
                var isLocking = attempts >= 5;
                var lockedUntil = isLocking ? DateTime.UtcNow.AddMinutes(15) : (DateTime?)null;

                await connection.ExecuteAsync(@"
                    UPDATE Users 
                    SET FailedLoginAttempts = @Attempts, 
                        IsLockedOut = @IsLockedOut, 
                        LockedOutUntil = @LockedUntil 
                    WHERE Id = @Id", 
                    new { Attempts = attempts, IsLockedOut = isLocking, LockedUntil = lockedUntil, Id = user.Id });

                await _auditService.LogAsync("LoginFailed", "User", user.Id.ToString(), null, new { Attempts = attempts, Locked = isLocking });

                return new LoginResponse(false, Message: isLocking ? "Too many failed attempts. Account locked for 15 minutes." : "Invalid credentials");
            }

            // 4. Success - Reset attempts and generate token
            await connection.ExecuteAsync(@"
                UPDATE Users 
                SET FailedLoginAttempts = 0, 
                    IsLockedOut = @IsLockedOut, 
                    LockedOutUntil = NULL, 
                    LastLoginAt = @Now 
                WHERE Id = @Id", 
                new { Now = DateTime.UtcNow, Id = user.Id, IsLockedOut = false });

            var token = _jwtService.GenerateToken(user);
            var primaryRole = ResolvePrimaryRole(user.Roles);

            await _auditService.LogAsync("LoginSuccess", "User", user.Id.ToString());

            return new LoginResponse(true, Token: token, Role: primaryRole, Username: user.Username);
        }
    }
}
