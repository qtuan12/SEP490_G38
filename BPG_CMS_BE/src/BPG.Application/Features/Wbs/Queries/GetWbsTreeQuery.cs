using BPG.Application.DTOs.Wbs;
using MediatR;

namespace BPG.Application.Features.Wbs.Queries;

public record GetWbsTreeQuery(long ProjectId) : IRequest<WbsTreeDto>;
