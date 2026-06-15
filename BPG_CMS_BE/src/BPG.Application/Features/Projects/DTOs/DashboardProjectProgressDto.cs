namespace BPG.Application.Features.Projects.DTOs;

public class DashboardProjectProgressDto
{
    public long ProjectId { get; set; }
    public string ProjectName { get; set; }
    public string Address { get; set; }
    public int Progress { get; set; }
}
