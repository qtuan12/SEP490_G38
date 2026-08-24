using BPG.Application.Features.MaterialRequests.Commands;
using BPG.Domain.Constants;
using FluentValidation;

namespace BPG.Application.Features.MaterialRequests.Validators;

public sealed class ProcessMaterialRequestByAccountantCommandValidator
    : AbstractValidator<ProcessMaterialRequestByAccountantCommand>
{
    public ProcessMaterialRequestByAccountantCommandValidator()
    {
        RuleFor(command => command.RequestId)
            .GreaterThan(0)
            .WithMessage("Mã yêu cầu vật tư không hợp lệ.");

        RuleFor(command => command.Decision)
            .NotEmpty()
            .Must(MaterialRequestProcurementDecision.IsValid)
            .WithMessage("Phương án cung ứng không hợp lệ.");

        RuleFor(command => command.Note)
            .NotEmpty()
            .Must(note => !string.IsNullOrWhiteSpace(note) && note.Trim().Length >= 5)
            .WithMessage("Ghi chú phải có ít nhất 5 ký tự.")
            .MaximumLength(1000)
            .WithMessage("Ghi chú tối đa 1000 ký tự.");
    }
}
