using AutoMapper;
using AutoMapper.QueryableExtensions;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class GetSuppliersQueryHandler : IRequestHandler<GetSuppliersQuery, PagedList<SupplierDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetSuppliersQueryHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<PagedList<SupplierDto>> Handle(GetSuppliersQuery request, CancellationToken cancellationToken)
        {
            var query = _uow.Repository<Supplier>().Query()
                .AsNoTracking();

            // Lọc theo trạng thái hợp tác
            if (!string.IsNullOrEmpty(request.CollaborationStatus))
            {
                query = query.Where(s => s.CollaborationStatus == request.CollaborationStatus);
            }

            // Tìm kiếm
            if (!string.IsNullOrEmpty(request.Search))
            {
                var searchLower = request.Search.ToLower();
                query = query.Where(s =>
                    s.SupplierName.ToLower().Contains(searchLower) ||
                    (s.ContactInfo != null && s.ContactInfo.ToLower().Contains(searchLower)) ||
                    (s.ServiceArea != null && s.ServiceArea.ToLower().Contains(searchLower))
                );
            }

            // Sắp xếp
            if (!string.IsNullOrEmpty(request.SortBy))
            {
                var sortProperty = request.SortBy.ToLower();
                if (sortProperty == "name" || sortProperty == "suppliername")
                {
                    query = request.SortDescending
                        ? query.OrderByDescending(s => s.SupplierName)
                        : query.OrderBy(s => s.SupplierName);
                }
                else if (sortProperty == "rating")
                {
                    query = request.SortDescending
                        ? query.OrderByDescending(s => s.Rating)
                        : query.OrderBy(s => s.Rating);
                }
                else if (sortProperty == "status" || sortProperty == "collaborationstatus")
                {
                    query = request.SortDescending
                        ? query.OrderByDescending(s => s.CollaborationStatus)
                        : query.OrderBy(s => s.CollaborationStatus);
                }
                else
                {
                    query = query.OrderByDescending(s => s.CreatedAt);
                }
            }
            else
            {
                query = query.OrderByDescending(s => s.CreatedAt);
            }

            var pagedSuppliers = await query
                .ProjectTo<SupplierDto>(_mapper.ConfigurationProvider)
                .ToPagedListAsync(request.PageNumber, request.PageSize, cancellationToken);

            return pagedSuppliers;
        }
    }
}
