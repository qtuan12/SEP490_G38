namespace BPG.Domain.Entities;

public class ProjectTask : BaseEntity
{
    public long TaskId { get; set; }
    public long PhaseId { get; set; }
    public long? ParentTaskId { get; set; }
    public long? IncidentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "New";
    public byte ProgressPercent { get; set; } = 0;
    public string? ObsoleteReason { get; set; }
    public bool IsLocked { get; set; } = false;
    public decimal? Weight { get; set; }

    public Phase Phase { get; set; } = null!;
    public ProjectTask? ParentTask { get; set; }
    public Incident? LinkedIncident { get; set; }
    public ICollection<ProjectTask> SubTasks { get; set; } = new List<ProjectTask>();
    public ICollection<TaskAssignee> Assignees { get; set; } = new List<TaskAssignee>();
    public ICollection<DailyLog> DailyLogs { get; set; } = new List<DailyLog>();
    public ICollection<TaskProgressLog> ProgressLogs { get; set; } = new List<TaskProgressLog>();
    public ICollection<TaskDependency> Dependencies { get; set; } = new List<TaskDependency>();
    public ICollection<TaskDependency> Dependents { get; set; } = new List<TaskDependency>();
}
