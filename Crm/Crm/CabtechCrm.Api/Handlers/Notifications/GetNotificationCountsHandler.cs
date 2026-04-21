using CabtechCrm.Api.Repositories;
using MediatR;
using Dapper;

namespace CabtechCrm.Api.Handlers.Notifications
{
    public class GetNotificationCountsQuery : IRequest<NotificationCountsResponse> { }

    public class NotificationCountsResponse
    {
        public int TotalEmails { get; set; }
        public int UnreadEmails { get; set; }
        public int PendingTasks { get; set; }
        public int NewShopifyOrders { get; set; }
        public int TotalShopifyOrders { get; set; }
    }

    public class GetNotificationCountsHandler : IRequestHandler<GetNotificationCountsQuery, NotificationCountsResponse>
    {
        private readonly DapperContext _context;

        public GetNotificationCountsHandler(DapperContext context)
        {
            _context = context;
        }

        public async Task<NotificationCountsResponse> Handle(GetNotificationCountsQuery request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();

            var sql = _context.IsPostgres
                ? @"
                SELECT 
                    (SELECT COUNT(*) FROM emails) as TotalEmails,
                    (SELECT COUNT(*) FROM emails WHERE isread = false) as UnreadEmails,
                    (SELECT COUNT(*) FROM tasks WHERE status = 'Pending') as PendingTasks,
                    (SELECT COUNT(*) FROM shopifyorders WHERE createdat > (CURRENT_TIMESTAMP - INTERVAL '1 day')) as NewShopifyOrders,
                    (SELECT COUNT(*) FROM shopifyorders) as TotalShopifyOrders
            "
                : @"
                SELECT 
                    (SELECT COUNT(*) FROM Emails) as TotalEmails,
                    (SELECT COUNT(*) FROM Emails WHERE IsRead = 0) as UnreadEmails,
                    (SELECT COUNT(*) FROM Tasks WHERE Status = 'Pending') as PendingTasks,
                    (SELECT COUNT(*) FROM ShopifyOrders WHERE CreatedAt > DATEADD(day, -1, GETDATE())) as NewShopifyOrders,
                    (SELECT COUNT(*) FROM ShopifyOrders) as TotalShopifyOrders
            ";

            var counts = await connection.QuerySingleAsync<NotificationCountsResponse>(sql);
            return counts;
        }
    }
}
