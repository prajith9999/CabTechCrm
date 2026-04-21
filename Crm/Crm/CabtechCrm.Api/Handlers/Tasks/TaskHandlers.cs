using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using MediatR;
using Dapper;

namespace CabtechCrm.Api.Handlers.Tasks
{
    public class GetTasksQuery : IRequest<IEnumerable<TaskItem>> { }

    public class CreateTaskCommand : IRequest<int>
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime? DueDate { get; set; }
    }

    public class ToggleTaskStatusCommand : IRequest<bool>
    {
        public int Id { get; set; }
    }

    public class UpdateTaskProgressCommand : IRequest<bool>
    {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? DelayReason { get; set; }
        public DateTime? ExpectedCompletionAt { get; set; }
    }

    public class DeleteTaskCommand : IRequest<bool>
    {
        public int Id { get; set; }
    }

    public class TaskHandlers : 
        IRequestHandler<GetTasksQuery, IEnumerable<TaskItem>>,
        IRequestHandler<CreateTaskCommand, int>,
        IRequestHandler<ToggleTaskStatusCommand, bool>,
        IRequestHandler<UpdateTaskProgressCommand, bool>,
        IRequestHandler<DeleteTaskCommand, bool>
    {
        private readonly DapperContext _context;

        public TaskHandlers(DapperContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<TaskItem>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            return await connection.QueryAsync<TaskItem>("SELECT * FROM Tasks ORDER BY CreatedAt DESC");
        }

        public async Task<int> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var sql = _context.IsPostgres
                ? @"INSERT INTO Tasks (Title, Description, AssignedTo, DueDate, Status, CreatedAt, UpdatedAt)
                    VALUES (@Title, @Description, @AssignedTo, @DueDate, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING Id;"
                : @"INSERT INTO Tasks (Title, Description, AssignedTo, DueDate, Status, CreatedAt, UpdatedAt)
                    VALUES (@Title, @Description, @AssignedTo, @DueDate, 'Pending', GETDATE(), GETDATE());
                    SELECT CAST(SCOPE_IDENTITY() as int);";
            
            return _context.IsPostgres 
                ? await connection.QuerySingleAsync<int>(sql, request) 
                : await connection.QuerySingleAsync<int>(sql, request);
        }

        public async Task<bool> Handle(ToggleTaskStatusCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var now = _context.IsPostgres ? "CURRENT_TIMESTAMP" : "GETDATE()";
            var sql = $@"
                UPDATE Tasks 
                SET Status = CASE WHEN Status = 'Pending' THEN 'Completed' ELSE 'Pending' END,
                    UpdatedAt = {now}
                WHERE Id = @Id";
            
            var affected = await connection.ExecuteAsync(sql, new { request.Id });
            return affected > 0;
        }

        public async Task<bool> Handle(UpdateTaskProgressCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var now = _context.IsPostgres ? "CURRENT_TIMESTAMP" : "GETDATE()";
            var sql = $@"
                UPDATE Tasks 
                SET Status = @Status,
                    DelayReason = @DelayReason,
                    ExpectedCompletionAt = @ExpectedCompletionAt,
                    UpdatedAt = {now}
                WHERE Id = @Id";
            
            var affected = await connection.ExecuteAsync(sql, request);
            return affected > 0;
        }

        public async Task<bool> Handle(DeleteTaskCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var sql = "DELETE FROM Tasks WHERE Id = @Id";
            var affected = await connection.ExecuteAsync(sql, new { request.Id });
            return affected > 0;
        }
    }
}
