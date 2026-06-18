using MediatR;

namespace BPG.Application.Features.MaterialCatalogs.Commands;

public record DeleteMaterialCatalogCommand(long MaterialId) : IRequest<bool>;
