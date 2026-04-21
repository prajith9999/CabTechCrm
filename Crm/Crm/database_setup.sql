-- =============================================
-- Cabtech CRM Database Setup (MSSQL)
-- =============================================

-- 1. Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CabtechCrm')
BEGIN
    CREATE DATABASE CabtechCrm;
END
GO

USE CabtechCrm;
GO

-- 2. RBAC System Tables
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE Users (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Username NVARCHAR(100) UNIQUE NOT NULL,
        Email NVARCHAR(255) NULL,
        PasswordHash NVARCHAR(MAX) NOT NULL,
        FailedLoginAttempts INT DEFAULT 0,
        IsLockedOut BIT DEFAULT 0,
        LockedOutUntil DATETIME NULL,
        LastLoginAt DATETIME NULL,
        CreatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Roles]') AND type in (N'U'))
BEGIN
    CREATE TABLE Roles (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(50) UNIQUE NOT NULL,
        Description NVARCHAR(255) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserRoles]') AND type in (N'U'))
BEGIN
    CREATE TABLE UserRoles (
        UserId INT NOT NULL FOREIGN KEY REFERENCES Users(Id) ON DELETE CASCADE,
        RoleId INT NOT NULL FOREIGN KEY REFERENCES Roles(Id) ON DELETE CASCADE,
        PRIMARY KEY (UserId, RoleId)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Permissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE Permissions (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Code NVARCHAR(100) UNIQUE NOT NULL,
        Description NVARCHAR(255) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RolePermissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE RolePermissions (
        RoleId INT NOT NULL FOREIGN KEY REFERENCES Roles(Id) ON DELETE CASCADE,
        PermissionId INT NOT NULL FOREIGN KEY REFERENCES Permissions(Id) ON DELETE CASCADE,
        PRIMARY KEY (RoleId, PermissionId)
    );
END
GO

-- 3. Contacts Table (Enhanced)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Contacts]') AND type in (N'U'))
BEGIN
    CREATE TABLE Contacts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        PhoneNumber NVARCHAR(50),
        Company NVARCHAR(100),
        Email NVARCHAR(100),
        CreatedBy NVARCHAR(100) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 4. Enquiries Table (Enhanced)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Enquiries]') AND type in (N'U'))
BEGIN
    CREATE TABLE Enquiries (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ContactId INT FOREIGN KEY REFERENCES Contacts(Id),
        ReferenceNumber NVARCHAR(50) UNIQUE,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX),
        CurrentStage INT DEFAULT 1,
        IsActive BIT DEFAULT 1,
        Source NVARCHAR(50) DEFAULT 'Manual',
        SourceId NVARCHAR(100) NULL,
        DistanceKm DECIMAL(10,2) NULL,
        CreatedBy NVARCHAR(100) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 5. Enquiry Stage History
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EnquiryStages]') AND type in (N'U'))
BEGIN
    CREATE TABLE EnquiryStages (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT FOREIGN KEY REFERENCES Enquiries(Id),
        StageId INT NOT NULL, 
        StatusComments NVARCHAR(MAX),
        UpdatedBy NVARCHAR(100),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 6. Enquiry Workflows Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EnquiryWorkflows]') AND type in (N'U'))
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
        FinalStatus NVARCHAR(100) NULL,
        FinalizedAt DATETIME NULL,
        RejectionComment NVARCHAR(MAX) NULL,
        RejectedAt DATETIME NULL,
        CreatedBy NVARCHAR(100) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 7. Email Logs
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EmailLogs]') AND type in (N'U'))
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
END
GO

-- 8. Email Attachments
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EmailAttachments]') AND type in (N'U'))
BEGIN
    CREATE TABLE EmailAttachments (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT NOT NULL FOREIGN KEY REFERENCES Enquiries(Id),
        FileName NVARCHAR(255) NOT NULL,
        ContentType NVARCHAR(100) NOT NULL,
        FileData VARBINARY(MAX) NOT NULL,
        UploadedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 9. System Settings (Encrypted)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SystemSettings]') AND type in (N'U'))
