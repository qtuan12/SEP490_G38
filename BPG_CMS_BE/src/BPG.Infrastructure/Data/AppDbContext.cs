using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Auth / Security
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OtpToken> OtpTokens => Set<OtpToken>();

    // Config
    public DbSet<SystemConfig> SystemConfigs => Set<SystemConfig>();

    // Project Management
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Phase> Phases => Set<Phase>();
    public DbSet<ProjectTask> Tasks => Set<ProjectTask>();
    public DbSet<TaskAssignee> TaskAssignees => Set<TaskAssignee>();
    public DbSet<DailyLog> DailyLogs => Set<DailyLog>();
    public DbSet<TaskProgressLog> TaskProgressLogs => Set<TaskProgressLog>();
    public DbSet<PhaseAcceptance> PhaseAcceptances => Set<PhaseAcceptance>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();

    // Incidents
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<Comment> Comments => Set<Comment>();

    // Material Master Data
    public DbSet<MaterialCategory> MaterialCategories => Set<MaterialCategory>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<MaterialCatalog> MaterialCatalogs => Set<MaterialCatalog>();
    public DbSet<MaterialConversion> MaterialConversions => Set<MaterialConversion>();

    // BOQ & Material Requests
    public DbSet<BOQItem> BOQItems => Set<BOQItem>();
    public DbSet<MaterialRequest> MaterialRequests => Set<MaterialRequest>();
    public DbSet<MaterialRequestItem> MaterialRequestItems => Set<MaterialRequestItem>();

    // Procurement
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<PurchaseOrderRequest> PurchaseOrderRequests => Set<PurchaseOrderRequest>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptItem> GoodsReceiptItems => Set<GoodsReceiptItem>();

    // Inventory
    public DbSet<CurrentInventory> CurrentInventories => Set<CurrentInventory>();
    public DbSet<MaterialIssuance> MaterialIssuances => Set<MaterialIssuance>();
    public DbSet<MaterialIssuanceItem> MaterialIssuanceItems => Set<MaterialIssuanceItem>();
    public DbSet<MaterialReturn> MaterialReturns => Set<MaterialReturn>();
    public DbSet<MaterialReturnItem> MaterialReturnItems => Set<MaterialReturnItem>();

    // Surplus Management
    public DbSet<SurplusRequest> SurplusRequests => Set<SurplusRequest>();
    public DbSet<SurplusRequestItem> SurplusRequestItems => Set<SurplusRequestItem>();
    public DbSet<SurplusReturnSupplier> SurplusReturnSuppliers => Set<SurplusReturnSupplier>();
    public DbSet<SurplusTransfer> SurplusTransfers => Set<SurplusTransfer>();
    public DbSet<SurplusLiquidation> SurplusLiquidations => Set<SurplusLiquidation>();

    // Adjustments
    public DbSet<InventoryAdjustment> InventoryAdjustments => Set<InventoryAdjustment>();
    public DbSet<AdjustmentItem> AdjustmentItems => Set<AdjustmentItem>();

    // Direct Purchase
    public DbSet<DirectPurchaseRequest> DirectPurchaseRequests => Set<DirectPurchaseRequest>();
    public DbSet<DirectPurchaseItem> DirectPurchaseItems => Set<DirectPurchaseItem>();

    // Cross-cutting
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global soft delete filter for all BaseEntity
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
            .Where(e => typeof(BPG.Domain.Entities.BaseEntity).IsAssignableFrom(e.ClrType)))
        {
            var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
            var property = System.Linq.Expressions.Expression.Property(parameter, nameof(BPG.Domain.Entities.BaseEntity.IsDeleted));
            var condition = System.Linq.Expressions.Expression.Equal(property, System.Linq.Expressions.Expression.Constant(false));
            var lambda = System.Linq.Expressions.Expression.Lambda(condition, parameter);
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
        }

        // Apply decimal precision globally
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    property.SetPrecision(18);
                    property.SetScale(4);
                }
            }
        }

        // PKs
        modelBuilder.Entity<User>().HasKey(x => x.UserId);
        modelBuilder.Entity<Role>().HasKey(x => x.RoleId);
        modelBuilder.Entity<RefreshToken>().HasKey(x => x.RefreshTokenId);
        modelBuilder.Entity<OtpToken>().HasKey(x => x.OtpTokenId);
        modelBuilder.Entity<SystemConfig>().HasKey(x => x.ConfigKey);
        modelBuilder.Entity<Project>().HasKey(x => x.ProjectId);
        modelBuilder.Entity<ProjectMember>().HasKey(x => x.ProjectMemberId);
        modelBuilder.Entity<Phase>().HasKey(x => x.PhaseId);
        modelBuilder.Entity<ProjectTask>().HasKey(x => x.TaskId);
        modelBuilder.Entity<DailyLog>().HasKey(x => x.LogId);
        modelBuilder.Entity<TaskProgressLog>().HasKey(x => x.TaskProgressLogId);
        modelBuilder.Entity<PhaseAcceptance>().HasKey(x => x.AcceptanceId);
        modelBuilder.Entity<TaskDependency>().HasKey(x => x.TaskDependencyId);
        modelBuilder.Entity<Incident>().HasKey(x => x.IncidentId);
        modelBuilder.Entity<Comment>().HasKey(x => x.CommentId);
        modelBuilder.Entity<MaterialCategory>().HasKey(x => x.CategoryId);
        modelBuilder.Entity<Unit>().HasKey(x => x.UnitId);
        modelBuilder.Entity<Supplier>().HasKey(x => x.SupplierId);
        modelBuilder.Entity<MaterialCatalog>().HasKey(x => x.MaterialId);
        modelBuilder.Entity<BOQItem>().HasKey(x => x.BOQItemId);
        modelBuilder.Entity<MaterialRequest>().HasKey(x => x.RequestId);
        modelBuilder.Entity<MaterialRequestItem>().HasKey(x => x.RequestItemId);
        modelBuilder.Entity<PurchaseOrder>().HasKey(x => x.POId);
        modelBuilder.Entity<PurchaseOrderItem>().HasKey(x => x.POItemId);
        modelBuilder.Entity<GoodsReceipt>().HasKey(x => x.ReceiptId);
        modelBuilder.Entity<GoodsReceiptItem>().HasKey(x => x.ReceiptItemId);
        modelBuilder.Entity<CurrentInventory>().HasKey(x => x.InventoryId);
        modelBuilder.Entity<MaterialIssuance>().HasKey(x => x.MaterialIssuanceId);
        modelBuilder.Entity<MaterialIssuanceItem>().HasKey(x => x.IssuanceItemId);
        modelBuilder.Entity<MaterialReturn>().HasKey(x => x.MaterialReturnId);
        modelBuilder.Entity<MaterialReturnItem>().HasKey(x => x.ReturnItemId);
        modelBuilder.Entity<SurplusRequest>().HasKey(x => x.SurplusRequestId);
        modelBuilder.Entity<SurplusRequestItem>().HasKey(x => x.SurplusRequestItemId);
        modelBuilder.Entity<SurplusReturnSupplier>().HasKey(x => x.SurplusReturnSupplierId);
        modelBuilder.Entity<SurplusTransfer>().HasKey(x => x.SurplusTransferId);
        modelBuilder.Entity<SurplusLiquidation>().HasKey(x => x.SurplusLiquidationId);
        modelBuilder.Entity<InventoryAdjustment>().HasKey(x => x.AdjustmentId);
        modelBuilder.Entity<AdjustmentItem>().HasKey(x => x.AdjustmentItemId);
        modelBuilder.Entity<DirectPurchaseRequest>().HasKey(x => x.DirectPurchaseId);
        modelBuilder.Entity<DirectPurchaseItem>().HasKey(x => x.DirectPurchaseItemId);
        modelBuilder.Entity<Attachment>().HasKey(x => x.AttachmentId);
        modelBuilder.Entity<Notification>().HasKey(x => x.NotificationId);
        modelBuilder.Entity<InventoryTransaction>().HasKey(x => x.TransactionId);

        // Composite PKs
        modelBuilder.Entity<UserRole>().HasKey(x => new { x.UserId, x.RoleId });
        modelBuilder.Entity<TaskAssignee>().HasKey(x => new { x.TaskId, x.UserId });

        // MaterialConversion composite PK
        modelBuilder.Entity<MaterialConversion>().HasKey(x => new { x.MaterialId, x.AlternativeUnitId });
        modelBuilder.Entity<MaterialConversion>()
            .Property(x => x.ConversionRate)
            .HasPrecision(18, 6);
        modelBuilder.Entity<MaterialConversion>()
            .HasOne(x => x.Material)
            .WithMany(x => x.Conversions)
            .HasForeignKey(x => x.MaterialId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MaterialConversion>()
            .HasOne(x => x.AlternativeUnit)
            .WithMany(x => x.AlternativeConversions)
            .HasForeignKey(x => x.AlternativeUnitId)
            .OnDelete(DeleteBehavior.Restrict);

        // CurrentInventory unique + rowversion + precision
        modelBuilder.Entity<CurrentInventory>()
            .HasIndex(x => new { x.ProjectId, x.MaterialId, x.UnitId })
            .IsUnique();
        modelBuilder.Entity<CurrentInventory>()
            .Property(x => x.RowVersion)
            .IsRowVersion();
        modelBuilder.Entity<CurrentInventory>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<CurrentInventory>()
            .Property(x => x.ReservedQuantity).HasPrecision(18, 3);

        // Unique indexes
        modelBuilder.Entity<User>().HasIndex(x => x.Email).IsUnique();
        modelBuilder.Entity<Role>().HasIndex(x => x.RoleName).IsUnique();
        modelBuilder.Entity<MaterialCatalog>().HasIndex(x => x.Code).IsUnique();
        modelBuilder.Entity<Unit>().HasIndex(x => x.UnitCode).IsUnique();

        // ProjectMember unique (ProjectId, UserId)
        modelBuilder.Entity<ProjectMember>()
            .HasIndex(x => new { x.ProjectId, x.UserId })
            .IsUnique();

        // MaterialRequestItem unique (RequestId, MaterialId) + precision
        modelBuilder.Entity<MaterialRequestItem>()
            .HasIndex(x => new { x.RequestId, x.MaterialId })
            .IsUnique();
        modelBuilder.Entity<MaterialRequestItem>()
            .Property(x => x.Quantity)
            .HasPrecision(18, 3);
        modelBuilder.Entity<MaterialRequestItem>()
            .Property(x => x.ConversionRate)
            .HasPrecision(18, 6);

        // BOQItem unique (PhaseId, MaterialId) + precision
        modelBuilder.Entity<BOQItem>()
            .HasIndex(x => new { x.PhaseId, x.MaterialId })
            .IsUnique();
        modelBuilder.Entity<BOQItem>()
            .Property(x => x.Quantity)
            .HasPrecision(18, 3);
        modelBuilder.Entity<BOQItem>()
            .Property(x => x.ConversionRate)
            .HasPrecision(18, 6);

        // Self-referencing
        modelBuilder.Entity<ProjectTask>()
            .HasOne(t => t.ParentTask)
            .WithMany(t => t.SubTasks)
            .HasForeignKey(t => t.ParentTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        // Task Dependencies
        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.Task)
            .WithMany(t => t.Dependencies)
            .HasForeignKey(td => td.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.Predecessor)
            .WithMany(t => t.Dependents)
            .HasForeignKey(td => td.PredecessorTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        // Incident - ReworkTask self-ref
        modelBuilder.Entity<Incident>()
            .HasOne(i => i.ReworkTask)
            .WithMany()
            .HasForeignKey(i => i.ReworkTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Incident>()
            .HasOne(i => i.Task)
            .WithMany()
            .HasForeignKey(i => i.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Incident>()
            .HasOne(i => i.Reporter)
            .WithMany()
            .HasForeignKey(i => i.ReportedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Incident>()
            .HasOne(i => i.Reviewer)
            .WithMany()
            .HasForeignKey(i => i.ReviewedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Incident>()
            .HasOne(i => i.Phase)
            .WithMany()
            .HasForeignKey(i => i.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);

        // Comment cascade delete from DailyLog
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.DailyLog)
            .WithMany(d => d.Comments)
            .HasForeignKey(c => c.LogId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        // DailyLog
        modelBuilder.Entity<DailyLog>()
            .HasOne(d => d.Creator)
            .WithMany()
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // PhaseAcceptance
        modelBuilder.Entity<PhaseAcceptance>()
            .HasIndex(p => p.PhaseId);

        modelBuilder.Entity<PhaseAcceptance>()
            .HasOne(p => p.Acceptor)
            .WithMany()
            .HasForeignKey(p => p.AcceptedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // ProjectTask IncidentId
        modelBuilder.Entity<ProjectTask>()
            .HasOne(t => t.LinkedIncident)
            .WithMany()
            .HasForeignKey(t => t.IncidentId)
            .OnDelete(DeleteBehavior.Restrict);

        // MaterialRequest
        modelBuilder.Entity<MaterialRequest>()
            .HasOne(m => m.Checker)
            .WithMany()
            .HasForeignKey(m => m.CheckedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MaterialRequest>()
            .HasOne(m => m.Approver)
            .WithMany()
            .HasForeignKey(m => m.ApprovedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // PurchaseOrderItem - explicit FK to avoid shadow property PurchaseOrderPOId
        modelBuilder.Entity<PurchaseOrderItem>()
            .HasOne(x => x.PurchaseOrder)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.POId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PurchaseOrderItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<PurchaseOrderItem>()
            .Property(x => x.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<PurchaseOrderItem>()
            .Property(x => x.LineTotal).HasPrecision(18, 2);
        modelBuilder.Entity<PurchaseOrderItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // GoodsReceipt - explicit FK to avoid shadow property PurchaseOrderPOId
        modelBuilder.Entity<GoodsReceipt>()
            .HasOne(x => x.PurchaseOrder)
            .WithMany(x => x.GoodsReceipts)
            .HasForeignKey(x => x.POId)
            .OnDelete(DeleteBehavior.Cascade);

        // PurchaseOrder
        modelBuilder.Entity<PurchaseOrder>()
            .Property(x => x.TotalAmount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<PurchaseOrder>()
            .HasOne(x => x.Request)
            .WithMany()
            .HasForeignKey(x => x.RequestId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // PurchaseOrderRequest junction (many-to-many PO ↔ MaterialRequest)
        modelBuilder.Entity<PurchaseOrderRequest>()
            .HasKey(x => new { x.POId, x.RequestId });
        modelBuilder.Entity<PurchaseOrderRequest>()
            .HasOne(x => x.PurchaseOrder)
            .WithMany(x => x.RequestLinks)
            .HasForeignKey(x => x.POId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PurchaseOrderRequest>()
            .HasOne(x => x.MaterialRequest)
            .WithMany()
            .HasForeignKey(x => x.RequestId)
            .OnDelete(DeleteBehavior.Restrict);

        // GoodsReceiptItem precision
        modelBuilder.Entity<GoodsReceiptItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<GoodsReceiptItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // MaterialIssuanceItem precision
        modelBuilder.Entity<MaterialIssuanceItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<MaterialIssuanceItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // MaterialReturnItem precision
        modelBuilder.Entity<MaterialReturnItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<MaterialReturnItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // SurplusRequestItem unique (SurplusRequestId, MaterialId) + precision
        modelBuilder.Entity<SurplusRequestItem>()
            .HasIndex(x => new { x.SurplusRequestId, x.MaterialId })
            .IsUnique();
        modelBuilder.Entity<SurplusRequestItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<SurplusRequestItem>()
            .Property(x => x.ProcessedQuantity).HasPrecision(18, 3);
        modelBuilder.Entity<SurplusRequestItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // SurplusReturnSupplier precision
        modelBuilder.Entity<SurplusReturnSupplier>()
            .Property(x => x.ReturnQuantity).HasPrecision(18, 3);
        modelBuilder.Entity<SurplusReturnSupplier>()
            .Property(x => x.RefundAmount).HasPrecision(18, 2);

        // SurplusTransfer precision
        modelBuilder.Entity<SurplusTransfer>()
            .Property(x => x.TransferQuantity).HasPrecision(18, 3);

        // SurplusTransfer FKs
        modelBuilder.Entity<SurplusTransfer>()
            .HasOne(s => s.FromProject)
            .WithMany()
            .HasForeignKey(s => s.FromProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SurplusTransfer>()
            .HasOne(s => s.ToProject)
            .WithMany()
            .HasForeignKey(s => s.ToProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SurplusTransfer>()
            .HasOne(s => s.Approver)
            .WithMany()
            .HasForeignKey(s => s.ApprovedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SurplusTransfer>()
            .HasOne(s => s.Dispatcher)
            .WithMany()
            .HasForeignKey(s => s.DispatchedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SurplusTransfer>()
            .HasOne(s => s.Receiver)
            .WithMany()
            .HasForeignKey(s => s.ReceivedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // SurplusLiquidation precision
        modelBuilder.Entity<SurplusLiquidation>()
            .Property(x => x.LiquidationQuantity).HasPrecision(18, 3);
        modelBuilder.Entity<SurplusLiquidation>()
            .Property(x => x.TotalAmount).HasPrecision(18, 2);

        // AdjustmentItem unique (AdjustmentId, MaterialId) + precision
        modelBuilder.Entity<AdjustmentItem>()
            .HasIndex(x => new { x.AdjustmentId, x.MaterialId })
            .IsUnique();
        modelBuilder.Entity<AdjustmentItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<AdjustmentItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);

        // InventoryAdjustment
        modelBuilder.Entity<InventoryAdjustment>()
            .HasOne(i => i.Phase)
            .WithMany()
            .HasForeignKey(i => i.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<InventoryAdjustment>()
            .HasOne(i => i.Approver)
            .WithMany()
            .HasForeignKey(i => i.ApprovedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // DirectPurchaseItem - explicit FK to avoid shadow property DirectPurchaseRequestDirectPurchaseId
        modelBuilder.Entity<DirectPurchaseItem>()
            .HasOne(x => x.DirectPurchaseRequest)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.DirectPurchaseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<DirectPurchaseItem>()
            .HasIndex(x => new { x.DirectPurchaseId, x.MaterialId })
            .IsUnique();
        modelBuilder.Entity<DirectPurchaseItem>()
            .Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<DirectPurchaseItem>()
            .Property(x => x.ConversionRate).HasPrecision(18, 6);
        modelBuilder.Entity<DirectPurchaseItem>()
            .Property(x => x.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<DirectPurchaseItem>()
            .Property(x => x.LineTotal).HasPrecision(18, 2);

        // DirectPurchaseRequest
        modelBuilder.Entity<DirectPurchaseRequest>()
            .Property(x => x.TotalAmount).HasPrecision(18, 2);

        modelBuilder.Entity<DirectPurchaseRequest>()
            .HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DirectPurchaseRequest>()
            .HasOne(d => d.Phase)
            .WithMany()
            .HasForeignKey(d => d.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DirectPurchaseRequest>()
            .HasOne(d => d.Task)
            .WithMany()
            .HasForeignKey(d => d.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DirectPurchaseRequest>()
            .HasOne(d => d.Requester)
            .WithMany()
            .HasForeignKey(d => d.RequestedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DirectPurchaseRequest>()
            .HasOne(d => d.Auditor)
            .WithMany()
            .HasForeignKey(d => d.AuditedBy)
            .OnDelete(DeleteBehavior.Restrict);

        // MaterialCatalog BaseUnit -> Unit (int FK)
        modelBuilder.Entity<MaterialCatalog>()
            .HasOne(m => m.BaseUnit)
            .WithMany(u => u.MaterialsAsBaseUnit)
            .HasForeignKey(m => m.BaseUnitId)
            .OnDelete(DeleteBehavior.Restrict);

        // InventoryTransaction precision
        modelBuilder.Entity<InventoryTransaction>()
            .Property(x => x.QuantityChange).HasPrecision(18, 3);
        modelBuilder.Entity<InventoryTransaction>()
            .Property(x => x.BalanceAfter).HasPrecision(18, 3);

        // Seed data: Roles
        // NOTE: ProjectLeader không phải một role riêng.
        //       Leadership được xác định bởi IsLeader=true trong bảng ProjectMember.
        //       Mọi leader đều có role SiteEngineer (RoleId=3).
        modelBuilder.Entity<Role>().HasData(
            new Role { RoleId = 1, RoleName = "Admin",            Description = "Quản trị viên hệ thống" },
            new Role { RoleId = 2, RoleName = "TechnicalManager", Description = "Trưởng phòng kỹ thuật" },
            new Role { RoleId = 3, RoleName = "SiteEngineer",     Description = "Nhân viên kỹ thuật hiện trường" },
            new Role { RoleId = 4, RoleName = "Accountant",       Description = "Kế toán" },
            new Role { RoleId = 5, RoleName = "Director",         Description = "Giám đốc" }
        );
    }
}
