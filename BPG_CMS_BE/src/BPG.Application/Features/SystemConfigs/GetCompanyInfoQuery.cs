using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace BPG.Application.Features.SystemConfigs
{
    public record GetCompanyInfoQuery : IRequest<ApiResponse<CompanyInfoDto>>;

    public class CompanyInfoDto
    {
        public string CompanyName { get; set; } = "BPG CMS";
        public string CompanyLogoUrl { get; set; } = "/logo.png";
    }

    public class GetCompanyInfoQueryHandler : IRequestHandler<GetCompanyInfoQuery, ApiResponse<CompanyInfoDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetCompanyInfoQueryHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<ApiResponse<CompanyInfoDto>> Handle(
            GetCompanyInfoQuery request, CancellationToken cancellationToken)
        {
            var configs = await _uow.Repository<SystemConfig>().Query()
                .AsNoTracking()
                .Where(c => c.ConfigKey == SystemConfigKeys.CompanyName || c.ConfigKey == SystemConfigKeys.CompanyLogoUrl)
                .ToListAsync(cancellationToken);

            var dto = new CompanyInfoDto();
            var name = configs.FirstOrDefault(c => c.ConfigKey == SystemConfigKeys.CompanyName)?.ConfigValue;
            var logoUrl = configs.FirstOrDefault(c => c.ConfigKey == SystemConfigKeys.CompanyLogoUrl)?.ConfigValue;

            if (!string.IsNullOrWhiteSpace(name)) dto.CompanyName = name;
            if (!string.IsNullOrWhiteSpace(logoUrl)) dto.CompanyLogoUrl = logoUrl;

            return ApiResponse<CompanyInfoDto>.SuccessResult(dto);
        }
    }
}
