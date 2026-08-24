using BPG.Application.DTOs.Wbs;
using MediatR;
using Microsoft.AspNetCore.Http;

namespace BPG.Application.Features.Wbs.Commands;

public record PreviewWbsImportCommand(long ProjectId, IFormFile File) : IRequest<PreviewWbsImportResultDto>;
