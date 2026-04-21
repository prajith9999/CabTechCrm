using MediatR;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;

namespace CabtechCrm.Api.Handlers.Enquiries
{
    public record GetEnquiriesQuery() : IRequest<IEnumerable<Enquiry>>;

    public class GetEnquiriesHandler : IRequestHandler<GetEnquiriesQuery, IEnumerable<Enquiry>>
    {
        private readonly IEnquiryRepository _repository;

        public GetEnquiriesHandler(IEnquiryRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<Enquiry>> Handle(GetEnquiriesQuery request, CancellationToken cancellationToken)
        {
            return await _repository.GetAllEnquiriesAsync();
        }
    }
}
