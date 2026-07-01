using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.SystemConfigs
{
    public record GetSystemConfigsQuery : IRequest<ApiResponse<List<SystemConfigDto>>>;

    public class SystemConfigDto
    {
        public string ConfigKey { get; set; } = string.Empty;
        public string ConfigValue { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Unit { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class GetSystemConfigsQueryHandler : IRequestHandler<GetSystemConfigsQuery, ApiResponse<List<SystemConfigDto>>>
    {
        private readonly IUnitOfWork _uow;

        public GetSystemConfigsQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<ApiResponse<List<SystemConfigDto>>> Handle(
            GetSystemConfigsQuery request, CancellationToken cancellationToken)
        {
            var configs = await _uow.Repository<SystemConfig>().Query()
                .AsNoTracking()
                .OrderBy(c => c.ConfigKey)
                .Select(c => new SystemConfigDto
                {
                    ConfigKey = c.ConfigKey,
                    ConfigValue = c.ConfigValue,
                    DataType = c.DataType,
                    DisplayName = c.DisplayName,
                    Description = c.Description,
                    Unit = c.Unit,
                    UpdatedAt = c.UpdatedAt
                })
                .ToListAsync(cancellationToken);

            return ApiResponse<List<SystemConfigDto>>.SuccessResult(configs);
        }
    }
}
