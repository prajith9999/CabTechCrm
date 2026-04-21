namespace CabtechCrm.Api.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public int FailedLoginAttempts { get; set; }
        public bool IsLockedOut { get; set; }
        public DateTime? LockedOutUntil { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; } = true;

        // Navigation for Dapper mapping
        public List<Role> Roles { get; set; } = new();
    }

    public class Role
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<Permission> Permissions { get; set; } = new();
    }

    public class Permission
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class Contact
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? Company { get; set; }
        public string? Email { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class Enquiry
    {
        public int Id { get; set; }
        public int ContactId { get; set; }
        public string? ReferenceNumber { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal? DistanceKm { get; set; }
        public int CurrentStage { get; set; } = 1;
        public bool IsActive { get; set; } = true;
        public string Source { get; set; } = "Manual";
        public string? SourceId { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        public Contact? Contact { get; set; }
        public EnquiryWorkflow? Workflow { get; set; }
        public ShopifyOrder? ShopifyOrder { get; set; }
        public List<EmailAttachment> Attachments { get; set; } = new();
    }

    public class EnquiryWorkflow
    {
        public int Id { get; set; }
        public int EnquiryId { get; set; }
        public bool QuestionSent { get; set; }
        public string? QuestionText { get; set; }
        public DateTime? QuestionSentAt { get; set; }
        public bool? ReplyReceived { get; set; }
        public DateTime? ReplyTrackedAt { get; set; }
        public bool? AcceptResponse { get; set; }
        public string? FinalStatus { get; set; }
        public DateTime? FinalizedAt { get; set; }
        public string? RejectionComment { get; set; }
        public DateTime? RejectedAt { get; set; }
        public string? RejectionReason { get; set; }
        public bool? FutureHope { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class EmailLog
    {
        public int Id { get; set; }
        public int EnquiryId { get; set; }
        public string RecipientEmail { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public bool IsSuccess { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime SentAt { get; set; }
    }

    public class EnquiryStage
    {
        public int Id { get; set; }
        public int EnquiryId { get; set; }
        public int StageId { get; set; }
        public string? StatusComments { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class SystemSetting
    {
        public int Id { get; set; }
        public string KeyName { get; set; } = string.Empty;
        public string? KeyValue { get; set; }
        public bool IsEncrypted { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public class ExternalIntegration
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Provider { get; set; } = string.Empty;
        public string? ConfigJson { get; set; } // Encrypted
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public class EmailAttachment
    {
        public int Id { get; set; }
        public int EnquiryId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public byte[] FileData { get; set; } = Array.Empty<byte>();
        public DateTime UploadedAt { get; set; }
    }

    public class ShopifyOrder
    {
        public int Id { get; set; }
        public int EnquiryId { get; set; }
        public string ShopifyOrderId { get; set; } = string.Empty;
        public string? Channel { get; set; }
        public string? PaymentStatus { get; set; }
        public string? FulfillmentStatus { get; set; }
        public string? DeliveryStatus { get; set; }
        public string? DeliveryMethod { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? ItemsSummary { get; set; }
        public DateTime? OrderDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class AuditLog
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? IpAddress { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class HelpDeskTicket
    {
        public int Id { get; set; }
        public string AdminName { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "Open"; // Open, In Progress, Resolved
        public string AssignedTo { get; set; } = "DevAdmin";
        public string? ReplyText { get; set; }
        public string? RepliedBy { get; set; }
        public DateTime? RepliedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastReplyAt { get; set; }
        public bool HasUnreadForAdmin { get; set; }
        public bool HasUnreadForDevAdmin { get; set; }
        public List<HelpDeskReply> Replies { get; set; } = new List<HelpDeskReply>();

        // Backward compatibility with older client payloads.
        public string SubmittedBy
        {
            get => AdminName;
            set => AdminName = value;
        }

        public string IssueText
        {
            get => Description;
            set => Description = value;
        }
    }

    public class HelpDeskReply
    {
        public int Id { get; set; }
        public int TicketId { get; set; }
        public string SenderRole { get; set; } = string.Empty; // admin | super_admin
        public string SenderName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class Email
    {
        public int Id { get; set; }
        public string Sender { get; set; } = string.Empty;
        public string SenderEmail { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string? Preview { get; set; }
        public string? Body { get; set; }
        public string? Recipient { get; set; }
        public string Direction { get; set; } = "Incoming"; // "Incoming" or "Outgoing"
        public bool IsRead { get; set; }
        public DateTime ReceivedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TaskItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? AssignedTo { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime? DueDate { get; set; }
        public string? DelayReason { get; set; }
        public DateTime? ExpectedCompletionAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class Notification
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // Email, Task, Shopify, HelpDesk
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public string? EntityId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class DeliveryRecord
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string AssignedTo { get; set; } = string.Empty;
        public int CurrentStage { get; set; } = 1; // 1: Preparation, 2: Dispatched, 3: In Transit, 4: Delivered
        public string? UpdatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
