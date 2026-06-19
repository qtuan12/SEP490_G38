using BPG.Application.Features.Wbs.DTOs;
using MediatR;

namespace BPG.Application.Features.Wbs.Queries;

public record GetWbsTreeQuery(long ProjectId) : IRequest<WbsTreeDto>;
