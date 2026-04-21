using Dapper;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using Newtonsoft.Json;

namespace CabtechCrm.Api.Services
{
    public interface IAuditService
    {
        Task LogAsync(string action, string entityType, string? entityId, object? oldValues = null, object? newValues = null);
    }

    public class AuditService : IAuditService
    {
        private readonly DapperContext _context;
        private readonly ICurrentUserProvider _userProvider;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditService(DapperContext context, ICurrentUserProvider userProvider, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _userProvider = userProvider;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task LogAsync(string action, string entityType, string? entityId, object? oldValues = null, object? newValues = null)
        {
            var log = new AuditLog
            {
                UserId = _userProvider.Username ?? "System",
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                OldValues = oldValues != null ? JsonConvert.SerializeObject(oldValues) : null,
                NewValues = newValues != null ? JsonConvert.SerializeObject(newValues) : null,
                IpAddress = _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString(),
                Timestamp = DateTime.UtcNow
            };

            var query = @"
                INSERT INTO AuditLogs (UserId, Action, EntityType, EntityId, OldValues, NewValues, IpAddress, Timestamp)
                VALUES (@UserId, @Action, @EntityType, @EntityId, @OldValues, @NewValues, @IpAddress, @Timestamp)";

            using var connection = _context.CreateConnection();
            await connection.ExecuteAsync(query, log);
        }
    }
}
