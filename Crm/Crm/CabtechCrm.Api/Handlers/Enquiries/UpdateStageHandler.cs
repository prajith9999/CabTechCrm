using MediatR;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using CabtechCrm.Api.Services;

namespace CabtechCrm.Api.Handlers.Enquiries
{
    public record UpdateStageCommand(int EnquiryId, int StageId, string Comments) : IRequest<bool>;

    public class UpdateStageHandler : IRequestHandler<UpdateStageCommand, bool>
    {
        private readonly IEnquiryRepository _repository;
        private readonly IAuditService _auditService;
        private readonly ICurrentUserProvider _userProvider;

        public UpdateStageHandler(IEnquiryRepository repository, IAuditService auditService, ICurrentUserProvider userProvider)
        {
            _repository = repository;
            _auditService = auditService;
            _userProvider = userProvider;
        }

        public async Task<bool> Handle(UpdateStageCommand request, CancellationToken cancellationToken)
        {
            var enquiry = await _repository.GetEnquiryByIdAsync(request.EnquiryId);
            if (enquiry == null) return false;

            var oldStage = enquiry.CurrentStage;
            var username = _userProvider.Username ?? "Admin";

            await _repository.UpdateEnquiryStageAsync(request.EnquiryId, request.StageId, request.Comments, username);

            await _auditService.LogAsync(
                "UpdateStage", 
                "Enquiry", 
                request.EnquiryId.ToString(), 
                new { StageId = oldStage }, 
                new { StageId = request.StageId, Comments = request.Comments }
            );

            return true;
        }
    }
}
