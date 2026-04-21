using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MediatR;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using System.Net;
using System.Net.Mail;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace CabtechCrm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EnquiriesController : ControllerBase
    {
        private readonly IEnquiryRepository _repository;
        private readonly IMediator _mediator;
        private readonly ILogger<EnquiriesController> _logger;
        private readonly IConfiguration _configuration;

        public EnquiriesController(IEnquiryRepository repository, IMediator mediator, ILogger<EnquiriesController> logger, IConfiguration configuration)
        {
            _repository = repository;
            _mediator = mediator;
            _logger = logger;
            _configuration = configuration;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var enquiries = await _mediator.Send(new Handlers.Enquiries.GetEnquiriesQuery());
            return Ok(enquiries);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Handlers.Enquiries.CreateEnquiryCommand command)
        {
            var id = await _mediator.Send(command);
            return StatusCode(201, new { Id = id, Status = "New" });
        }

        [HttpPost("{id}/stage")]
        public async Task<IActionResult> UpdateStage(int id, [FromBody] Handlers.Enquiries.UpdateStageCommand command)
        {
            if (id != command.EnquiryId) return BadRequest("ID mismatch");
            
            var success = await _mediator.Send(command);
            return success ? Ok() : NotFound();
        }

        [HttpGet("contacts")]
        public async Task<IActionResult> GetContacts([FromQuery] string? q)
        {
            try
            {
                var contacts = await _repository.GetContactsAsync(q);
                return Ok(contacts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load contacts.");
                return StatusCode(500, new { Message = "Failed to load contacts." });
            }
        }

        [HttpPost("contacts")]
        public async Task<IActionResult> CreateContact([FromBody] CreateContactRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) ||
                string.IsNullOrWhiteSpace(request.PhoneNumber) ||
                string.IsNullOrWhiteSpace(request.Company) ||
                string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "All required fields must be provided." });
            }

            var contact = new Contact
            {
                Name = request.Name,
                PhoneNumber = request.PhoneNumber,
                Company = request.Company,
                Email = request.Email
            };

            try
            {
                var id = await _repository.CreateContactAsync(contact);
                var title = $"New enquiry — {contact.Name}";
                if (title.Length > 255)
                    title = title[..255];
                var enquiry = new Enquiry
                {
                    Title = title,
                    Description = $"Lead from customer details. Company: {contact.Company}. Phone: {contact.PhoneNumber}. Email: {contact.Email}.",
                    CurrentStage = 1
                };
                var enquiryId = await _repository.CreateEnquiryForExistingContactAsync(id, enquiry);

                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? "Admin",
                    Action = "CreateContactWithEnquiry",
                    EntityType = "Enquiry",
                    EntityId = enquiryId.ToString(),
                    NewValues = $"Contact #{id}; enquiry #{enquiryId}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return StatusCode(201, new { Id = id, EnquiryId = enquiryId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create contact for {Name}", request.Name);
                return StatusCode(500, new { Message = "Failed to create contact." });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.DeleteEnquiryAsync(id);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? "Admin",
                    Action = "DeleteEnquiry",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = $"Deleted enquiry #{id} ({enquiry.ReferenceNumber})",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to delete enquiry." });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateEnquiryDetailsRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Description))
            {
                return BadRequest(new { Message = "Title and Description are required." });
            }

            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.UpdateEnquiryDetailsAsync(id, request.Title, request.Description, request.DistanceKm ?? request.Distance);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? "Admin",
                    Action = "UpdateEnquiryDetails",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = "Updated title or description",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to update enquiry." });
            }
        }

        [HttpGet("{id}/workflow")]
        public async Task<IActionResult> GetWorkflow(int id)
        {
            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                var workflow = await _repository.GetWorkflowAsync(id);
                return Ok(workflow);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load workflow for enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to load workflow." });
            }
        }

        [HttpPost("{id}/workflow/question")]
        public async Task<IActionResult> SendQuestion(int id, [FromBody] SendQuestionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Question))
            {
                return BadRequest(new { Message = "Question is required." });
            }

            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.UpsertQuestionAsync(id, request.Question.Trim(), request.UpdatedBy);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? request.UpdatedBy,
                    Action = "SendQuestion",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = $"Question sent: {request.Question.Trim().Substring(0, Math.Min(50, request.Question.Trim().Length))}...",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                var subject = $"Question for enquiry {enquiry.ReferenceNumber}";
                var body = request.Question.Trim();
                await SendQuestionEmailAsync(enquiry, subject, body);

                return Ok(new { Message = "Question saved and email processed." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send question for enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to process question." });
            }
        }

        [HttpPost("{id}/workflow/reply")]
        public async Task<IActionResult> TrackReply(int id, [FromBody] ReplyTrackingRequest request)
        {
            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.UpdateReplyReceivedAsync(id, request.ReplyReceived, request.UpdatedBy);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? request.UpdatedBy,
                    Action = "TrackReply",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = $"Reply received status set to: {request.ReplyReceived}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok(new { Message = "Reply status updated." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update reply tracking for enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to update reply status." });
            }
        }

        [HttpPost("{id}/workflow/final")]
        public async Task<IActionResult> FinalDecision(int id, [FromBody] FinalDecisionRequest request)
        {
            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.FinalizeAcceptWorkflowAsync(id, request.AcceptResponse, request.UpdatedBy);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? request.UpdatedBy,
                    Action = "FinalDecision",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = $"Final decision: {(request.AcceptResponse ? "Accepted" : "Not Confirmed")}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok(new { Message = "Final decision saved.", Status = request.AcceptResponse ? "Success" : "Not Confirmed" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save final decision for enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to save final decision." });
            }
        }

        [HttpPost("{id}/workflow/reject")]
        public async Task<IActionResult> RejectWithReview(int id, [FromBody] RejectReviewRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                return BadRequest(new { Message = "Comment is required for rejection." });
            }

            try
            {
                var enquiry = await _repository.GetEnquiryByIdAsync(id);
                if (enquiry == null)
                {
                    return NotFound(new { Message = "Enquiry not found." });
                }

                await _repository.RejectWithReviewAsync(id, request.Comment.Trim(), request.UpdatedBy, request.Reason, request.FutureHope);

                // Audit Log
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? request.UpdatedBy,
                    Action = "RejectEnquiry",
                    EntityType = "Enquiry",
                    EntityId = id.ToString(),
                    NewValues = $"Rejected. Reason: {request.Reason}. Comment: {request.Comment.Trim()}. Future Hope: {request.FutureHope}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok(new { Message = "Review saved and enquiry rejected." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reject enquiry {EnquiryId}", id);
                return StatusCode(500, new { Message = "Failed to reject enquiry." });
            }
        }

        private async Task SendQuestionEmailAsync(Enquiry enquiry, string subject, string body)
        {
            var recipient = enquiry.Contact?.Email ?? string.Empty;
            if (string.IsNullOrWhiteSpace(recipient))
            {
                await _repository.LogEmailAsync(new EmailLog
                {
                    EnquiryId = enquiry.Id,
                    RecipientEmail = string.Empty,
                    Subject = subject,
                    Body = body,
                    IsSuccess = false,
                    ErrorMessage = "Recipient email not found."
                });
                return;
            }

            var smtpHost = _configuration["Email:SmtpHost"]?.Trim();
            var smtpPortRaw = (_configuration["Email:SmtpPort"] ?? "587").Trim();
            var smtpUser = _configuration["Email:Username"]?.Trim();
            var smtpPass = _configuration["Email:Password"]?.Trim();
            var fromEmail = _configuration["Email:From"]?.Trim();

            // When appsettings SMTP is incomplete, use Gmail from Integration settings (same as IMAP sync).
            if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpUser) || string.IsNullOrWhiteSpace(smtpPass))
            {
                var gmailAddr = (await _repository.GetSettingAsync("GmailAddress"))?.KeyValue?.Trim();
                var gmailAppPw = ((await _repository.GetSettingAsync("GmailAppPassword"))?.KeyValue ?? "").Replace(" ", "").Trim();
                if (!string.IsNullOrWhiteSpace(gmailAddr) && !string.IsNullOrWhiteSpace(gmailAppPw))
                {
                    smtpHost = "smtp.gmail.com";
                    smtpPortRaw = string.IsNullOrWhiteSpace(smtpPortRaw) ? "587" : smtpPortRaw;
                    smtpUser = string.IsNullOrWhiteSpace(smtpUser) ? gmailAddr : smtpUser;
                    smtpPass = string.IsNullOrWhiteSpace(smtpPass) ? gmailAppPw : smtpPass;
                    if (string.IsNullOrWhiteSpace(fromEmail))
                        fromEmail = gmailAddr;
                }
            }

            if (string.IsNullOrWhiteSpace(fromEmail))
                fromEmail = smtpUser ?? "noreply@cabtech.local";

            if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpUser) || string.IsNullOrWhiteSpace(smtpPass))
            {
                await _repository.LogEmailAsync(new EmailLog
                {
                    EnquiryId = enquiry.Id,
                    RecipientEmail = recipient,
                    Subject = subject,
                    Body = body,
                    IsSuccess = false,
                    ErrorMessage = "SMTP is not configured. Set Email:* in appsettings or Gmail address + App Password under Shopify and Mail integration."
                });
                return;
            }

            try
            {
                var smtpPort = int.TryParse(smtpPortRaw, out var parsedPort) ? parsedPort : 587;
                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(smtpUser, smtpPass)
                };

                using var message = new MailMessage(fromEmail, recipient, subject, body);
                await client.SendMailAsync(message);

                await _repository.LogEmailAsync(new EmailLog
                {
                    EnquiryId = enquiry.Id,
                    RecipientEmail = recipient,
                    Subject = subject,
                    Body = body,
                    IsSuccess = true,
                    ErrorMessage = null
                });

                // Also log to unified Emails table for UI
                await _repository.AddEmailRecordAsync(new Email
                {
                    Sender = "System",
                    SenderEmail = fromEmail,
                    Subject = subject,
                    Body = body,
                    Preview = body.Length > 200 ? body.Substring(0, 200) : body,
                    Recipient = recipient,
                    Direction = "Outgoing",
                    IsRead = true,
                    ReceivedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMTP email failed for enquiry {EnquiryId}", enquiry.Id);
                await _repository.LogEmailAsync(new EmailLog
                {
                    EnquiryId = enquiry.Id,
                    RecipientEmail = recipient,
                    Subject = subject,
                    Body = body,
                    IsSuccess = false,
                    ErrorMessage = ex.Message
                });
            }
        }
    }

    public class UpdateEnquiryDetailsRequest
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public decimal? Distance { get; set; }
        public decimal? DistanceKm { get; set; }
    }

    public class CreateEnquiryRequest
    {
        public string Name { get; set; } = "";
        public string? PhoneNumber { get; set; }
        public string? Company { get; set; }
        public string? Email { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public decimal? Distance { get; set; }
        public decimal? DistanceKm { get; set; }
    }

    public class UpdateStageRequest
    {
        public int StageId { get; set; }
        public string Comments { get; set; } = "";
        public string UpdatedBy { get; set; } = "Admin";
    }

    public class CreateContactRequest
    {
        public string Name { get; set; } = "";
        public string? PhoneNumber { get; set; }
        public string? Company { get; set; }
        public string? Email { get; set; }
    }

    public class SendQuestionRequest
    {
        public string Question { get; set; } = "";
        public string UpdatedBy { get; set; } = "Admin";
    }

    public class ReplyTrackingRequest
    {
        public bool ReplyReceived { get; set; }
        public string UpdatedBy { get; set; } = "Admin";
    }

    public class FinalDecisionRequest
    {
        public bool AcceptResponse { get; set; }
        public string UpdatedBy { get; set; } = "Admin";
    }

    public class RejectReviewRequest
    {
        public string Comment { get; set; } = "";
        public string? Reason { get; set; }
        public bool? FutureHope { get; set; }
        public string UpdatedBy { get; set; } = "Admin";
    }
}
