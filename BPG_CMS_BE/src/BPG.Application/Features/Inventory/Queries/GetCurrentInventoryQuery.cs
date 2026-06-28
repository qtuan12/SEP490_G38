using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.Inventory.Queries
{
    public record GetCurrentInventoryQuery(long ProjectId) : IRequest<ApiResponse<List<CurrentInventoryDto>>>;
}
