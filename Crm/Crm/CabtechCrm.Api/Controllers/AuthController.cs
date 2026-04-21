using Microsoft.AspNetCore.Mvc;
using MediatR;
using CabtechCrm.Api.Handlers.Auth;

namespace CabtechCrm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IMediator _mediator;

        public AuthController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginCommand command)
        {
            var result = await _mediator.Send(command);
            if (!result.Success)
                return Unauthorized(result);

            return Ok(result);
        }

        [HttpGet("validate")]
        public IActionResult ValidateToken()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
                return Ok(new { Success = true, Username = User.Identity.Name, Role = role });
            }
            return Unauthorized();
        }
    }
}
