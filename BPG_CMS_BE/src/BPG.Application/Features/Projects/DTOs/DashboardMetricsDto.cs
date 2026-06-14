namespace BPG.Application.Features.Projects.DTOs;

public class DashboardMetricsDto
{
    public int TotalProjects { get; set; }
    public int DraftProjects { get; set; }
    public int ActiveProjects { get; set; }
    public int PausedProjects { get; set; }
    public int CompletedProjects { get; set; }
    public int ClosedProjects { get; set; }
}
