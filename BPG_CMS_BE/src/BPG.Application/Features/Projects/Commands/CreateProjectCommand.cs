namespace BPG.Application.Features.Projects.Commands;


using BPG.Application.Features.Projects.DTOs;
using MediatR;
using System;
using System.Collections.Generic;

public class CreateProjectCommand : IRequest<ProjectDto>
{
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public DateOnly PlannedStart { get; set; }
    public DateOnly PlannedEnd { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
}
