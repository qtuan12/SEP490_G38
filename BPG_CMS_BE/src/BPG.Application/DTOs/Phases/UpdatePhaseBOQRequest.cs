using BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Phases;

public class UpdatePhaseBOQRequest
{
    public List<BOQItemInput> Items { get; set; } = new();
}
