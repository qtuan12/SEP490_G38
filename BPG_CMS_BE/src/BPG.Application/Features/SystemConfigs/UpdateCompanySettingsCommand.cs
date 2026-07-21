using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;

namespace BPG.Application.Features.SystemConfigs
{
    public class UpdateCompanySettingsCommand : IRequest<bool>
    {
        public string CompanyName { get; init; } = string.Empty;
        public string CompanyLogoUrl { get; init; } = string.Empty;
    }

    public class UpdateCompanySettingsCommandValidator : AbstractValidator<UpdateCompanySettingsCommand>
    {
        public UpdateCompanySettingsCommandValidator()
        {
            RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(200)
                .WithMessage("Tên công ty không được để trống và tối đa 200 ký tự.");
            RuleFor(x => x.CompanyLogoUrl).NotEmpty()
                .Must(url => Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out _))
                .WithMessage("URL logo không hợp lệ.");
        }
    }

    public class UpdateCompanySettingsCommandHandler : IRequestHandler<UpdateCompanySettingsCommand, bool>
    {
        private readonly IUnitOfWork _uow;
        private readonly IFileStorageService _fileStorageService;

        public UpdateCompanySettingsCommandHandler(IUnitOfWork uow, IFileStorageService fileStorageService)
        {
            _uow = uow;
            _fileStorageService = fileStorageService;
        }

        public async Task<bool> Handle(UpdateCompanySettingsCommand request, CancellationToken cancellationToken)
        {
            var configs = await _uow.Repository<SystemConfig>().Query()
                .Where(c => c.ConfigKey == SystemConfigKeys.CompanyName || c.ConfigKey == SystemConfigKeys.CompanyLogoUrl)
                .ToListAsync(cancellationToken);

            var nameConfig = configs.FirstOrDefault(c => c.ConfigKey == SystemConfigKeys.CompanyName);
            var logoConfig = configs.FirstOrDefault(c => c.ConfigKey == SystemConfigKeys.CompanyLogoUrl);

            var oldLogoUrl = logoConfig?.ConfigValue;

            if (nameConfig != null) nameConfig.ConfigValue = request.CompanyName.Trim();
            if (logoConfig != null) logoConfig.ConfigValue = request.CompanyLogoUrl.Trim();

            await _uow.SaveChangesAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(oldLogoUrl)
                && oldLogoUrl != request.CompanyLogoUrl
                && oldLogoUrl.Contains("cloudinary.com"))
            {
                try
                {
                    await _fileStorageService.DeleteFileAsync(oldLogoUrl, cancellationToken);
                }
                catch
                {
                    // Dọn file cũ là best-effort, không được làm fail request cập nhật cấu hình.
                }
            }

            return true;
        }
    }
}
