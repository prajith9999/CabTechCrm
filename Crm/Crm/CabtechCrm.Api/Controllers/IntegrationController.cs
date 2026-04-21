using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class IntegrationController : ControllerBase
    {
        private readonly IEnquiryRepository _repository;

        public IntegrationController(IEnquiryRepository repository)
        {
            _repository = repository;
        }

        [HttpGet("settings")]
        [Authorize(Roles = "SuperAdmin,DevAdmin")]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await _repository.GetAllSettingsAsync();
            return Ok(settings);
        }

        [HttpPost("settings")]
        [Authorize(Roles = "SuperAdmin,DevAdmin")]
        public async Task<IActionResult> UpdateSettings([FromBody] Dictionary<string, string> settings)
        {
            foreach (var kvp in settings)
                await _repository.UpsertSettingAsync(kvp.Key, kvp.Value);

            // Audit Log
            await _repository.WriteAuditLogAsync(new AuditLog
            {
                UserId = User.Identity?.Name ?? "SuperAdmin",
                Action = "UpdateSettings",
                EntityType = "SystemSettings",
                EntityId = null,
                NewValues = $"Updated {settings.Count} integration settings",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            });

            return Ok(new { Message = "Settings saved successfully" });
        }

        [HttpGet("attachments/{id}")]
        public async Task<IActionResult> DownloadAttachment(int id)
        {
            var attachment = await _repository.GetAttachmentAsync(id);
            if (attachment == null) return NotFound();
            return File(attachment.FileData, attachment.ContentType, attachment.FileName);
        }

        /// <summary>POST /api/integration/helpdesk - Submit a help desk ticket (all roles).</summary>
        [HttpPost("helpdesk")]
        public async Task<IActionResult> SubmitHelpDeskTicket([FromBody] SubmitTicketRequest request)
        {
            try
            {
                var subject = string.IsNullOrWhiteSpace(request.Subject) ? "General Issue" : request.Subject.Trim();
                var description = string.IsNullOrWhiteSpace(request.Description) ? request.IssueText?.Trim() : request.Description.Trim();

                if (string.IsNullOrWhiteSpace(description))
                    return BadRequest(new { Message = "Issue description is required." });

                var username = User.Identity?.Name ?? "Unknown";
                var traceCode = $"CAB-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
                var operatorCode = username.Trim().Replace(' ', '_').ToUpperInvariant();
                var stampedDescription = description +
                    $"\n\n---\n[cabtechadmin] Operator: {username}\nOperator code: {operatorCode}\nTrace code: {traceCode}";

                var ticket = new HelpDeskTicket
                {
                    AdminName = $"cabtechadmin · {username}",
                    Subject = subject,
                    Description = stampedDescription,
                    AssignedTo = "SuperAdmin",
                    Status = "Open"
                };

                var id = await _repository.CreateHelpDeskTicketAsync(ticket);
                return StatusCode(201, new
                {
                    Id = id,
                    Message = "Ticket submitted successfully.",
                    TraceCode = traceCode,
                    OperatorCode = operatorCode,
                    AdminChannel = "cabtechadmin"
                });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { Message = $"Database error: {ex.InnerException?.Message ?? ex.Message}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = $"Error submitting ticket: {ex.Message}" });
            }
        }

        /// <summary>GET /api/integration/helpdesk/my - Returns current user's tickets (all for SuperAdmin, own for Admin).</summary>
        [HttpGet("helpdesk/my")]
        public async Task<IActionResult> GetMyTickets()
        {
            var username = User.Identity?.Name ?? "";
            var isElevated = User.IsInRole("SuperAdmin") || User.IsInRole("DevAdmin");

            if (isElevated)
            {
                // SuperAdmin sees all tickets
                var allTickets = await _repository.GetHelpDeskTicketsAsync();
                return Ok(allTickets);
            }
            else
            {
                // Regular Admin sees only their own tickets
                var mine = await _repository.GetHelpDeskTicketsByAdminAsync(username);
                return Ok(mine);
            }
        }

        /// <summary>POST /api/integration/helpdesk/{id}/reply - Admin replies inside own ticket thread.</summary>
        [HttpPost("helpdesk/{id}/reply")]
        public async Task<IActionResult> ReplyToMyTicket(int id, [FromBody] HelpDeskConversationReplyRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { Message = "Reply message is required." });

            var username = User.Identity?.Name ?? "Unknown";

            var ticket = await _repository.GetHelpDeskTicketByIdAsync(id);
            if (ticket == null) return NotFound(new { Message = "Ticket not found." });

            var isElevated = User.IsInRole("SuperAdmin") || User.IsInRole("DevAdmin");
            var isOwner = ticket.AdminName.Equals(username, StringComparison.OrdinalIgnoreCase);
            if (!isElevated && !isOwner)
                return Forbid();

            var senderRole = isElevated ? "super_admin" : "admin";
            await _repository.AddHelpDeskReplyAsync(id, senderRole, username, request.Message.Trim());
            return Ok(new { Message = "Reply added." });
        }

        /// <summary>POST /api/integration/helpdesk/{id}/mark-read - Mark ticket notifications read for current user role.</summary>
        [HttpPost("helpdesk/{id}/mark-read")]
        public async Task<IActionResult> MarkTicketRead(int id)
        {
            var role = User.IsInRole("DevAdmin") ? "DevAdmin"
                : User.IsInRole("SuperAdmin") ? "SuperAdmin"
                : User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? "Admin";
            await _repository.MarkHelpDeskTicketReadAsync(id, role);
            return Ok(new { Message = "Notification marked as read." });
        }
    }

    public class SubmitTicketRequest
    {
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string IssueText { get; set; } = string.Empty;
    }

    public class HelpDeskConversationReplyRequest
    {
        public string Message { get; set; } = string.Empty;
    }
}
