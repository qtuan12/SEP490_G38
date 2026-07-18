using BPG.Application.DTOs.MaterialConversions;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialConversions.Commands;

public record SyncMaterialConversionsCommand(long MaterialId, List<MaterialConversionRequest> Conversions) : IRequest<bool>;
