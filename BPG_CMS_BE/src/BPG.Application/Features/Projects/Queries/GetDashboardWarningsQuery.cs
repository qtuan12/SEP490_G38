using MediatR;
using BPG.Application.Features.Projects.DTOs;
using System.Collections.Generic;

namespace BPG.Application.Features.Projects.Queries;

public class GetDashboardWarningsQuery : IRequest<List<DashboardWarningDto>>
{
}
