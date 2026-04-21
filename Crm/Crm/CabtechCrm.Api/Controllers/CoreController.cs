using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CabtechCrm.Api.Handlers.Notifications;
using CabtechCrm.Api.Handlers.Emails;
using CabtechCrm.Api.Handlers.Tasks;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CoreController : ControllerBase
    {
        private readonly IMediator _mediator;

        public CoreController(IMediator mediator)
        {
            _mediator = mediator;
        }

        // ── Notifications ──────────────────────────────────────────
        [HttpGet("notifications/counts")]
        public async Task<ActionResult<NotificationCountsResponse>> GetCounts()
        {
            return Ok(await _mediator.Send(new GetNotificationCountsQuery()));
        }

        [HttpGet("notifications/inbox")]
        public async Task<ActionResult<IEnumerable<Notification>>> GetNotificationInbox()
        {
            return Ok(await _mediator.Send(new GetNotificationsInboxQuery()));
        }

        [HttpPost("notifications/{id}/read")]
        public async Task<IActionResult> MarkNotificationReadInbox(int id)
        {
            var ok = await _mediator.Send(new MarkNotificationReadCommand { Id = id });
            return ok ? NoContent() : NotFound();
        }

        // ── Emails ──────────────────────────────────────────────────
        [HttpGet("emails")]
        public async Task<ActionResult<IEnumerable<Email>>> GetEmails()
        {
            return Ok(await _mediator.Send(new GetEmailsQuery()));
        }

        [HttpPost("emails/{id}/read")]
        public async Task<IActionResult> MarkEmailAsRead(int id)
        {
            await _mediator.Send(new MarkEmailAsReadCommand { Id = id });
            return NoContent();
        }

        [HttpPost("emails/send")]
        public async Task<IActionResult> SendEmail([FromBody] SendEmailCommand command)
        {
            var success = await _mediator.Send(command);
            return success ? Ok(new { message = "Email sent successfully" }) : BadRequest(new { message = "Failed to send email" });
        }

        // ── Tasks ───────────────────────────────────────────────────
        [HttpGet("tasks")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks()
        {
            return Ok(await _mediator.Send(new GetTasksQuery()));
        }

        [HttpPost("tasks")]
        public async Task<ActionResult<int>> CreateTask([FromBody] CreateTaskCommand command)
        {
            return Ok(await _mediator.Send(command));
        }

        [HttpPost("tasks/{id}/toggle")]
        public async Task<IActionResult> ToggleTask(int id)
        {
            await _mediator.Send(new ToggleTaskStatusCommand { Id = id });
            return NoContent();
        }

        [HttpPost("tasks/{id}/progress")]
        public async Task<IActionResult> UpdateTaskProgress(int id, [FromBody] UpdateTaskProgressCommand command)
        {
            command.Id = id;
            var ok = await _mediator.Send(command);
            return ok ? NoContent() : NotFound();
        }

        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var ok = await _mediator.Send(new DeleteTaskCommand { Id = id });
            return ok ? NoContent() : NotFound();
        }

        // ── Delivery ────────────────────────────────────────────────
        [HttpGet("delivery")]
        public async Task<ActionResult<IEnumerable<DeliveryRecord>>> GetDeliveries()
        {
            return Ok(await _mediator.Send(new CabtechCrm.Api.Handlers.Delivery.GetDeliveriesQuery()));
        }

        [HttpPost("delivery")]
        public async Task<ActionResult<int>> CreateDelivery([FromBody] CabtechCrm.Api.Handlers.Delivery.CreateDeliveryCommand command)
        {
            return Ok(await _mediator.Send(command));
        }

        [HttpPost("delivery/{id}/stage")]
        public async Task<IActionResult> UpdateDeliveryStage(int id, [FromBody] CabtechCrm.Api.Handlers.Delivery.UpdateDeliveryStageCommand command)
        {
            var commandWithId = command with { Id = id };
            var ok = await _mediator.Send(commandWithId);
            return ok ? NoContent() : NotFound();
        }

        [HttpDelete("delivery/{id}")]
        public async Task<IActionResult> DeleteDelivery(int id)
        {
            var ok = await _mediator.Send(new CabtechCrm.Api.Handlers.Delivery.DeleteDeliveryCommand(id));
            return ok ? NoContent() : NotFound();
        }

        // ── Settings ────────────────────────────────────────────────
        [HttpPost("settings/upsert")]
        public async Task<IActionResult> UpsertSetting([FromBody] SystemSetting setting)
        {
            using var scope = HttpContext.RequestServices.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IEnquiryRepository>();
            await repo.UpsertSettingAsync(setting.KeyName, setting.KeyValue ?? "");
            return Ok();
        }

        [HttpGet("settings")]
        public async Task<ActionResult<IEnumerable<SystemSetting>>> GetAllSettings()
        {
            using var scope = HttpContext.RequestServices.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IEnquiryRepository>();
            return Ok(await repo.GetAllSettingsAsync());
        }
    }
}
