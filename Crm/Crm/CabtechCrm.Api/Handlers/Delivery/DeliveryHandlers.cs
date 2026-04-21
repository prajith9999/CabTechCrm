using MediatR;
using Dapper;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Handlers.Delivery
{
    // Queries
    public record GetDeliveriesQuery : IRequest<List<DeliveryRecord>>;

    // Commands
    public record CreateDeliveryCommand(string Title, string Description, string AssignedTo, string UpdatedBy) : IRequest<int>;
    public record UpdateDeliveryStageCommand(int Id, int StageId, string UpdatedBy) : IRequest<bool>;
    public record DeleteDeliveryCommand(int Id) : IRequest<bool>;

    public class DeliveryHandlers : 
        IRequestHandler<GetDeliveriesQuery, List<DeliveryRecord>>,
        IRequestHandler<CreateDeliveryCommand, int>,
        IRequestHandler<UpdateDeliveryStageCommand, bool>,
        IRequestHandler<DeleteDeliveryCommand, bool>
    {
        private readonly DapperContext _context;

        public DeliveryHandlers(DapperContext context)
        {
            _context = context;
        }

        private string EnsureDeliverySchemaSql => _context.IsPostgres ? @"
CREATE TABLE IF NOT EXISTS DeliveryRecords (
    Id SERIAL PRIMARY KEY,
    Title VARCHAR(255) NOT NULL,
    Description TEXT NOT NULL,
    AssignedTo VARCHAR(120) NOT NULL,
    CurrentStage INT NOT NULL DEFAULT 1,
    UpdatedBy VARCHAR(120),
    CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);" : @"
IF OBJECT_ID('dbo.DeliveryRecords', 'U') IS NULL
BEGIN
    CREATE TABLE DeliveryRecords (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        AssignedTo NVARCHAR(120) NOT NULL,
        CurrentStage INT NOT NULL DEFAULT 1,
        UpdatedBy NVARCHAR(120) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;";

        private async Task EnsureSchemaAsync()
        {
            using var connection = _context.CreateConnection();
            await connection.ExecuteAsync(EnsureDeliverySchemaSql);
        }

        public async Task<List<DeliveryRecord>> Handle(GetDeliveriesQuery request, CancellationToken cancellationToken)
        {
            await EnsureSchemaAsync();
            using var connection = _context.CreateConnection();
            var sql = "SELECT * FROM DeliveryRecords ORDER BY UpdatedAt DESC";
            var result = await connection.QueryAsync<DeliveryRecord>(sql);
            return result.ToList();
        }

        public async Task<int> Handle(CreateDeliveryCommand request, CancellationToken cancellationToken)
        {
            await EnsureSchemaAsync();
            using var connection = _context.CreateConnection();
            var pgSql = @"
                INSERT INTO DeliveryRecords (Title, Description, AssignedTo, CurrentStage, UpdatedBy)
                VALUES (@Title, @Description, @AssignedTo, 1, @UpdatedBy)
                RETURNING Id;";
            var msSql = @"
                INSERT INTO DeliveryRecords (Title, Description, AssignedTo, CurrentStage, UpdatedBy)
                OUTPUT INSERTED.Id
                VALUES (@Title, @Description, @AssignedTo, 1, @UpdatedBy);";

            var sql = _context.IsPostgres ? pgSql : msSql;
            
            return await connection.QuerySingleAsync<int>(sql, new { request.Title, request.Description, request.AssignedTo, request.UpdatedBy });
        }

        public async Task<bool> Handle(UpdateDeliveryStageCommand request, CancellationToken cancellationToken)
        {
            await EnsureSchemaAsync();
            using var connection = _context.CreateConnection();
            var sql = _context.IsPostgres 
                ? "UPDATE DeliveryRecords SET CurrentStage = @StageId, UpdatedBy = @UpdatedBy, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = @Id"
                : "UPDATE DeliveryRecords SET CurrentStage = @StageId, UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE() WHERE Id = @Id";
            
            var rows = await connection.ExecuteAsync(sql, new { request.Id, request.StageId, request.UpdatedBy });
            return rows > 0;
        }

        public async Task<bool> Handle(DeleteDeliveryCommand request, CancellationToken cancellationToken)
        {
            await EnsureSchemaAsync();
            using var connection = _context.CreateConnection();
            var rows = await connection.ExecuteAsync("DELETE FROM DeliveryRecords WHERE Id = @Id", new { request.Id });
            return rows > 0;
        }
    }
}
