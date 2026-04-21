using System.Data;
using Npgsql;
using Microsoft.Data.SqlClient;
using Dapper;
using CabtechCrm.Api.Models;
using System.Linq;

namespace CabtechCrm.Api.Repositories
{
    public class DapperContext
    {
        private readonly IConfiguration _configuration;
        private readonly string _connectionString;
        public bool IsPostgres { get; }

        public DapperContext(IConfiguration configuration)
        {
            _configuration = configuration;
            _connectionString = _configuration.GetConnectionString("DefaultConnection") ?? "";
            
            // Check for explicit provider setting OR connection string format
            var provider = _configuration["DB_PROVIDER"];
            IsPostgres = (provider != null && provider.Equals("postgres", StringComparison.OrdinalIgnoreCase)) ||
                         _connectionString.StartsWith("postgres://") || 
                         _connectionString.StartsWith("postgresql://") ||
                         _connectionString.Contains("Host=") || 
                         _connectionString.Contains("SSL Mode=");

            // Render/Database-as-a-Service often provide a URI like postgres://user:pass@host:port/db
            // Npgsql doesn't natively support this format in the constructor, so we parse it.
            if (IsPostgres && (_connectionString.StartsWith("postgres://") || _connectionString.StartsWith("postgresql://")))
            {
                var uri = new Uri(_connectionString);
                var database = uri.AbsolutePath.TrimStart('/');
                var userInfo = uri.UserInfo.Split(':');
                var username = userInfo[0];
                var password = userInfo.Length > 1 ? userInfo[1] : "";
                
                // Npgsql rejects -1 as a port. Default to 5432 if no port is specified in URI.
                var port = uri.Port <= 0 ? 5432 : uri.Port;
                
                // Construct standard Npgsql connection string with SSL requirements for Render
                _connectionString = $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
            }
        }

        public IDbConnection CreateConnection()
            => IsPostgres 
                ? new NpgsqlConnection(_connectionString) 
                : new SqlConnection(_connectionString);
    }

    public interface IEnquiryRepository
    {
        Task<IEnumerable<Enquiry>> GetAllEnquiriesAsync();
        Task<Enquiry?> GetEnquiryByIdAsync(int id);
        Task<int> CreateEnquiryAsync(Enquiry enquiry, Contact contact);
        Task<int> CreateContactAsync(Contact contact);
        /// <summary>Creates a stage-1 enquiry linked to an existing contact (e.g. customer-details form).</summary>
        Task<int> CreateEnquiryForExistingContactAsync(int contactId, Enquiry enquiry);
        Task UpdateEnquiryStageAsync(int enquiryId, int stageId, string comments, string updatedBy);
        Task<IEnumerable<Contact>> GetContactsAsync(string? searchTerm);
        Task DeleteEnquiryAsync(int id);
        Task UpdateEnquiryDetailsAsync(int id, string title, string description, decimal? distanceKm);
        Task<EnquiryWorkflow?> GetWorkflowAsync(int enquiryId);
        Task UpsertQuestionAsync(int enquiryId, string questionText, string updatedBy);
        Task UpdateReplyReceivedAsync(int enquiryId, bool replyReceived, string updatedBy);
        Task FinalizeAcceptWorkflowAsync(int enquiryId, bool acceptResponse, string updatedBy);
        Task RejectWithReviewAsync(int enquiryId, string comment, string updatedBy, string? reason = null, bool? futureHope = null);
        Task<SystemSetting?> GetSettingAsync(string keyName);
        Task UpsertSettingAsync(string keyName, string keyValue);
        Task<IEnumerable<SystemSetting>> GetAllSettingsAsync();
        Task<int> CreateEmailEnquiryAsync(Enquiry enquiry, Contact contact, List<EmailAttachment> attachments);
        Task<int> CreateShopifyEnquiryAsync(Enquiry enquiry, Contact contact, ShopifyOrder shopifyOrder);
        Task<EmailAttachment?> GetAttachmentAsync(int id);
        Task<IEnumerable<EmailAttachment>> GetAttachmentsForEnquiryAsync(int enquiryId);
        Task<IEnumerable<ShopifyOrder>> GetAllShopifyOrdersAsync();
        Task<int> LogEmailAsync(EmailLog emailLog);
        // Audit Logs
        Task WriteAuditLogAsync(AuditLog log);
        Task<IEnumerable<AuditLog>> GetAuditLogsAsync(int limit = 200);
        // Help Desk
        Task<int> CreateHelpDeskTicketAsync(HelpDeskTicket ticket);
        Task<IEnumerable<HelpDeskTicket>> GetHelpDeskTicketsAsync();
        Task<IEnumerable<HelpDeskTicket>> GetHelpDeskTicketsByAdminAsync(string adminName);
        Task<HelpDeskTicket?> GetHelpDeskTicketByIdAsync(int id);
        Task AddHelpDeskReplyAsync(int ticketId, string senderRole, string senderName, string message);
        Task UpdateHelpDeskTicketStatusAsync(int id, string status);
        Task MarkHelpDeskTicketReadAsync(int id, string role);
        Task ReplyHelpDeskTicketAsync(int id, string replyText, string repliedBy);
        // Unified Email Tracking
        Task AddEmailRecordAsync(Email email);
    }

    public class EnquiryRepository : IEnquiryRepository
    {
        private readonly DapperContext _context;

        private string Sql(string postgres, string mssql) => _context.IsPostgres ? postgres : mssql;

