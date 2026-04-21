using MediatR;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using CabtechCrm.Api.Services;

namespace CabtechCrm.Api.Handlers.Enquiries
{
    public record CreateEnquiryCommand(string Name, string? PhoneNumber, string? Company, string? Email, string Title, string? Description, decimal? DistanceKm) : IRequest<int>;

    public class CreateEnquiryHandler : IRequestHandler<CreateEnquiryCommand, int>
    {
        private readonly IEnquiryRepository _repository;
        private readonly IAuditService _auditService;
        private readonly ICurrentUserProvider _userProvider;

        public CreateEnquiryHandler(IEnquiryRepository repository, IAuditService auditService, ICurrentUserProvider userProvider)
        {
            _repository = repository;
            _auditService = auditService;
            _userProvider = userProvider;
        }

        public async Task<int> Handle(CreateEnquiryCommand request, CancellationToken cancellationToken)
        {
            var contact = new Contact
            {
                Name = request.Name,
                PhoneNumber = request.PhoneNumber,
                Company = request.Company,
                Email = request.Email,
                CreatedBy = _userProvider.Username,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var enquiry = new Enquiry
            {
                Title = request.Title,
                Description = request.Description,
                DistanceKm = request.DistanceKm,
                CurrentStage = 1,
                CreatedBy = _userProvider.Username,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var id = await _repository.CreateEnquiryAsync(enquiry, contact);

            await _auditService.LogAsync(
                "CreateEnquiry", 
                "Enquiry", 
                id.ToString(), 
                null, 
                new { Enquiry = enquiry, Contact = contact }
            );

            return id;
        }
    }
}
