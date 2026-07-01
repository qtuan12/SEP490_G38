using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.SystemConfigs
{
    public class UpdateSystemConfigCommand : IRequest<bool>
    {
        public string ConfigKey { get; init; } = string.Empty;
        public string ConfigValue { get; init; } = string.Empty;
    }

    public class UpdateSystemConfigCommandValidator : AbstractValidator<UpdateSystemConfigCommand>
    {
        public UpdateSystemConfigCommandValidator()
        {
            RuleFor(x => x.ConfigKey).NotEmpty();
            RuleFor(x => x.ConfigValue).NotEmpty().WithMessage("Giá trị cấu hình không được để trống.");
        }
    }

    public class UpdateSystemConfigCommandHandler : IRequestHandler<UpdateSystemConfigCommand, bool>
    {
        private readonly IUnitOfWork _uow;

        public UpdateSystemConfigCommandHandler(IUnitOfWork uow) => _uow = uow;

        public async Task<bool> Handle(UpdateSystemConfigCommand request, CancellationToken cancellationToken)
        {
            var config = await _uow.Repository<SystemConfig>().Query()
                .FirstOrDefaultAsync(c => c.ConfigKey == request.ConfigKey, cancellationToken)
                ?? throw new NotFoundException(nameof(SystemConfig), request.ConfigKey);

            // Validate based on DataType
            if (config.DataType == "number" || config.DataType == "percentage")
            {
                if (!decimal.TryParse(request.ConfigValue, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var numVal) || numVal < 0)
                    throw new BusinessException("ERR_INVALID_CONFIG_VALUE",
                        $"Giá trị '{request.ConfigValue}' không hợp lệ cho tham số kiểu số.");

                if (config.DataType == "percentage" && numVal > 100)
                    throw new BusinessException("ERR_INVALID_CONFIG_VALUE",
                        "Giá trị phần trăm không được vượt quá 100.");
            }

            config.ConfigValue = request.ConfigValue.Trim();
            await _uow.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