        private string EnsureWorkflowSchemaSql => Sql(@"
CREATE TABLE IF NOT EXISTS Contacts (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    PhoneNumber VARCHAR(50),
    Company VARCHAR(255),
    Email VARCHAR(255),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Enquiries (
    Id SERIAL PRIMARY KEY,
    ContactId INT NOT NULL REFERENCES Contacts(Id),
    ReferenceNumber VARCHAR(100) UNIQUE NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Description TEXT,
    DistanceKm DECIMAL(18,2),
    CurrentStage INT NOT NULL DEFAULT 1,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS EnquiryStages (
    Id SERIAL PRIMARY KEY,
    EnquiryId INT NOT NULL REFERENCES Enquiries(Id),
    StageId INT NOT NULL,
    StatusComments TEXT,
    UpdatedBy VARCHAR(100),
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'enquiries' AND column_name = 'source') THEN
        ALTER TABLE enquiries ADD COLUMN source VARCHAR(50) DEFAULT 'Manual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'enquiries' AND column_name = 'sourceid') THEN
        ALTER TABLE enquiries ADD COLUMN sourceid VARCHAR(500);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enquiryworkflows' AND column_name='rejectionreason') THEN
        ALTER TABLE EnquiryWorkflows ADD COLUMN RejectionReason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enquiryworkflows' AND column_name='futurehope') THEN
        ALTER TABLE EnquiryWorkflows ADD COLUMN FutureHope BOOLEAN;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS EmailLogs (
    Id SERIAL PRIMARY KEY,
    EnquiryId INT NOT NULL REFERENCES Enquiries(Id),
    RecipientEmail VARCHAR(255) NOT NULL,
    Subject VARCHAR(255) NOT NULL,
    Body TEXT NOT NULL,
    IsSuccess BOOLEAN NOT NULL,
    ErrorMessage TEXT,
    SentAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
", @"
IF OBJECT_ID('dbo.Contacts', 'U') IS NULL
BEGIN
    CREATE TABLE Contacts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(255) NOT NULL,
        PhoneNumber NVARCHAR(50) NULL,
        Company NVARCHAR(255) NULL,
        Email NVARCHAR(255) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;

IF OBJECT_ID('dbo.Enquiries', 'U') IS NULL
BEGIN
    CREATE TABLE Enquiries (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ContactId INT NOT NULL FOREIGN KEY REFERENCES Contacts(Id),
        ReferenceNumber NVARCHAR(100) UNIQUE NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        DistanceKm DECIMAL(18,2) NULL,
        CurrentStage INT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;

IF OBJECT_ID('dbo.EnquiryStages', 'U') IS NULL
BEGIN
    CREATE TABLE EnquiryStages (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT NOT NULL FOREIGN KEY REFERENCES Enquiries(Id),
        StageId INT NOT NULL,
        StatusComments NVARCHAR(MAX) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Enquiries') AND name = 'Source')
BEGIN
    ALTER TABLE dbo.Enquiries ADD Source NVARCHAR(50) NULL;
    UPDATE dbo.Enquiries SET Source = N'Manual' WHERE Source IS NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Enquiries') AND name = 'SourceId')
BEGIN
    ALTER TABLE dbo.Enquiries ADD SourceId NVARCHAR(450) NULL;
END;

IF OBJECT_ID('dbo.EnquiryWorkflows', 'U') IS NULL
BEGIN
    CREATE TABLE EnquiryWorkflows (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT UNIQUE NOT NULL FOREIGN KEY REFERENCES Enquiries(Id),
        QuestionSent BIT NOT NULL DEFAULT 0,
        QuestionText NVARCHAR(MAX) NULL,
        QuestionSentAt DATETIME NULL,
        ReplyReceived BIT NULL,
        ReplyTrackedAt DATETIME NULL,
        AcceptResponse BIT NULL,
        RejectedAt DATETIME NULL,
        RejectionReason NVARCHAR(MAX) NULL,
        FutureHope BIT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.EnquiryWorkflows') AND name = 'RejectionReason')
BEGIN
    ALTER TABLE EnquiryWorkflows ADD RejectionReason NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.EnquiryWorkflows') AND name = 'FutureHope')
BEGIN
    ALTER TABLE EnquiryWorkflows ADD FutureHope BIT NULL;
END;

IF OBJECT_ID('dbo.EmailLogs', 'U') IS NULL
BEGIN
    CREATE TABLE EmailLogs (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT NOT NULL FOREIGN KEY REFERENCES Enquiries(Id),
        RecipientEmail NVARCHAR(255) NOT NULL,
        Subject NVARCHAR(255) NOT NULL,
        Body NVARCHAR(MAX) NOT NULL,
        IsSuccess BIT NOT NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        SentAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;
");

        private string EnsureHelpDeskSchemaSql => Sql(@"
CREATE TABLE IF NOT EXISTS HelpDeskTickets (
    Id SERIAL PRIMARY KEY,
    AdminName VARCHAR(120) NOT NULL,
    Subject VARCHAR(255) NOT NULL,
    Description TEXT NOT NULL,
    Status VARCHAR(40) NOT NULL DEFAULT 'Open',
    AssignedTo VARCHAR(120) NOT NULL DEFAULT 'DevAdmin',
    ReplyText TEXT,
    RepliedBy VARCHAR(120),
    RepliedAt TIMESTAMP,
    CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastReplyAt TIMESTAMP,
    HasUnreadForAdmin BOOLEAN NOT NULL DEFAULT FALSE,
    HasUnreadForDevAdmin BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS HelpDeskReplies (
    Id SERIAL PRIMARY KEY,
    TicketId INT NOT NULL REFERENCES HelpDeskTickets(Id) ON DELETE CASCADE,
    SenderRole VARCHAR(40) NOT NULL,
    SenderName VARCHAR(120) NOT NULL,
    Message TEXT NOT NULL,
    CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
", @"
IF OBJECT_ID('dbo.HelpDeskTickets', 'U') IS NULL
BEGIN
    CREATE TABLE HelpDeskTickets (
        Id INT PRIMARY KEY IDENTITY(1,1),
        AdminName NVARCHAR(120) NOT NULL DEFAULT '',
        Subject NVARCHAR(255) NOT NULL DEFAULT '',
        Description NVARCHAR(MAX) NOT NULL DEFAULT '',
        Status NVARCHAR(40) NOT NULL DEFAULT 'Open',
        AssignedTo NVARCHAR(120) NOT NULL DEFAULT 'DevAdmin',
        ReplyText NVARCHAR(MAX) NULL,
        RepliedBy NVARCHAR(120) NULL,
        RepliedAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        LastReplyAt DATETIME NULL,
        HasUnreadForAdmin BIT NOT NULL DEFAULT 0,
        HasUnreadForDevAdmin BIT NOT NULL DEFAULT 1
    );
END;

IF OBJECT_ID('dbo.HelpDeskReplies', 'U') IS NULL
BEGIN
    CREATE TABLE HelpDeskReplies (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TicketId INT NOT NULL REFERENCES HelpDeskTickets(Id) ON DELETE CASCADE,
        SenderRole NVARCHAR(40) NOT NULL DEFAULT '',
        SenderName NVARCHAR(120) NOT NULL DEFAULT '',
        Message NVARCHAR(MAX) NOT NULL DEFAULT '',
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END;
");

        public EnquiryRepository(DapperContext context)
        {
            _context = context;
        }

        private async Task EnsureWorkflowSchemaAsync(IDbConnection connection)
        {
            await connection.ExecuteAsync(EnsureWorkflowSchemaSql);
        }

        private async Task EnsureHelpDeskSchemaAsync(IDbConnection connection)
        {
            try
            {
                await connection.ExecuteAsync(EnsureHelpDeskSchemaSql);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to ensure HelpDesk schema: {ex.Message}", ex);
            }
        }

        public async Task<IEnumerable<Enquiry>> GetAllEnquiriesAsync()
        {
            var query = @"
                SELECT e.*, c.* 
                FROM Enquiries e
                JOIN Contacts c ON e.ContactId = c.Id
                ORDER BY e.UpdatedAt DESC";

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                
                var enquiries = (await connection.QueryAsync<Enquiry, Contact, Enquiry>(
                    query,
                    (enquiry, contact) =>
                    {
                        enquiry.Contact = contact;
                        return enquiry;
                    },
                    splitOn: "Id"
                )).ToList();

                try
                {
                    var workflows = (await connection.QueryAsync<EnquiryWorkflow>("SELECT * FROM EnquiryWorkflows")).ToList();
                    var workflowLookup = workflows.ToDictionary(w => w.EnquiryId, w => w);
                    
                    var shopifyOrders = (await connection.QueryAsync<ShopifyOrder>("SELECT * FROM ShopifyOrders")).ToList();
                    var shopifyLookup = shopifyOrders.ToDictionary(s => s.EnquiryId, s => s);

                    var attachments = (await connection.QueryAsync<EmailAttachment>("SELECT Id, EnquiryId, FileName, ContentType, UploadedAt FROM EmailAttachments")).ToList();
                    var attachmentsLookup = attachments.GroupBy(a => a.EnquiryId).ToDictionary(g => g.Key, g => g.ToList());

                    foreach (var enquiry in enquiries)
                    {
                        if (workflowLookup.TryGetValue(enquiry.Id, out var workflow))
                            enquiry.Workflow = workflow;
                        if (shopifyLookup.TryGetValue(enquiry.Id, out var shopify))
                            enquiry.ShopifyOrder = shopify;
                        if (attachmentsLookup.TryGetValue(enquiry.Id, out var atts))
                            enquiry.Attachments = atts;
                    }
                }
                catch (Exception)
                {
                    // Ignore missing tables during transition
                }

                return enquiries;
            }
        }

        public async Task<Enquiry?> GetEnquiryByIdAsync(int id)
        {
            var query = @"
                SELECT e.*, c.*
                FROM Enquiries e
                JOIN Contacts c ON e.ContactId = c.Id
                WHERE e.Id = @Id";
            using (var connection = _context.CreateConnection())
            {
                var enquiry = (await connection.QueryAsync<Enquiry, Contact, Enquiry>(
                    query,
                    (e, c) =>
                    {
                        e.Contact = c;
                        return e;
                    },
                    new { Id = id },
                    splitOn: "Id")).FirstOrDefault();

                if (enquiry == null)
                {
                    return null;
                }

                try
                {
                    enquiry.Workflow = await connection.QueryFirstOrDefaultAsync<EnquiryWorkflow>(
                        Sql("SELECT * FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId LIMIT 1",
                            "SELECT TOP 1 * FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId"),
                        new { EnquiryId = id });
                }
                catch (Exception)
                {
                    enquiry.Workflow = null;
                }

                return enquiry;
            }
        }

        public async Task<int> CreateEnquiryAsync(Enquiry enquiry, Contact contact)
        {
            using (var connection = _context.CreateConnection())
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        // 1. Insert Contact if it doesn't exist or just insert new
                        var contactId = await connection.QuerySingleAsync<int>(
                            Sql("INSERT INTO Contacts (Name, PhoneNumber, Company, Email) VALUES (@Name, @PhoneNumber, @Company, @Email) RETURNING Id",
                                "INSERT INTO Contacts (Name, PhoneNumber, Company, Email) OUTPUT INSERTED.Id VALUES (@Name, @PhoneNumber, @Company, @Email)"),
                            contact, transaction);

                        enquiry.ContactId = contactId;
                        enquiry.ReferenceNumber = $"CAB-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}";

                        // 2. Insert Enquiry
                        var enquiryId = await connection.QuerySingleAsync<int>(
                                Sql(@"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage)
                                        VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage)
                                        RETURNING Id",
                                    @"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage)
                                        OUTPUT INSERTED.Id
                                        VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage)"),
                                enquiry, transaction);

                        // 3. Insert Initial Stage History
                        await connection.ExecuteAsync(
                            "INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy)",
                            new { EnquiryId = enquiryId, StageId = 1, Comments = "Initial Entry", UpdatedBy = "System" }, transaction);

                        transaction.Commit();
                        return enquiryId;
                    }
                    catch
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
        }

        public async Task<int> CreateContactAsync(Contact contact)
        {
            var query = Sql("INSERT INTO Contacts (Name, PhoneNumber, Company, Email) VALUES (@Name, @PhoneNumber, @Company, @Email) RETURNING Id",
                            "INSERT INTO Contacts (Name, PhoneNumber, Company, Email) OUTPUT INSERTED.Id VALUES (@Name, @PhoneNumber, @Company, @Email)");
            using (var connection = _context.CreateConnection())
            {
                return await connection.QuerySingleAsync<int>(query, contact);
            }
        }

        public async Task<int> CreateEnquiryForExistingContactAsync(int contactId, Enquiry enquiry)
        {
            using (var connection = _context.CreateConnection())
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        enquiry.ContactId = contactId;
                        enquiry.ReferenceNumber = $"CAB-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}";
                        if (string.IsNullOrWhiteSpace(enquiry.Title))
                            enquiry.Title = "New enquiry";

                        var enquiryId = await connection.QuerySingleAsync<int>(
                            Sql(@"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage)
                                    VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage)
                                    RETURNING Id",
                                @"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage)
                                    OUTPUT INSERTED.Id
                                    VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage)"),
                            enquiry, transaction);

                        await connection.ExecuteAsync(
                            "INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy)",
                            new { EnquiryId = enquiryId, StageId = 1, Comments = "Customer details entry", UpdatedBy = "System" }, transaction);

                        transaction.Commit();
                        return enquiryId;
                    }
                    catch
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
        }

        public async Task UpdateEnquiryStageAsync(int enquiryId, int stageId, string comments, string updatedBy)
        {
            var query = Sql(@"
                UPDATE Enquiries SET CurrentStage = @StageId, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = @EnquiryId;
                INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy);",
                @"
                UPDATE Enquiries SET CurrentStage = @StageId, UpdatedAt = GETDATE() WHERE Id = @EnquiryId;
                INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy);");

            using (var connection = _context.CreateConnection())
            {
                await connection.ExecuteAsync(query, new { EnquiryId = enquiryId, StageId = stageId, Comments = comments, UpdatedBy = updatedBy });
            }
        }

        public async Task<IEnumerable<Contact>> GetContactsAsync(string? searchTerm)
        {
            var query = "SELECT * FROM Contacts";
            if (!string.IsNullOrEmpty(searchTerm))
            {
                query += " WHERE Name LIKE @Search OR PhoneNumber LIKE @Search OR Company LIKE @Search OR Email LIKE @Search";
            }
            
            using (var connection = _context.CreateConnection())
            {
                return await connection.QueryAsync<Contact>(query, new { Search = $"%{searchTerm}%" });
            }
        }
        public async Task DeleteEnquiryAsync(int id)
        {
            using (var connection = _context.CreateConnection())
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        // 1. Delete stage history first
                        await connection.ExecuteAsync("DELETE FROM EnquiryStages WHERE EnquiryId = @Id", new { Id = id }, transaction);
                        // 2. Delete enquiry
                        await connection.ExecuteAsync("DELETE FROM Enquiries WHERE Id = @Id", new { Id = id }, transaction);
                        
                        transaction.Commit();
                    }
                    catch
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
        }

        public async Task UpdateEnquiryDetailsAsync(int id, string title, string description, decimal? distanceKm)
        {
            var query = Sql("UPDATE Enquiries SET Title = @Title, Description = @Description, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = @Id",
                            "UPDATE Enquiries SET Title = @Title, Description = @Description, UpdatedAt = GETDATE() WHERE Id = @Id");
            using (var connection = _context.CreateConnection())
            {
                await connection.ExecuteAsync(query, new { Id = id, Title = title, Description = description });
            }
        }

        public async Task<EnquiryWorkflow?> GetWorkflowAsync(int enquiryId)
        {
            var query = Sql("SELECT * FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId LIMIT 1",
                            "SELECT TOP 1 * FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId");
            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                return await connection.QueryFirstOrDefaultAsync<EnquiryWorkflow>(query, new { EnquiryId = enquiryId });
            }
        }

        public async Task UpsertQuestionAsync(int enquiryId, string questionText, string updatedBy)
        {
            var query = Sql(@"
INSERT INTO EnquiryWorkflows (EnquiryId, QuestionSent, QuestionText, QuestionSentAt, CreatedAt, UpdatedAt)
VALUES (@EnquiryId, TRUE, @QuestionText, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (EnquiryId) DO UPDATE
SET QuestionSent = TRUE,
    QuestionText = EXCLUDED.QuestionText,
    QuestionSentAt = EXCLUDED.QuestionSentAt,
    UpdatedAt = EXCLUDED.UpdatedAt;

UPDATE Enquiries
SET CurrentStage = 2,
    UpdatedAt = CURRENT_TIMESTAMP
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 2, @QuestionText, @UpdatedBy);
", @"
IF EXISTS (SELECT 1 FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId)
BEGIN
    UPDATE EnquiryWorkflows
    SET QuestionSent = 1,
        QuestionText = @QuestionText,
        QuestionSentAt = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE EnquiryId = @EnquiryId;
END
ELSE
BEGIN
    INSERT INTO EnquiryWorkflows
    (EnquiryId, QuestionSent, QuestionText, QuestionSentAt, CreatedAt, UpdatedAt)
    VALUES
    (@EnquiryId, 1, @QuestionText, GETDATE(), GETDATE(), GETDATE());
END

UPDATE Enquiries
SET CurrentStage = 2,
    UpdatedAt = GETDATE()
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 2, @QuestionText, @UpdatedBy);
");

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                await connection.ExecuteAsync(query, new { EnquiryId = enquiryId, QuestionText = questionText, UpdatedBy = updatedBy });
            }
        }

        public async Task UpdateReplyReceivedAsync(int enquiryId, bool replyReceived, string updatedBy)
        {
            var query = Sql(@"
INSERT INTO EnquiryWorkflows (EnquiryId, ReplyReceived, ReplyTrackedAt, CreatedAt, UpdatedAt)
VALUES (@EnquiryId, @ReplyReceived, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (EnquiryId) DO UPDATE
SET ReplyReceived = EXCLUDED.ReplyReceived,
    ReplyTrackedAt = EXCLUDED.ReplyTrackedAt,
    UpdatedAt = EXCLUDED.UpdatedAt;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 3, @Comments, @UpdatedBy);
", @"
IF EXISTS (SELECT 1 FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId)
BEGIN
    UPDATE EnquiryWorkflows
    SET ReplyReceived = @ReplyReceived,
        ReplyTrackedAt = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE EnquiryId = @EnquiryId;
END
ELSE
BEGIN
    INSERT INTO EnquiryWorkflows
    (EnquiryId, ReplyReceived, ReplyTrackedAt, CreatedAt, UpdatedAt)
    VALUES
    (@EnquiryId, @ReplyReceived, GETDATE(), GETDATE(), GETDATE());
END

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 3, @Comments, @UpdatedBy);
");

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                await connection.ExecuteAsync(query, new
                {
                    EnquiryId = enquiryId,
                    ReplyReceived = replyReceived,
                    Comments = replyReceived ? "Customer reply received" : "Customer reply not received",
                    UpdatedBy = updatedBy
                });
            }
        }

        public async Task FinalizeAcceptWorkflowAsync(int enquiryId, bool acceptResponse, string updatedBy)
        {
            var finalStage = acceptResponse ? 9 : 4;
            var finalStatus = acceptResponse ? "Success" : "Not Confirmed";
            var query = Sql(@"
INSERT INTO EnquiryWorkflows (EnquiryId, AcceptResponse, FinalStatus, FinalizedAt, CreatedAt, UpdatedAt)
VALUES (@EnquiryId, @AcceptResponse, @FinalStatus, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (EnquiryId) DO UPDATE
SET AcceptResponse = EXCLUDED.AcceptResponse,
    FinalStatus = EXCLUDED.FinalStatus,
    FinalizedAt = EXCLUDED.FinalizedAt,
    UpdatedAt = EXCLUDED.UpdatedAt;

UPDATE Enquiries
SET CurrentStage = @FinalStage,
    UpdatedAt = CURRENT_TIMESTAMP
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, @FinalStage, @FinalStatus, @UpdatedBy);
", @"
IF EXISTS (SELECT 1 FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId)
BEGIN
    UPDATE EnquiryWorkflows
    SET AcceptResponse = @AcceptResponse,
        FinalStatus = @FinalStatus,
        FinalizedAt = GETDATE(),
        UpdatedAt = GETDATE()
    WHERE EnquiryId = @EnquiryId;
END
ELSE
BEGIN
    INSERT INTO EnquiryWorkflows
    (EnquiryId, AcceptResponse, FinalStatus, FinalizedAt, CreatedAt, UpdatedAt)
    VALUES
    (@EnquiryId, @AcceptResponse, @FinalStatus, GETDATE(), GETDATE(), GETDATE());
END

UPDATE Enquiries
SET CurrentStage = @FinalStage,
    UpdatedAt = GETDATE()
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, @FinalStage, @FinalStatus, @UpdatedBy);
");

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                await connection.ExecuteAsync(query, new
                {
                    EnquiryId = enquiryId,
                    AcceptResponse = acceptResponse,
                    FinalStatus = finalStatus,
                    FinalStage = finalStage,
                    UpdatedBy = updatedBy
                });
            }
        }

        public async Task RejectWithReviewAsync(int enquiryId, string comment, string updatedBy, string? reason = null, bool? futureHope = null)
        {
            var query = Sql(@"
INSERT INTO EnquiryWorkflows (EnquiryId, RejectionComment, RejectedAt, RejectionReason, FutureHope, FinalStatus, CreatedAt, UpdatedAt)
VALUES (@EnquiryId, @Comment, CURRENT_TIMESTAMP, @Reason, @FutureHope, 'Rejected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (EnquiryId) DO UPDATE
SET RejectionComment = EXCLUDED.RejectionComment,
    RejectedAt = EXCLUDED.RejectedAt,
    RejectionReason = EXCLUDED.RejectionReason,
    FutureHope = EXCLUDED.FutureHope,
    FinalStatus = EXCLUDED.FinalStatus,
    UpdatedAt = EXCLUDED.UpdatedAt;

UPDATE Enquiries
SET CurrentStage = 4,
    UpdatedAt = CURRENT_TIMESTAMP
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 4, @Comment, @UpdatedBy);
", @"
IF EXISTS (SELECT 1 FROM EnquiryWorkflows WHERE EnquiryId = @EnquiryId)
BEGIN
    UPDATE EnquiryWorkflows
    SET RejectionComment = @Comment,
        RejectedAt = GETDATE(),
        RejectionReason = @Reason,
        FutureHope = @FutureHope,
        FinalStatus = 'Rejected',
        UpdatedAt = GETDATE()
    WHERE EnquiryId = @EnquiryId;
END
ELSE
BEGIN
    INSERT INTO EnquiryWorkflows
    (EnquiryId, RejectionComment, RejectedAt, RejectionReason, FutureHope, FinalStatus, CreatedAt, UpdatedAt)
    VALUES
    (@EnquiryId, @Comment, GETDATE(), @Reason, @FutureHope, 'Rejected', GETDATE(), GETDATE());
END

UPDATE Enquiries
SET CurrentStage = 4,
    UpdatedAt = GETDATE()
WHERE Id = @EnquiryId;

INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
VALUES (@EnquiryId, 4, @Comment, @UpdatedBy);
");

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                await connection.ExecuteAsync(query, new { 
                    EnquiryId = enquiryId, 
                    Comment = comment, 
                    UpdatedBy = updatedBy,
                    Reason = reason,
                    FutureHope = futureHope
                });
            }
        }

        public async Task<int> LogEmailAsync(EmailLog emailLog)
        {
            var query = Sql(@"
INSERT INTO EmailLogs (EnquiryId, RecipientEmail, Subject, Body, IsSuccess, ErrorMessage, SentAt)
VALUES (@EnquiryId, @RecipientEmail, @Subject, @Body, @IsSuccess, @ErrorMessage, CURRENT_TIMESTAMP)
RETURNING Id", @"
INSERT INTO EmailLogs (EnquiryId, RecipientEmail, Subject, Body, IsSuccess, ErrorMessage, SentAt)
OUTPUT INSERTED.Id
VALUES (@EnquiryId, @RecipientEmail, @Subject, @Body, @IsSuccess, @ErrorMessage, GETDATE())");

            using (var connection = _context.CreateConnection())
            {
                await EnsureWorkflowSchemaAsync(connection);
                return await connection.QuerySingleAsync<int>(query, emailLog);
            }
        }

        public async Task<SystemSetting?> GetSettingAsync(string keyName)
        {
            var query = "SELECT * FROM SystemSettings WHERE KeyName = @KeyName";
            using var connection = _context.CreateConnection();
            return await connection.QuerySingleOrDefaultAsync<SystemSetting>(query, new { KeyName = keyName });
        }

        public async Task UpsertSettingAsync(string keyName, string keyValue)
        {
            var query = Sql(@"
INSERT INTO SystemSettings (KeyName, KeyValue, UpdatedAt) VALUES (@KeyName, @KeyValue, CURRENT_TIMESTAMP)
ON CONFLICT (KeyName) DO UPDATE SET KeyValue = EXCLUDED.KeyValue, UpdatedAt = EXCLUDED.UpdatedAt;
", @"
IF EXISTS (SELECT 1 FROM SystemSettings WHERE KeyName = @KeyName)
    UPDATE SystemSettings SET KeyValue = @KeyValue, UpdatedAt = GETDATE() WHERE KeyName = @KeyName;
ELSE
    INSERT INTO SystemSettings (KeyName, KeyValue, UpdatedAt) VALUES (@KeyName, @KeyValue, GETDATE());
");
            using var connection = _context.CreateConnection();
            await connection.ExecuteAsync(query, new { KeyName = keyName, KeyValue = keyValue });
        }

        public async Task<IEnumerable<SystemSetting>> GetAllSettingsAsync()
        {
            using var connection = _context.CreateConnection();
            return await connection.QueryAsync<SystemSetting>("SELECT * FROM SystemSettings");
        }

        public async Task<EmailAttachment?> GetAttachmentAsync(int id)
        {
            using var connection = _context.CreateConnection();
            // Load full FileData
            return await connection.QuerySingleOrDefaultAsync<EmailAttachment>("SELECT * FROM EmailAttachments WHERE Id = @Id", new { Id = id });
        }

        public async Task<IEnumerable<EmailAttachment>> GetAttachmentsForEnquiryAsync(int enquiryId)
        {
            using var connection = _context.CreateConnection();
            // Omitting huge VARBINARY FileData here for lists
            return await connection.QueryAsync<EmailAttachment>("SELECT Id, EnquiryId, FileName, ContentType, UploadedAt FROM EmailAttachments WHERE EnquiryId = @EnquiryId", new { EnquiryId = enquiryId });
        }

        public async Task<IEnumerable<ShopifyOrder>> GetAllShopifyOrdersAsync()
        {
            using var connection = _context.CreateConnection();
            return await connection.QueryAsync<ShopifyOrder>("SELECT * FROM ShopifyOrders");
        }

        public async Task<int> CreateEmailEnquiryAsync(Enquiry enquiry, Contact contact, List<EmailAttachment> attachments)
        {
            using var connection = _context.CreateConnection();
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                if (!string.IsNullOrWhiteSpace(enquiry.SourceId))
                {
                    var existingEnquiryId = await connection.QueryFirstOrDefaultAsync<int?>(
                        "SELECT Id FROM Enquiries WHERE Source = 'Email' AND SourceId = @SourceId",
                        new { enquiry.SourceId },
                        transaction
                    );

                    if (existingEnquiryId.HasValue)
                    {
                        transaction.Commit();
                        return 0;
                    }
                }

                var existingContact = await connection.QueryFirstOrDefaultAsync<Contact>("SELECT * FROM Contacts WHERE Email = @Email", new { contact.Email }, transaction);
                int contactId;
                if (existingContact != null) contactId = existingContact.Id;
                else
                {
                    contactId = await connection.QuerySingleAsync<int>(Sql("INSERT INTO Contacts (Name, PhoneNumber, Company, Email) VALUES (@Name, @PhoneNumber, @Company, @Email) RETURNING Id", "INSERT INTO Contacts (Name, PhoneNumber, Company, Email) OUTPUT INSERTED.Id VALUES (@Name, @PhoneNumber, @Company, @Email)"), contact, transaction);
                }

                enquiry.ContactId = contactId;
                enquiry.ReferenceNumber = $"EML-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}";
                enquiry.Source = "Email";

                var enquiryId = await connection.QuerySingleAsync<int>(Sql(@"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage, Source, SourceId) 
                            VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage, @Source, @SourceId) RETURNING Id",
                            @"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage, Source, SourceId) 
                            OUTPUT INSERTED.Id VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage, @Source, @SourceId)"), enquiry, transaction);

                if (attachments != null)
                {
                    foreach (var att in attachments)
                    {
                        att.EnquiryId = enquiryId;
                        await connection.ExecuteAsync(Sql("INSERT INTO EmailAttachments (EnquiryId, FileName, ContentType, FileData) VALUES (@EnquiryId, @FileName, @ContentType, @FileData)", 
                            "INSERT INTO EmailAttachments (EnquiryId, FileName, ContentType, FileData) VALUES (@EnquiryId, @FileName, @ContentType, @FileData)"), att, transaction);
                    }
                }

                await connection.ExecuteAsync("INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy)", new { EnquiryId = enquiryId, StageId = 1, Comments = "Email Extracted", UpdatedBy = "System" }, transaction);

                transaction.Commit();
                return enquiryId;
            }
            catch { transaction.Rollback(); throw; }
        }

        public async Task<int> CreateShopifyEnquiryAsync(Enquiry enquiry, Contact contact, ShopifyOrder shopifyOrder)
        {
            using var connection = _context.CreateConnection();
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                var existingContact = await connection.QueryFirstOrDefaultAsync<Contact>("SELECT * FROM Contacts WHERE Email = @Email", new { contact.Email }, transaction);
                int contactId;
                if (existingContact != null) contactId = existingContact.Id;
                else
                {
                    contactId = await connection.QuerySingleAsync<int>(Sql("INSERT INTO Contacts (Name, PhoneNumber, Company, Email) VALUES (@Name, @PhoneNumber, @Company, @Email) RETURNING Id", "INSERT INTO Contacts (Name, PhoneNumber, Company, Email) OUTPUT INSERTED.Id VALUES (@Name, @PhoneNumber, @Company, @Email)"), contact, transaction);
                }

                enquiry.ContactId = contactId;
                enquiry.ReferenceNumber = $"SHP-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}";
                enquiry.Source = "Shopify";

                var enquiryId = await connection.QuerySingleAsync<int>(Sql(@"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage, Source, SourceId) 
                            VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage, @Source, @SourceId) RETURNING Id",
                            @"INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, CurrentStage, Source, SourceId) 
                            OUTPUT INSERTED.Id VALUES (@ContactId, @ReferenceNumber, @Title, @Description, @CurrentStage, @Source, @SourceId)"), enquiry, transaction);

                shopifyOrder.EnquiryId = enquiryId;
                await connection.ExecuteAsync(Sql(@"INSERT INTO ShopifyOrders (EnquiryId, ShopifyOrderId, Channel, PaymentStatus, FulfillmentStatus, DeliveryStatus, DeliveryMethod, TotalAmount, Flags, OrderDate, ItemsSummary)
                            VALUES (@EnquiryId, @ShopifyOrderId, @Channel, @PaymentStatus, @FulfillmentStatus, @DeliveryStatus, @DeliveryMethod, @TotalAmount, @Flags, @OrderDate, @ItemsSummary)", 
                            @"INSERT INTO ShopifyOrders (EnquiryId, ShopifyOrderId, Channel, PaymentStatus, FulfillmentStatus, DeliveryStatus, DeliveryMethod, TotalAmount, Flags, OrderDate, ItemsSummary)
                            VALUES (@EnquiryId, @ShopifyOrderId, @Channel, @PaymentStatus, @FulfillmentStatus, @DeliveryStatus, @DeliveryMethod, @TotalAmount, @Flags, @OrderDate, @ItemsSummary)"), shopifyOrder, transaction);

                await connection.ExecuteAsync("INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy) VALUES (@EnquiryId, @StageId, @Comments, @UpdatedBy)", new { EnquiryId = enquiryId, StageId = 1, Comments = "Shopify Sync", UpdatedBy = "System" }, transaction);

                transaction.Commit();
                return enquiryId;
            }
            catch { transaction.Rollback(); throw; }
        }

        public async Task WriteAuditLogAsync(AuditLog log)
        {
            using var connection = _context.CreateConnection();
            await connection.ExecuteAsync(
                "INSERT INTO AuditLogs (UserId, Action, EntityType, EntityId, OldValues, NewValues, IpAddress, Timestamp) " +
                "VALUES (@UserId, @Action, @EntityType, @EntityId, @OldValues, @NewValues, @IpAddress, GETDATE())",
                log);
        }

        public async Task<IEnumerable<AuditLog>> GetAuditLogsAsync(int limit = 200)
        {
            using var connection = _context.CreateConnection();
            return await connection.QueryAsync<AuditLog>(
                "SELECT TOP (@Limit) * FROM AuditLogs ORDER BY Timestamp DESC",
                new { Limit = limit });
        }

        public async Task<int> CreateHelpDeskTicketAsync(HelpDeskTicket ticket)
        {
            try
            {
                using var connection = _context.CreateConnection();
                await EnsureHelpDeskSchemaAsync(connection);
                
                var query = Sql(@"
INSERT INTO HelpDeskTickets
    (AdminName, Subject, Description, Status, AssignedTo, CreatedAt, UpdatedAt, HasUnreadForAdmin, HasUnreadForDevAdmin)
VALUES
    (@AdminName, @Subject, @Description, 'Open', COALESCE(NULLIF(@AssignedTo, ''), 'DevAdmin'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, TRUE)
RETURNING Id;",
@"
INSERT INTO HelpDeskTickets
    (AdminName, Subject, Description, Status, AssignedTo, CreatedAt, UpdatedAt, HasUnreadForAdmin, HasUnreadForDevAdmin)
OUTPUT INSERTED.Id
VALUES
    (@AdminName, @Subject, @Description, 'Open', ISNULL(NULLIF(@AssignedTo, ''), 'DevAdmin'), GETDATE(), GETDATE(), 0, 1);");

                var parameters = new 
                { 
                    ticket.AdminName, 
                    ticket.Subject, 
                    ticket.Description, 
                    ticket.AssignedTo 
                };
                
                return await connection.QuerySingleAsync<int>(query, parameters);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to create help desk ticket: {ex.Message}", ex);
            }
        }

        public async Task<IEnumerable<HelpDeskTicket>> GetHelpDeskTicketsAsync()
        {
            using var connection = _context.CreateConnection();
            await EnsureHelpDeskSchemaAsync(connection);

            var ticketsQuery = @"
SELECT
    Id,
    AdminName,
    Subject,
    Description,
    Status,
    AssignedTo,
    ReplyText,
    RepliedBy,
    RepliedAt,
    CreatedAt,
    UpdatedAt,
    LastReplyAt,
    HasUnreadForAdmin,
    HasUnreadForDevAdmin
FROM HelpDeskTickets
ORDER BY CreatedAt DESC";

            var repliesQuery = @"
SELECT
    Id,
    TicketId,
    SenderRole,
    SenderName,
    Message,
    CreatedAt
FROM HelpDeskReplies
ORDER BY CreatedAt ASC";

            var tickets = (await connection.QueryAsync<HelpDeskTicket>(ticketsQuery)).ToList();
            var replies = (await connection.QueryAsync<HelpDeskReply>(repliesQuery)).ToList();
            var repliesByTicket = replies.GroupBy(r => r.TicketId).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var ticket in tickets)
            {
                ticket.Replies = repliesByTicket.TryGetValue(ticket.Id, out var list)
                    ? list
                    : new List<HelpDeskReply>();
            }

            return tickets;
        }

        public async Task<IEnumerable<HelpDeskTicket>> GetHelpDeskTicketsByAdminAsync(string adminName)
        {
            var all = await GetHelpDeskTicketsAsync();
            return all.Where(t => string.Equals(t.AdminName, adminName, StringComparison.OrdinalIgnoreCase));
        }

        public async Task<HelpDeskTicket?> GetHelpDeskTicketByIdAsync(int id)
        {
            var all = await GetHelpDeskTicketsAsync();
            return all.FirstOrDefault(t => t.Id == id);
        }

        public async Task AddHelpDeskReplyAsync(int ticketId, string senderRole, string senderName, string message)
        {
            using var connection = _context.CreateConnection();
            await EnsureHelpDeskSchemaAsync(connection);

            var insertReplySql = Sql(@"
INSERT INTO HelpDeskReplies (TicketId, SenderRole, SenderName, Message, CreatedAt)
VALUES (@TicketId, @SenderRole, @SenderName, @Message, CURRENT_TIMESTAMP);",
@"
INSERT INTO HelpDeskReplies (TicketId, SenderRole, SenderName, Message, CreatedAt)
VALUES (@TicketId, @SenderRole, @SenderName, @Message, GETDATE());");

            await connection.ExecuteAsync(insertReplySql, new
            {
                TicketId = ticketId,
                SenderRole = senderRole,
                SenderName = senderName,
                Message = message
            });

            var setUnreadForAdmin = senderRole == "super_admin";
            var setUnreadForDevAdmin = senderRole == "admin";

            var updateTicketSql = Sql(@"
UPDATE HelpDeskTickets
SET
    ReplyText = @Message,
    RepliedBy = @SenderName,
    RepliedAt = CURRENT_TIMESTAMP,
    LastReplyAt = CURRENT_TIMESTAMP,
    UpdatedAt = CURRENT_TIMESTAMP,
    HasUnreadForAdmin = @SetUnreadForAdmin,
    HasUnreadForDevAdmin = @SetUnreadForDevAdmin,
    Status = CASE
        WHEN @SenderRole = 'super_admin' AND Status = 'Open' THEN 'In Progress'
        ELSE Status
    END
WHERE Id = @TicketId;",
@"
UPDATE HelpDeskTickets
SET
    ReplyText = @Message,
    RepliedBy = @SenderName,
    RepliedAt = GETDATE(),
    LastReplyAt = GETDATE(),
    UpdatedAt = GETDATE(),
    HasUnreadForAdmin = @SetUnreadForAdmin,
    HasUnreadForDevAdmin = @SetUnreadForDevAdmin,
    Status = CASE
        WHEN @SenderRole = 'super_admin' AND Status = 'Open' THEN 'In Progress'
        ELSE Status
    END
WHERE Id = @TicketId;");

            await connection.ExecuteAsync(updateTicketSql, new
            {
                TicketId = ticketId,
                Message = message,
                SenderName = senderName,
                SenderRole = senderRole,
                SetUnreadForAdmin = setUnreadForAdmin,
                SetUnreadForDevAdmin = setUnreadForDevAdmin
            });
        }

        public async Task UpdateHelpDeskTicketStatusAsync(int id, string status)
        {
            using var connection = _context.CreateConnection();
            await EnsureHelpDeskSchemaAsync(connection);

            var sql = Sql(
                "UPDATE HelpDeskTickets SET Status = @Status, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = @Id",
                "UPDATE HelpDeskTickets SET Status = @Status, UpdatedAt = GETDATE() WHERE Id = @Id");

            await connection.ExecuteAsync(sql, new { Id = id, Status = status });
        }

        public async Task MarkHelpDeskTicketReadAsync(int id, string role)
        {
            using var connection = _context.CreateConnection();
            await EnsureHelpDeskSchemaAsync(connection);

            var sql = role.Equals("DevAdmin", StringComparison.OrdinalIgnoreCase)
                ? Sql("UPDATE HelpDeskTickets SET HasUnreadForDevAdmin = FALSE WHERE Id = @Id", "UPDATE HelpDeskTickets SET HasUnreadForDevAdmin = 0 WHERE Id = @Id")
                : Sql("UPDATE HelpDeskTickets SET HasUnreadForAdmin = FALSE WHERE Id = @Id", "UPDATE HelpDeskTickets SET HasUnreadForAdmin = 0 WHERE Id = @Id");

            await connection.ExecuteAsync(sql, new { Id = id });
        }

        public async Task ReplyHelpDeskTicketAsync(int id, string replyText, string repliedBy)
        {
            await AddHelpDeskReplyAsync(id, "super_admin", repliedBy, replyText);
        }

        public async Task AddEmailRecordAsync(Email email)
        {
            var query = Sql(@"
                INSERT INTO Emails (Sender, SenderEmail, Subject, Preview, Body, Recipient, Direction, IsRead, ReceivedAt, CreatedAt)
                VALUES (@Sender, @SenderEmail, @Subject, @Preview, @Body, @Recipient, @Direction, @IsRead, @ReceivedAt, CURRENT_TIMESTAMP)",
                @"
                INSERT INTO Emails (Sender, SenderEmail, Subject, Preview, Body, Recipient, Direction, IsRead, ReceivedAt, CreatedAt)
                VALUES (@Sender, @SenderEmail, @Subject, @Preview, @Body, @Recipient, @Direction, @IsRead, @ReceivedAt, GETDATE())");

            using var connection = _context.CreateConnection();
            await connection.ExecuteAsync(query, email);
        }
    }
}
