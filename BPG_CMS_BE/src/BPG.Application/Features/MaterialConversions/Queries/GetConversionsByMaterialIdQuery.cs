using BPG.Application.Common.Attributes;
using BPG.Application.DTOs.MaterialConversions;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialConversions.Queries;

[Cacheable(DurationSeconds = 300)]
public record GetConversionsByMaterialIdQuery(long MaterialId) : IRequest<List<MaterialConversionDto>>;
