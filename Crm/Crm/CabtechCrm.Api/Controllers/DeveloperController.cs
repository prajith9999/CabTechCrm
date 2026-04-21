using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Controllers
{
    /// <summary>
    /// SuperAdmin and DevAdmin: audit logs, help desk ticket management.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "SuperAdmin,DevAdmin")]
    public class DeveloperController : ControllerBase
    {
        private readonly IEnquiryRepository _repository;
        private readonly ILogger<DeveloperController> _logger;

        public DeveloperController(IEnquiryRepository repository, ILogger<DeveloperController> logger)
        {
            _repository = repository;
            _logger = logger;
        }

        /// <summary>GET /api/developer/audit-logs — Returns last 200 audit events.</summary>
        [HttpGet("audit-logs")]
        [ProducesResponseType(typeof(IEnumerable<AuditLog>), 200)]
        public async Task<IActionResult> GetAuditLogs()
        {
            try
            {
                var logs = await _repository.GetAuditLogsAsync(200);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load audit logs.");
                return StatusCode(500, new { Message = "Failed to load audit logs." });
            }
        }

        /// <summary>GET /api/developer/helpdesk — All submitted help desk tickets.</summary>
        [HttpGet("helpdesk")]
        [ProducesResponseType(typeof(IEnumerable<HelpDeskTicket>), 200)]
        public async Task<IActionResult> GetTickets()
        {
            try
            {
                var tickets = await _repository.GetHelpDeskTicketsAsync();
                return Ok(tickets);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load help desk tickets.");
                return StatusCode(500, new { Message = "Failed to load tickets." });
            }
        }

        /// <summary>POST /api/developer/helpdesk/{id}/reply — SuperAdmin replies to a ticket.</summary>
        [HttpPost("helpdesk/{id}/reply")]
        [ProducesResponseType(200)]
        [ProducesResponseType(400)]
        public async Task<IActionResult> ReplyToTicket(int id, [FromBody] HelpDeskReplyRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { Message = "Reply text is required." });

            try
            {
                var username = User.Identity?.Name ?? "SuperAdmin";
                await _repository.AddHelpDeskReplyAsync(id, "super_admin", username, request.Message.Trim());

                // Audit log the reply
                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = username,
                    Action = "HelpDeskReply",
                    EntityType = "HelpDeskTicket",
                    EntityId = id.ToString(),
                    NewValues = $"Replied to ticket #{id}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok(new { Message = "Reply saved." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reply to ticket {TicketId}", id);
                return StatusCode(500, new { Message = "Failed to save reply." });
            }
        }

        /// <summary>PATCH /api/developer/helpdesk/{id}/status — SuperAdmin updates ticket status.</summary>
        [HttpPatch("helpdesk/{id}/status")]
        [ProducesResponseType(200)]
        [ProducesResponseType(400)]
        public async Task<IActionResult> UpdateTicketStatus(int id, [FromBody] HelpDeskStatusUpdateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Status))
                return BadRequest(new { Message = "Status is required." });

            var allowed = new[] { "Open", "In Progress", "Resolved" };
            if (!allowed.Contains(request.Status, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { Message = "Status must be Open, In Progress, or Resolved." });

            try
            {
                var normalizedStatus = allowed.First(s => s.Equals(request.Status, StringComparison.OrdinalIgnoreCase));
                await _repository.UpdateHelpDeskTicketStatusAsync(id, normalizedStatus);

                await _repository.WriteAuditLogAsync(new AuditLog
                {
                    UserId = User.Identity?.Name ?? "SuperAdmin",
                    Action = "HelpDeskStatusUpdate",
                    EntityType = "HelpDeskTicket",
                    EntityId = id.ToString(),
                    NewValues = $"Status updated to {normalizedStatus}",
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                return Ok(new { Message = "Ticket status updated." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update ticket status for {TicketId}", id);
                return StatusCode(500, new { Message = "Failed to update ticket status." });
            }
        }
    }

    public class HelpDeskReplyRequest
    {
        public string Message { get; set; } = string.Empty;
    }

    public class HelpDeskStatusUpdateRequest
    {
        public string Status { get; set; } = string.Empty;
    }
}