BEGIN
    CREATE TABLE SystemSettings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        KeyName NVARCHAR(100) UNIQUE NOT NULL,
        KeyValue NVARCHAR(MAX) NULL, -- Supports encrypted blobs
        IsEncrypted BIT DEFAULT 0,
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(100) NULL
    );
END
GO

-- 10. External Integrations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExternalIntegrations]') AND type in (N'U'))
BEGIN
    CREATE TABLE ExternalIntegrations (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Provider NVARCHAR(100) NOT NULL, -- Shopify, Gmail, etc.
        ConfigJson NVARCHAR(MAX) NULL, -- Encrypted config
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        UpdatedBy NVARCHAR(100) NULL
    );
END
GO

-- 11. Shopify Orders Tracking
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ShopifyOrders]') AND type in (N'U'))
BEGIN
    CREATE TABLE ShopifyOrders (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EnquiryId INT NOT NULL FOREIGN KEY REFERENCES Enquiries(Id),
        ShopifyOrderId NVARCHAR(100) UNIQUE NOT NULL,
        Channel NVARCHAR(100) NULL,
        PaymentStatus NVARCHAR(50) NULL,
        FulfillmentStatus NVARCHAR(50) NULL,
        DeliveryStatus NVARCHAR(50) NULL,
        DeliveryMethod NVARCHAR(100) NULL,
        TotalAmount DECIMAL(18,2) NULL,
        OrderDate DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 12. Audit Logs (Enhanced Tracking)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AuditLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE AuditLogs (
        Id INT PRIMARY KEY IDENTITY(1,1),
        UserId NVARCHAR(100) NOT NULL,
        Action NVARCHAR(100) NOT NULL,
        EntityType NVARCHAR(100) NOT NULL,
        EntityId NVARCHAR(50) NULL,
        OldValues NVARCHAR(MAX) NULL,
        NewValues NVARCHAR(MAX) NULL,
        IpAddress NVARCHAR(50) NULL,
        Timestamp DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 13. Help Desk Tickets
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HelpDeskTickets]') AND type in (N'U'))
BEGIN
    CREATE TABLE HelpDeskTickets (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SubmittedBy NVARCHAR(100) NOT NULL,
        IssueText NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Open',
        ReplyText NVARCHAR(MAX) NULL,
        RepliedBy NVARCHAR(100) NULL,
        RepliedAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 14. Emails (Raw Inbox Tracking)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Emails]') AND type in (N'U'))
BEGIN
    CREATE TABLE Emails (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Sender NVARCHAR(255) NOT NULL,
        SenderEmail NVARCHAR(255) NOT NULL,
        Subject NVARCHAR(MAX) NOT NULL,
        Preview NVARCHAR(MAX) NULL,
        Body NVARCHAR(MAX) NULL,
        Recipient NVARCHAR(255) NULL,
        IsRead BIT DEFAULT 0,
        ReceivedAt DATETIME DEFAULT GETDATE(),
        CreatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 15. Tasks
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE Tasks (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        AssignedTo NVARCHAR(100) NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Completed
        DueDate DATETIME NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 16. Notifications
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Notifications]') AND type in (N'U'))
BEGIN
    CREATE TABLE Notifications (
        Id INT PRIMARY KEY IDENTITY(1,1),
        UserId NVARCHAR(100) NOT NULL, -- Target user
        Type NVARCHAR(50) NOT NULL, -- Email, Task, Shopify, HelpDesk
        Message NVARCHAR(MAX) NOT NULL,
        IsRead BIT DEFAULT 0,
        EntityId NVARCHAR(100) NULL, -- Link to specific email/task id
        CreatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- 17. Functional Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Contacts_Name' AND object_id = OBJECT_ID('Contacts'))
    CREATE INDEX IX_Contacts_Name ON Contacts(Name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Enquiries_Ref' AND object_id = OBJECT_ID('Enquiries'))
    CREATE INDEX IX_Enquiries_Ref ON Enquiries(ReferenceNumber);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_User' AND object_id = OBJECT_ID('AuditLogs'))
    CREATE INDEX IX_AuditLogs_User ON AuditLogs(UserId);
GO

