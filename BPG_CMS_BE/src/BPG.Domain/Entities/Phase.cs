namespace BPG.Domain.Entities;

public class Phase : BaseEntity
{
    public long PhaseId { get; set; }
    public long ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Status { get; set; } = "Draft";

    public Project Project { get; set; } = null!;
    public ICollection<ProjectTask> Tasks { get; set; } = new List<ProjectTask>();
    public ICollection<PhaseAcceptance> Acceptances { get; set; } = new List<PhaseAcceptance>();
    public ICollection<BOQItem> BOQItems { get; set; } = new List<BOQItem>();
    public ICollection<MaterialRequest> MaterialRequests { get; set; } = new List<MaterialRequest>();
}
