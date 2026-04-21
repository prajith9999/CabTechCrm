using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Controllers
{
    public class UserListRow
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string? Roles { get; set; }
    }

    public class CreateUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "User";
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "SuperAdmin,DevAdmin")]
    public class UsersController : ControllerBase
    {
        private readonly DapperContext _context;
        private readonly ILogger<UsersController> _logger;

        public UsersController(DapperContext context, ILogger<UsersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserListRow>>> GetUsers()
        {
            using var connection = _context.CreateConnection();
            var sql = @"
                SELECT u.Id, u.Username, u.IsActive,
                    STUFF((
                        SELECT ', ' + r.Name
                        FROM UserRoles ur2
                        INNER JOIN Roles r ON ur2.RoleId = r.Id
                        WHERE ur2.UserId = u.Id
                        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Roles
                FROM Users u
                ORDER BY u.Username";
            var rows = await connection.QueryAsync<UserListRow>(sql);
            return Ok(rows);
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var username = (request.Username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { Message = "Username and password are required." });

            var roleName = (request.Role ?? "User").Trim();
            using var connection = _context.CreateConnection();

            var roleId = await connection.QuerySingleOrDefaultAsync<int?>(
                "SELECT Id FROM Roles WHERE Name = @Name", new { Name = roleName });
            if (roleId == null)
                return BadRequest(new { Message = $"Role '{roleName}' does not exist." });

            var exists = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM Users WHERE Username = @Username", new { Username = username });
            if (exists > 0)
                return Conflict(new { Message = "Username already exists." });

            var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            var userId = await connection.QuerySingleAsync<int>(@"
                INSERT INTO Users (Username, PasswordHash, CreatedAt, IsActive)
                OUTPUT INSERTED.Id
                VALUES (@Username, @PasswordHash, GETUTCDATE(), 1)",
                new { Username = username, PasswordHash = hash });

            await connection.ExecuteAsync(@"
                INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId)",
                new { UserId = userId, RoleId = roleId.Value });

            _logger.LogInformation("User {Username} created with role {Role}", username, roleName);
            return StatusCode(201, new { Id = userId, Username = username, Role = roleName });
        }
    }
}
