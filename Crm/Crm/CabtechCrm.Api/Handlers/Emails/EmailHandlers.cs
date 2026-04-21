using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using MediatR;
using Dapper;
using MailKit.Net.Smtp;
using MimeKit;
using Microsoft.Extensions.Logging;

namespace CabtechCrm.Api.Handlers.Emails
{
    public class GetEmailsQuery : IRequest<IEnumerable<Email>> { }

    public class MarkEmailAsReadCommand : IRequest<bool>
    {
        public int Id { get; set; }
    }

    public class SendEmailCommand : IRequest<bool>
    {
        public string To { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public List<EmailAttachmentDto> Attachments { get; set; } = new();
    }

    public class EmailAttachmentDto
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public string Base64Content { get; set; } = string.Empty;
    }

    public class EmailHandlers : 
        IRequestHandler<GetEmailsQuery, IEnumerable<Email>>,
        IRequestHandler<MarkEmailAsReadCommand, bool>,
        IRequestHandler<SendEmailCommand, bool>
    {
        private readonly DapperContext _context;
        private readonly IEnquiryRepository _repo;
        private readonly ILogger<EmailHandlers> _logger;

        public EmailHandlers(DapperContext context, IEnquiryRepository repo, ILogger<EmailHandlers> logger)
        {
            _context = context;
            _repo = repo;
            _logger = logger;
        }

        public async Task<IEnumerable<Email>> Handle(GetEmailsQuery request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            return await connection.QueryAsync<Email>("SELECT * FROM Emails ORDER BY ReceivedAt DESC");
        }

        public async Task<bool> Handle(MarkEmailAsReadCommand request, CancellationToken cancellationToken)
        {
            using var connection = _context.CreateConnection();
            var affected = await connection.ExecuteAsync("UPDATE Emails SET IsRead = 1 WHERE Id = @Id", new { request.Id });
            return affected > 0;
        }

        public async Task<bool> Handle(SendEmailCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var settings = (await _repo.GetAllSettingsAsync()).ToDictionary(s => s.KeyName, s => s.KeyValue);
                var gmailAddress = settings.GetValueOrDefault("GmailAddress");
                var gmailPassword = settings.GetValueOrDefault("GmailAppPassword")?.Replace(" ", "");

                if (string.IsNullOrWhiteSpace(gmailAddress) || string.IsNullOrWhiteSpace(gmailPassword))
                {
                    _logger.LogWarning("Cannot send email: missing Gmail credentials in settings.");
                    return false;
                }

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Cabtech CRM", gmailAddress));
                message.To.Add(new MailboxAddress("", request.To));
                message.Subject = request.Subject;

                var builder = new BodyBuilder { HtmlBody = request.Body };
                foreach (var att in request.Attachments)
                {
                    if (string.IsNullOrEmpty(att.Base64Content)) continue;
                    var data = Convert.FromBase64String(att.Base64Content);
                    builder.Attachments.Add(att.FileName, data, ContentType.Parse(att.ContentType));
                }
                message.Body = builder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync("smtp.gmail.com", 587, MailKit.Security.SecureSocketOptions.StartTls, cancellationToken);
                await client.AuthenticateAsync(gmailAddress, gmailPassword, cancellationToken);
                await client.SendAsync(message, cancellationToken);
                await client.DisconnectAsync(true, cancellationToken);

                // Log to Emails table
                using var connection = _context.CreateConnection();
                var logRow = new
                {
                    Sender = "System",
                    SenderEmail = gmailAddress,
                    Subject = request.Subject,
                    Preview = request.Body.Length > 200 ? request.Body.Substring(0, 200) : request.Body,
                    Body = request.Body,
                    Recipient = request.To,
                    Direction = "Outgoing",
                    IsRead = true,
                    ReceivedAt = DateTime.UtcNow
                };

                await connection.ExecuteAsync(@"
                    INSERT INTO Emails (Sender, SenderEmail, Subject, Preview, Body, Recipient, Direction, IsRead, ReceivedAt, CreatedAt)
                    VALUES (@Sender, @SenderEmail, @Subject, @Preview, @Body, @Recipient, @Direction, @IsRead, @ReceivedAt, GETDATE())",
                    logRow);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Recipient}", request.To);
                return false;
            }
        }
    }
}
