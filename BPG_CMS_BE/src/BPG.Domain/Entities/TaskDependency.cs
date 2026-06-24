namespace BPG.Domain.Entities;

public class TaskDependency
{
    public long TaskDependencyId { get; set; }
    public long TaskId { get; set; }          // Successor task
    public long PredecessorTaskId { get; set; } // Predecessor task
    
    public ProjectTask Task { get; set; } = null!;
    public ProjectTask Predecessor { get; set; } = null!;
}
