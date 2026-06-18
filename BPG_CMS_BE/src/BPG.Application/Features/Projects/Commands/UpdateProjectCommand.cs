namespace BPG.Application.Features.Projects.Commands;

using BPG.Application.Features.Projects.DTOs;
using MediatR;
using System;

public class UpdateProjectCommand : IRequest<ProjectDto>
{
    public long ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public DateOnly PlannedStart { get; set; }
    public DateOnly PlannedEnd { get; set; }
}
