using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Application.Features.Inventory.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Inventory.Handlers
{
    public class GetCurrentInventoryQueryHandler : IRequestHandler<GetCurrentInventoryQuery, ApiResponse<List<CurrentInventoryDto>>>
    {
        private readonly IUnitOfWork _uow;

        public GetCurrentInventoryQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<ApiResponse<List<CurrentInventoryDto>>> Handle(GetCurrentInventoryQuery request, CancellationToken cancellationToken)
        {
            var config = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(c => c.ConfigKey == "NguongTonKhoThap" || c.ConfigKey == "LowStockThreshold", cancellationToken);
            decimal threshold = 10m;
            if (config != null && decimal.TryParse(config.ConfigValue, out var val))
            {
                threshold = val;
            }

            var inventory = await _uow.Repository<CurrentInventory>().Query()
                .Include(ci => ci.Material)
                .Include(ci => ci.Unit)
                .Where(ci => ci.ProjectId == request.ProjectId)
                .Select(ci => new CurrentInventoryDto
                {
                    InventoryId = ci.InventoryId,
                    ProjectId = ci.ProjectId,
                    MaterialId = ci.MaterialId,
                    MaterialCode = ci.Material.Code,
                    MaterialName = ci.Material.Name,
                    Specification = ci.Material.Specification ?? string.Empty,
                    UnitId = ci.UnitId,
                    UnitName = ci.Unit.UnitName,
                    Quantity = ci.Quantity,
                    ReservedQuantity = ci.ReservedQuantity,
                    SafetyThreshold = threshold
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<CurrentInventoryDto>>.SuccessResult(inventory);
        }
    }
}
