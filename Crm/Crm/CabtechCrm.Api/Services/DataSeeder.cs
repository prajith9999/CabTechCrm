using Dapper;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Services
{
    public class DataSeeder
    {
        private readonly DapperContext _context;
        private readonly IConfiguration _configuration;
        private readonly IHostEnvironment _environment;

        public DataSeeder(DapperContext context, IConfiguration configuration, IHostEnvironment environment)
        {
            _context = context;
            _configuration = configuration;
            _environment = environment;
        }

        /// <summary>
        /// When true, default bootstrap accounts get their passwords re-hashed to match the repo defaults.
        /// Defaults to on in Development so a stale/wrong DB row (from an older seed) does not block login.
        /// Set Auth:Bootstrap:SyncDefaultPasswords to false in production if you rely on manually changed passwords.
        /// </summary>
        private bool ShouldSyncDefaultPasswords()
        {
            return true;
        }

        public async Task SeedAsync()
        {
            using var connection = _context.CreateConnection();

            // ── Automated Migrations (Mini-Migration for Tasks) ─────────
            try
            {
                if (_context.IsPostgres)
                {
                    await connection.ExecuteAsync(@"
                        DO $$ 
                        BEGIN 
                            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='delayreason') THEN
                                ALTER TABLE Tasks ADD COLUMN DelayReason TEXT;
                            END IF;
                            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='expectedcompletionat') THEN
                                ALTER TABLE Tasks ADD COLUMN ExpectedCompletionAt TIMESTAMP;
                            END IF;
                        END $$;");
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'DelayReason')
                        BEGIN
                            ALTER TABLE Tasks ADD DelayReason NVARCHAR(MAX);
                        END
                        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ExpectedCompletionAt')
                        BEGIN
                            ALTER TABLE Tasks ADD ExpectedCompletionAt DATETIME2;
                        END");
                }
            }
            catch (Exception ex)
            {
                // Log and continue (if table doesn't exist yet, it will be created below)
                Console.WriteLine($"Migration warning: {ex.Message}");
            }

            if (_context.IsPostgres)
            {
                var pgSchemaStatements = new string[]
                {
                    @"CREATE TABLE IF NOT EXISTS Users (
                        Id SERIAL PRIMARY KEY,
                        Username VARCHAR(100) UNIQUE NOT NULL,
                        Email VARCHAR(255),
                        PasswordHash TEXT NOT NULL,
                        FailedLoginAttempts INT DEFAULT 0,
                        IsLockedOut BOOLEAN DEFAULT FALSE,
                        LockedOutUntil TIMESTAMP,
                        LastLoginAt TIMESTAMP,
                        CreatedBy VARCHAR(100),
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        IsActive BOOLEAN DEFAULT TRUE
                    );",
                    @"CREATE TABLE IF NOT EXISTS Roles (
                        Id SERIAL PRIMARY KEY,
                        Name VARCHAR(50) UNIQUE NOT NULL,
                        Description VARCHAR(255)
                    );",
                    @"CREATE TABLE IF NOT EXISTS UserRoles (
                        UserId INT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
                        RoleId INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
                        PRIMARY KEY (UserId, RoleId)
                    );",
                    @"CREATE TABLE IF NOT EXISTS Permissions (
                        Id SERIAL PRIMARY KEY,
                        Code VARCHAR(100) UNIQUE NOT NULL,
                        Description VARCHAR(255)
                    );",
                    @"CREATE TABLE IF NOT EXISTS RolePermissions (
                        RoleId INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
                        PermissionId INT NOT NULL REFERENCES Permissions(Id) ON DELETE CASCADE,
                        PRIMARY KEY (RoleId, PermissionId)
                    );",
                    @"CREATE TABLE IF NOT EXISTS SystemSettings (
                        Id SERIAL PRIMARY KEY,
                        KeyName VARCHAR(100) UNIQUE NOT NULL,
                        KeyValue TEXT,
                        IsEncrypted BOOLEAN DEFAULT FALSE,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedBy VARCHAR(100)
                    );",
                    @"CREATE TABLE IF NOT EXISTS ExternalIntegrations (
                        Id SERIAL PRIMARY KEY,
                        Name VARCHAR(100) NOT NULL,
                        Provider VARCHAR(100) NOT NULL,
                        ConfigJson TEXT,
                        IsActive BOOLEAN DEFAULT TRUE,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedBy VARCHAR(100)
                    );",
                    @"CREATE TABLE IF NOT EXISTS ShopifyOrders (
                        Id SERIAL PRIMARY KEY,
                        EnquiryId INT NOT NULL,
                        ShopifyOrderId VARCHAR(100) UNIQUE NOT NULL,
                        Channel VARCHAR(100),
                        PaymentStatus VARCHAR(50),
                        FulfillmentStatus VARCHAR(50),
                        DeliveryStatus VARCHAR(50),
                        DeliveryMethod VARCHAR(100),
                        TotalAmount DECIMAL(18,2),
                        OrderDate TIMESTAMP,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );",
                    @"CREATE TABLE IF NOT EXISTS EmailAttachments (
                        Id SERIAL PRIMARY KEY,
                        EnquiryId INT NOT NULL,
                        FileName VARCHAR(255) NOT NULL,
                        ContentType VARCHAR(100) NOT NULL,
                        FileData BYTEA NOT NULL,
                        UploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );",
                    @"CREATE TABLE IF NOT EXISTS AuditLogs (
                        Id SERIAL PRIMARY KEY,
                        UserId VARCHAR(100) NOT NULL,
                        Action VARCHAR(100) NOT NULL,
                        EntityType VARCHAR(100) NOT NULL,
                        EntityId VARCHAR(50),
                        OldValues TEXT,
                        NewValues TEXT,
                        IpAddress VARCHAR(50),
                        Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );",
                    @"CREATE TABLE IF NOT EXISTS Emails (
                        Id SERIAL PRIMARY KEY,
                        Sender VARCHAR(255) NOT NULL,
                        SenderEmail VARCHAR(255) NOT NULL,
                        Subject TEXT NOT NULL,
                        Preview TEXT,
                        Body TEXT,
                        Recipient VARCHAR(255),
                        Direction VARCHAR(20) DEFAULT 'Incoming',
                        IsRead BOOLEAN DEFAULT FALSE,
                        ReceivedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );",
                    @"CREATE TABLE IF NOT EXISTS Tasks (
                        Id SERIAL PRIMARY KEY,
                        Title VARCHAR(255) NOT NULL,
                        Description TEXT,
                        AssignedTo VARCHAR(100),
                        Status VARCHAR(50) DEFAULT 'Pending',
                        DueDate TIMESTAMP,
                        DelayReason TEXT,
                        ExpectedCompletionAt TIMESTAMP,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );",
                    @"CREATE TABLE IF NOT EXISTS Notifications (
                        Id SERIAL PRIMARY KEY,
                        UserId VARCHAR(100) NOT NULL,
                        Type VARCHAR(50) NOT NULL,
                        Message TEXT NOT NULL,
                        IsRead BOOLEAN DEFAULT FALSE,
                        EntityId VARCHAR(100),
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );"
                };

                foreach (var st in pgSchemaStatements)
                {
                    await connection.ExecuteAsync(st);
                }
            }
            else
            {
                // SQL Server Table Creations (Focusing on Tasks as per request)
                await connection.ExecuteAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Tasks]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE [Tasks] (
                            [Id] INT IDENTITY(1,1) PRIMARY KEY,
                            [Title] NVARCHAR(255) NOT NULL,
                            [Description] NVARCHAR(MAX),
                            [AssignedTo] NVARCHAR(100),
                            [Status] NVARCHAR(50) DEFAULT 'Pending',
                            [DueDate] DATETIME2,
                            [DelayReason] NVARCHAR(MAX),
                            [ExpectedCompletionAt] DATETIME2,
                            [CreatedAt] DATETIME2 DEFAULT GETDATE(),
                            [UpdatedAt] DATETIME2 DEFAULT GETDATE()
                        );
                    END
                    
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Emails]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE [Emails] (
                            [Id] INT IDENTITY(1,1) PRIMARY KEY,
                            [Sender] NVARCHAR(255) NOT NULL,
                            [SenderEmail] NVARCHAR(255) NOT NULL,
                            [Subject] NVARCHAR(MAX) NOT NULL,
                            [Preview] NVARCHAR(MAX),
                            [Body] NVARCHAR(MAX),
                            [Recipient] NVARCHAR(255),
                            [Direction] NVARCHAR(20) DEFAULT 'Incoming',
                            [IsRead] BIT DEFAULT 0,
                            [ReceivedAt] DATETIME2 DEFAULT GETDATE(),
                            [CreatedAt] DATETIME2 DEFAULT GETDATE()
                        );
                    END

                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[ShopifyOrders]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE [ShopifyOrders] (
                            [Id] INT IDENTITY(1,1) PRIMARY KEY,
                            [EnquiryId] INT NOT NULL,
                            [ShopifyOrderId] NVARCHAR(100) UNIQUE NOT NULL,
                            [Channel] NVARCHAR(100),
                            [PaymentStatus] NVARCHAR(50),
                            [FulfillmentStatus] NVARCHAR(50),
                            [DeliveryStatus] NVARCHAR(50),
                            [DeliveryMethod] NVARCHAR(100),
                            [TotalAmount] DECIMAL(18,2),
                            [OrderDate] DATETIME2,
                            [CreatedAt] DATETIME2 DEFAULT GETDATE(),
                            [UpdatedAt] DATETIME2 DEFAULT GETDATE()
                        );
                    END
                    
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[Notifications]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE [Notifications] (
                            [Id] INT IDENTITY(1,1) PRIMARY KEY,
                            [UserId] NVARCHAR(100) NOT NULL,
                            [Type] NVARCHAR(50) NOT NULL,
                            [Message] NVARCHAR(MAX) NOT NULL,
                            [IsRead] BIT DEFAULT 0,
                            [EntityId] NVARCHAR(100),
                            [CreatedAt] DATETIME2 DEFAULT GETDATE()
                        );
                    END");
            }

            // 1. Seed Roles
            var roles = new[]
            {
                new { Name = "SuperAdmin", Description = "Full system access" },
                new { Name = "DevAdmin", Description = "Developer administration (system monitoring & tools)" },
                new { Name = "Admin", Description = "CRM Management" },
                new { Name = "User", Description = "View only access" }
            };

            foreach (var role in roles)
            {
                var exists = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Roles WHERE Name = @Name", role);
                if (exists == 0)
                {
                    var query = "INSERT INTO Roles (Name, Description) VALUES (@Name, @Description)";
                    await connection.ExecuteAsync(query, role);
                }
            }

            // 2. Seed Permissions
            var permissions = new[]
            {
                new { Code = "ManageUsers", Description = "Create/Edit Users" },
                new { Code = "ManageSettings", Description = "Change System Settings" },
                new { Code = "ManageIntegrations", Description = "Configure Shopify/Email" },
                new { Code = "ManageEnquiries", Description = "Full CRM access" },
                new { Code = "ViewReports", Description = "Access Analytics" }
            };

            foreach (var perm in permissions)
            {
                var exists = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Permissions WHERE Code = @Code", perm);
                if (exists == 0)
                {
                    var query = "INSERT INTO Permissions (Code, Description) VALUES (@Code, @Description)";
                    await connection.ExecuteAsync(query, perm);
                }
            }

            // 3. Link SuperAdmin Role to all Permissions
            var linkQuery = @"
                INSERT INTO RolePermissions (RoleId, PermissionId)
                SELECT r.Id, p.Id
                FROM Roles r, Permissions p
                WHERE r.Name = 'SuperAdmin'
                AND NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleId = r.Id AND PermissionId = p.Id)";
            await connection.ExecuteAsync(linkQuery);

            var userQuery = @"
                INSERT INTO Users (Username, PasswordHash, CreatedAt, IsActive) 
                VALUES (@Username, @PasswordHash, @CreatedAt, @IsActive)";

            var assignQuery = @"
                INSERT INTO UserRoles (UserId, RoleId)
                SELECT u.Id, r.Id
                FROM Users u, Roles r
                WHERE u.Username = @Username AND r.Name = @Role
                AND NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = u.Id AND RoleId = r.Id)";

            // 4. Seed default system users (for fresh/local installs)
            var now = DateTime.UtcNow;
            var defaultUsers = new[]
            {
                new { Username = "SuperAdmin", Password = "Admin123!", Role = "SuperAdmin" },
                new { Username = "CabtechTrack", Password = "CabtechDohaQatar111!@#", Role = "Admin" },
                new { Username = "Cabtechdev", Password = "PrajithCabtech3031@", Role = "DevAdmin" }
            };

            foreach (var u in defaultUsers)
            {
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(u.Password);
                
                var exists = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Users WHERE Username = @Username", new { Username = u.Username });
                if (exists == 0)
                {
                    await connection.ExecuteAsync(userQuery, new
                    {
                        Username = u.Username,
                        PasswordHash = passwordHash,
                        CreatedAt = now,
                        IsActive = true
                    });
                }

                await connection.ExecuteAsync(assignQuery, new { Username = u.Username, Role = u.Role });

                if (ShouldSyncDefaultPasswords())
                {
                    await connection.ExecuteAsync(@"
                        UPDATE Users
                        SET PasswordHash = @PasswordHash,
                            IsActive = @IsActive,
                            FailedLoginAttempts = 0,
                            IsLockedOut = @IsLockedOut,
                            LockedOutUntil = NULL
                        WHERE LOWER(Username) = LOWER(@Username)",
                        new { Username = u.Username, PasswordHash = passwordHash, IsActive = true, IsLockedOut = false });
                }
            }

            // 5. Seed Mock Data for Dashboard Counts
            var tasksCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Tasks");
            if (tasksCount == 0)
            {
                var insertTasks = _context.IsPostgres ? 
                    @"INSERT INTO Tasks (Title, Description, Status, CreatedAt) VALUES 
                      ('System Update', 'Verify new UI changes', 'Pending', CURRENT_TIMESTAMP)" :
                    @"INSERT INTO Tasks (Title, Description, Status, CreatedAt) VALUES 
                      ('System Update', 'Verify new UI changes', 'Pending', GETDATE())";
                await connection.ExecuteAsync(insertTasks);
            }
                
            var emailsCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Emails");
            if (emailsCount == 0)
            {
                var insertEmails = _context.IsPostgres ? 
                    @"INSERT INTO Emails (Sender, SenderEmail, Subject, IsRead, CreatedAt) VALUES 
                      ('Client', 'client@example.com', 'Inquiry regarding services', false, CURRENT_TIMESTAMP),
                      ('Support', 'support@example.com', 'Ticket resolved', true, CURRENT_TIMESTAMP)" :
                    @"INSERT INTO Emails (Sender, SenderEmail, Subject, IsRead, CreatedAt) VALUES 
                      ('Client', 'client@example.com', 'Inquiry regarding services', 0, GETDATE()),
                      ('Support', 'support@example.com', 'Ticket resolved', 1, GETDATE())";
                await connection.ExecuteAsync(insertEmails);
            }

            var ordersCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM ShopifyOrders");
            if (ordersCount == 0)
            {
                var insertOrders = _context.IsPostgres ? 
                    @"INSERT INTO ShopifyOrders (EnquiryId, ShopifyOrderId, Channel, TotalAmount, CreatedAt) VALUES 
                      (1, 'ORD-001', 'Web', 250.00, CURRENT_TIMESTAMP),
                      (2, 'ORD-002', 'Mobile', 120.00, CURRENT_TIMESTAMP)" :
                    @"INSERT INTO ShopifyOrders (EnquiryId, ShopifyOrderId, Channel, TotalAmount, CreatedAt) VALUES 
                      (1, 'ORD-001', 'Web', 250.00, GETDATE()),
                      (2, 'ORD-002', 'Mobile', 120.00, GETDATE())";
                await connection.ExecuteAsync(insertOrders);
            }
        }
    }
}
