using MediatR;

namespace BPG.Application.Features.Wbs.Queries;

public record GetWbsImportTemplateQuery() : IRequest<byte[]>;
