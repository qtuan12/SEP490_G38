using System;
using System.Linq;
using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Constants;

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseSqlServer("Server=localhost;Database=BPG_CMS;Trusted_Connection=True;TrustServerCertificate=True;");
using (var db = new AppDbContext(optionsBuilder.Options))
{
    var tasks = db.ProjectTasks
        .Include(t => t.Phase)
        .Where(t => t.Phase.ProjectId == 6 && t.Status != TaskStatus.Obsolete)
        .Select(t => new { t.TaskId, t.ParentTaskId, t.StartDate, t.EndDate, t.ProgressPercent })
        .ToList();

    Console.WriteLine($"Total tasks in project 6: {tasks.Count}");
    
    var leafTasks = tasks.Where(t => !tasks.Any(c => c.ParentTaskId == t.TaskId)).ToList();
    Console.WriteLine($"Leaf tasks: {leafTasks.Count}");

    double totalWeightedProgress = 0;
    double totalWeight = 0;
    foreach (var t in leafTasks)
    {
        var duration = (t.EndDate.ToDateTime(TimeOnly.MinValue) - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
        double weight = duration > 0 ? duration : 1;
        totalWeightedProgress += t.ProgressPercent * weight;
        totalWeight += weight;
        Console.WriteLine($"- Task {t.TaskId}: Progress={t.ProgressPercent}, Duration/Weight={weight}");
    }
    
    int projectProgress = 0;
    if (totalWeight > 0)
    {
        projectProgress = (int)Math.Round(totalWeightedProgress / totalWeight);
    }
    Console.WriteLine($"Calculated Project Progress: {projectProgress}%");
}
