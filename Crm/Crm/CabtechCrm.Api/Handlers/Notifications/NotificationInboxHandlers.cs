using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using Dapper;
using MediatR;

namespace CabtechCrm.Api.Handlers.Notifications
{
    public class GetNotificationsInboxQuery : IRequest<IEnumerable<Notification>> { }

    public class GetNotificationsInboxHandler : IRequestHandler<GetNotificationsInboxQuery, IEnumerable<Notification>>
    {
        private readonly DapperContext _context;

        public GetNotificationsInboxHandler(DapperContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Notification>> Handle(GetNotificationsInboxQuery request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var sql = _context.IsPostgres
                ? @"SELECT id AS Id, userid AS UserId, type AS Type, message AS Message, isread AS IsRead, entityid AS EntityId, createdat AS CreatedAt
                    FROM notifications
                    ORDER BY createdat DESC
                    LIMIT 50"
                : @"SELECT TOP 50 Id, UserId, Type, Message, IsRead, EntityId, CreatedAt
                    FROM Notifications
                    ORDER BY CreatedAt DESC";
            return await connection.QueryAsync<Notification>(sql);
        }
    }

    public class MarkNotificationReadCommand : IRequest<bool>
    {
        public int Id { get; set; }
    }

    public class MarkNotificationReadHandler : IRequestHandler<MarkNotificationReadCommand, bool>
    {
        private readonly DapperContext _context;

        public MarkNotificationReadHandler(DapperContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var sql = _context.IsPostgres
                ? "UPDATE notifications SET isread = true WHERE id = @Id"
                : "UPDATE Notifications SET IsRead = 1 WHERE Id = @Id";
            var n = await connection.ExecuteAsync(sql, new { request.Id });
            return n > 0;
        }
    }
}
