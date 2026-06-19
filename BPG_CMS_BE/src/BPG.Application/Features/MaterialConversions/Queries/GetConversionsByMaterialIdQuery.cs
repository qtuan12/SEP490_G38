using BPG.Application.Features.MaterialConversions.DTOs;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialConversions.Queries;

public record GetConversionsByMaterialIdQuery(long MaterialId) : IRequest<List<MaterialConversionDto>>;
