using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using TaskStatusConstants = BPG.Domain.Constants.TaskStatus;
using UserRoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Infrastructure.Data;

/// <summary>
/// Demo seed for the 26/08/2026 defense build.
/// Design goals:
/// - deterministic, recent dates around August 2026;
/// - realistic construction units and material conversions;
/// - 10 projects across Draft / InProgress / Paused / Completed / Closed;
/// - one main project (Đảo Dừa 3) with a coherent end-to-end demo lifecycle;
/// - every DbSet in AppDbContext has representative data (including expired auth tokens);
/// - stock is always stored in each material's base unit and every seeded movement writes a ledger row.
///
/// IMPORTANT: run this seed on a clean database. If an older project seed is detected, the seeder
/// intentionally fails instead of silently mixing old and new demo data.
/// </summary>
public static class DbSeeder
{
    private const string MainProjectName = "CÔNG TRÌNH TẠI ĐẢO DỪA 3 – VINHOMES OCEAN PARK 2";
    private const string AssessmentReferenceReason =
        "Rà soát toàn bộ tồn kho dương để xử lý hoặc điều phối sang dự án khác khi có nhu cầu phù hợp.";
    private static readonly DateOnly DemoDate = new(2026, 8, 20);
    private static readonly DateTime SeedUtc = new(2026, 8, 20, 2, 0, 0, DateTimeKind.Utc);

    // Ảnh thật, truy cập công khai bằng HTTPS. Seed có thể dùng lặp lại cùng một ảnh theo nhóm
    // để tránh các URL /seed/... không tồn tại làm giao diện hiện ảnh hỏng.
    private const string SeedImageConstruction =
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80";
    private const string SeedImageRenovation =
        "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80";
    private const string SeedImageDelivery =
        "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1200&q=80";
    private const string SeedImageConcrete =
        "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80";

    private sealed record MasterData(
        Dictionary<string, Unit> Units,
        Dictionary<string, MaterialCategory> Categories,
        Dictionary<string, Supplier> Suppliers);

    private sealed record ProjectBundle(
        Project Project,
        User Leader,
        User EngineerA,
        User EngineerB,
        List<Phase> Phases,
        Dictionary<long, List<ProjectTask>> TasksByPhase);

    private sealed record ProjectSeedSpec(
        string Name,
        string Address,
        string Kind,
        string Status,
        DateOnly Start,
        DateOnly End,
        string? PauseReason = null,
        int FloorCount = 1,
        decimal ScaleFactor = 1m);

    private sealed record BoqLine(string MaterialCode, string UnitCode, decimal Quantity);

    private sealed record AssessmentSupplyLine(
        string MaterialCode,
        string UnitCode,
        decimal Quantity,
        decimal UnitPrice);

    private sealed record WbsGroup(
        string Name,
        string Description,
        string[] Children,
        bool IsOutsourced = false,
        string? OutsourcedTeamName = null);

    public static async Task SeedAsync(AppDbContext context)
    {
        await context.Database.MigrateAsync();

        // Do not silently mix the old seeder with this defense dataset.
        if (await context.Projects.AnyAsync())
        {
            var hasCurrentSeed = await context.Projects.AnyAsync(p => p.Name == MainProjectName)
                && await context.MaterialCatalogs.AnyAsync(m => m.Code == "BT-TUOI-M300")
                && await context.MaterialCatalogs.AnyAsync(m => m.Code == "XM-ROI-PCB40")
                && await context.MaterialCatalogs.AnyAsync(m => m.Code == "PVC-D114")
                && await context.Units.AnyAsync(u => u.UnitCode == "VIEN" && u.UnitName == "Viên")
                && await context.PurchaseOrders.AnyAsync(p => p.PONumber == "PO-MO-LAO-202510-01");

            if (hasCurrentSeed)
            {
                var hasAssessmentSeed =
                    await context.PurchaseOrders.AnyAsync(po => po.PONumber == "PO-DEMO-TARGET-STOCK-V1") &&
                    await context.PurchaseOrders.AnyAsync(po => po.PONumber == "PO-DEMO-COMMON-MATERIALS-01") &&
                    await context.PurchaseOrders.AnyAsync(po => po.PONumber == "PO-DEMO-COMMON-MATERIALS-02");
                if (!hasAssessmentSeed)
                {
                    throw new InvalidOperationException(
                        "Database đang chứa phiên bản seed YCVT cũ. Hãy reset database và seed lại để dựng đúng chuỗi BOQ -> YCVT -> PO -> GR/tồn/surplus và coverage 5/6 vật tư demo.");
                }

                await SeedCompletedProjectReportShowcaseAsync(context);
                await NormalizeAndValidateMaterialRequestSeedAsync(context);
                return;
            }

            throw new InvalidOperationException(
                "Database đang chứa seed cũ. Hãy drop/reset database rồi chạy migration + seed lại để tránh trộn dữ liệu demo cũ và mới.");
        }

        var users = await SeedAuthAsync(context);
        var adminId = users["admin@bpg.com"].UserId;

        var master = await SeedMasterDataAsync(context, adminId);
        var materials = await SeedMaterialsAsync(context, master, adminId);
        var projects = await SeedProjectsWbsAndBoqAsync(context, users, master, materials);

        await SeedMainDemoLifecycleAsync(context, projects, users, master, materials);
        await SeedMaterialRequestAssessmentScenariosAsync(context, projects, users, master, materials);
        await SeedCompletedMoLaoHistoryAsync(context, projects, users, master, materials);
        await SeedCompletedProjectSurplusAsync(context, projects, users, master, materials);
        await SeedCompletedProjectReportShowcaseAsync(context);
        await SeedNotificationsAsync(context, projects, users);
        await NormalizeAndValidateMaterialRequestSeedAsync(context);
    }

    // -------------------------------------------------------------------------
    // AUTH / USERS / ROLES / EXPIRED TOKENS
    // -------------------------------------------------------------------------
    private static async Task<Dictionary<string, User>> SeedAuthAsync(AppDbContext context)
    {
        var roleByName = await context.Roles.ToDictionaryAsync(x => x.RoleName);
        var result = new Dictionary<string, User>(StringComparer.OrdinalIgnoreCase);

        var seeds = new List<(string Email, string FullName, string Role, string Phone)>
        {
            ("admin@bpg.com",   "BPG - Quản trị viên",                 UserRoleConstants.Admin,            "0900 000 001"),
            ("giamdoc@bpg.com", "Bùi Giám Đốc",                       UserRoleConstants.Director,         "0900 000 002"),
            ("tpkt@bpg.com",    "Nguyễn Trưởng Phòng Kỹ Thuật",       UserRoleConstants.TechnicalManager, "0900 000 003"),
            ("ketoan@bpg.com",  "Hoàng Kế Toán",                      UserRoleConstants.Accountant,       "0900 000 004"),

            ("leader1@bpg.com",  "Trần Chỉ Huy 01", UserRoleConstants.SiteEngineer, "0910 000 101"),
            ("leader2@bpg.com",  "Phạm Chỉ Huy 02", UserRoleConstants.SiteEngineer, "0910 000 102"),
            ("leader3@bpg.com",  "Lê Chỉ Huy 03",   UserRoleConstants.SiteEngineer, "0910 000 103"),
            ("leader4@bpg.com",  "Đỗ Chỉ Huy 04",   UserRoleConstants.SiteEngineer, "0910 000 104"),
            ("leader5@bpg.com",  "Vũ Chỉ Huy 05",   UserRoleConstants.SiteEngineer, "0910 000 105"),
            ("leader6@bpg.com",  "Ngô Chỉ Huy 06",  UserRoleConstants.SiteEngineer, "0910 000 106"),
            ("leader7@bpg.com",  "Hoàng Chỉ Huy 07",UserRoleConstants.SiteEngineer, "0910 000 107"),
            ("leader8@bpg.com",  "Bùi Chỉ Huy 08",  UserRoleConstants.SiteEngineer, "0910 000 108"),
            ("leader9@bpg.com",  "Mai Chỉ Huy 09",  UserRoleConstants.SiteEngineer, "0910 000 109"),
            ("leader10@bpg.com", "Đặng Chỉ Huy 10", UserRoleConstants.SiteEngineer, "0910 000 110"),

            ("kysu1@bpg.com",  "Nguyễn Kỹ Sư 01", UserRoleConstants.SiteEngineer, "0920 000 201"),
            ("kysu2@bpg.com",  "Trần Kỹ Sư 02",   UserRoleConstants.SiteEngineer, "0920 000 202"),
            ("kysu3@bpg.com",  "Phạm Kỹ Sư 03",   UserRoleConstants.SiteEngineer, "0920 000 203"),
            ("kysu4@bpg.com",  "Lê Kỹ Sư 04",     UserRoleConstants.SiteEngineer, "0920 000 204"),
            ("kysu5@bpg.com",  "Đỗ Kỹ Sư 05",     UserRoleConstants.SiteEngineer, "0920 000 205"),
            ("kysu6@bpg.com",  "Vũ Kỹ Sư 06",     UserRoleConstants.SiteEngineer, "0920 000 206"),
            ("kysu7@bpg.com",  "Hoàng Kỹ Sư 07",  UserRoleConstants.SiteEngineer, "0920 000 207"),
            ("kysu8@bpg.com",  "Ngô Kỹ Sư 08",    UserRoleConstants.SiteEngineer, "0920 000 208"),
            ("kysu9@bpg.com",  "Đặng Kỹ Sư 09",   UserRoleConstants.SiteEngineer, "0920 000 209"),
            ("kysu10@bpg.com", "Bùi Kỹ Sư 10",    UserRoleConstants.SiteEngineer, "0920 000 210"),
            ("kysu11@bpg.com", "Mai Kỹ Sư 11",    UserRoleConstants.SiteEngineer, "0920 000 211"),
            ("kysu12@bpg.com", "Tạ Kỹ Sư 12",     UserRoleConstants.SiteEngineer, "0920 000 212"),
            ("kysu13@bpg.com", "Chu Kỹ Sư 13",    UserRoleConstants.SiteEngineer, "0920 000 213"),
            ("kysu14@bpg.com", "Phan Kỹ Sư 14",   UserRoleConstants.SiteEngineer, "0920 000 214"),
            ("kysu15@bpg.com", "Hồ Kỹ Sư 15",     UserRoleConstants.SiteEngineer, "0920 000 215"),
            ("kysu16@bpg.com", "Trịnh Kỹ Sư 16",  UserRoleConstants.SiteEngineer, "0920 000 216"),
            ("kysu17@bpg.com", "Cao Kỹ Sư 17",    UserRoleConstants.SiteEngineer, "0920 000 217"),
            ("kysu18@bpg.com", "Lương Kỹ Sư 18",  UserRoleConstants.SiteEngineer, "0920 000 218"),
            ("kysu19@bpg.com", "Nguyễn Kỹ Sư 19", UserRoleConstants.SiteEngineer, "0920 000 219"),
            ("kysu20@bpg.com", "Trần Kỹ Sư 20",   UserRoleConstants.SiteEngineer, "0920 000 220"),

            ("nghiviec@bpg.com", "Kỹ Sư Đã Nghỉ Việc", UserRoleConstants.SiteEngineer, "0930 000 999")
        };

        foreach (var seed in seeds)
        {
            var user = new User
            {
                FullName = seed.FullName,
                Email = seed.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                PhoneNumber = seed.Phone,
                IsActive = seed.Email != "nghiviec@bpg.com",
                FailedLoginCount = 0,
                CreatedAt = SeedUtc,
                LastLoginAt = seed.Email is "giamdoc@bpg.com" or "tpkt@bpg.com" or "ketoan@bpg.com"
                    ? SeedUtc.AddHours(2)
                    : null
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            if (!roleByName.TryGetValue(seed.Role, out var role))
                throw new InvalidOperationException($"Không tìm thấy role '{seed.Role}' được seed bởi AppDbContext.");

            context.UserRoles.Add(new BPG.Domain.Entities.UserRole
            {
                UserId = user.UserId,
                RoleId = role.RoleId,
                CreatedAt = SeedUtc,
                CreatedBy = user.UserId
            });
            await context.SaveChangesAsync();
            result[user.Email] = user;
        }

        var adminId = result["admin@bpg.com"].UserId;
        foreach (var user in await context.Users.ToListAsync())
            user.CreatedBy ??= adminId;
        foreach (var role in await context.Roles.ToListAsync())
        {
            role.CreatedAt = role.CreatedAt == default ? SeedUtc : role.CreatedAt;
            role.CreatedBy ??= adminId;
        }
        foreach (var ur in await context.UserRoles.ToListAsync())
            ur.CreatedBy ??= adminId;

        // Seed only expired/revoked auth artifacts so they never interfere with demo login.
        var inactive = result["nghiviec@bpg.com"];
        context.RefreshTokens.Add(new RefreshToken
        {
            UserId = inactive.UserId,
            TokenHash = "seed_revoked_refresh_token_hash_202608",
            ExpiresAt = SeedUtc.AddDays(-2),
            CreatedAt = SeedUtc.AddDays(-30),
            RevokedAt = SeedUtc.AddDays(-10),
            IsUsed = true,
            ReplacedByTokenHash = "seed_replacement_hash_202608"
        });
        context.OtpTokens.Add(new OtpToken
        {
            UserId = inactive.UserId,
            OtpType = "ResetPassword",
            Token = "000000",
            ExpiresAt = SeedUtc.AddDays(-20),
            IsUsed = true,
            RevokedAt = SeedUtc.AddDays(-20),
            AttemptCount = 1,
            CreatedAt = SeedUtc.AddDays(-20).AddMinutes(-10)
        });

        await context.SaveChangesAsync();
        return result;
    }

    // -------------------------------------------------------------------------
    // MASTER DATA
    // -------------------------------------------------------------------------
    private static async Task<MasterData> SeedMasterDataAsync(AppDbContext context, long adminId)
    {
        var units = new List<Unit>
        {
            new() { UnitCode = "KG",     UnitName = "kg",        IsDiscrete = false },
            new() { UnitCode = "TAN",    UnitName = "tấn",       IsDiscrete = false },
            new() { UnitCode = "BAO",    UnitName = "Bao",       IsDiscrete = true  },
            new() { UnitCode = "M3",     UnitName = "m³",        IsDiscrete = false },
            new() { UnitCode = "M2",     UnitName = "m²",        IsDiscrete = false },
            new() { UnitCode = "MET",    UnitName = "m",         IsDiscrete = false },
            new() { UnitCode = "LIT",    UnitName = "lít",       IsDiscrete = false },
            new() { UnitCode = "VIEN",   UnitName = "Viên",      IsDiscrete = true  },
            new() { UnitCode = "CAY",    UnitName = "Cây",       IsDiscrete = true  },
            new() { UnitCode = "TAM",    UnitName = "Tấm",       IsDiscrete = true  },
            new() { UnitCode = "BO",     UnitName = "Bộ",        IsDiscrete = true  },
            new() { UnitCode = "CUON",   UnitName = "Cuộn",      IsDiscrete = true  },
            new() { UnitCode = "THUNG",  UnitName = "Thùng",     IsDiscrete = true  },
            new() { UnitCode = "HOP",    UnitName = "Hộp",       IsDiscrete = true  },
            new() { UnitCode = "CAI",    UnitName = "Cái",       IsDiscrete = true  },
            new() { UnitCode = "CHAI",   UnitName = "Chai",      IsDiscrete = true  },
            new() { UnitCode = "TUYP",   UnitName = "Tuýp",      IsDiscrete = true  },
            new() { UnitCode = "GOI",    UnitName = "Gói",       IsDiscrete = true  }
        };

        foreach (var unit in units)
        {
            unit.CreatedAt = SeedUtc;
            unit.CreatedBy = adminId;
        }

        context.Units.AddRange(units);
        await context.SaveChangesAsync();

        var categories = new List<MaterialCategory>
        {
            new() { CategoryName = "Xi măng", Description = "Xi măng đóng bao và xi măng rời/xá cấp bằng xe bồn chuyên dụng." },
            new() { CategoryName = "Bê tông thương phẩm", Description = "Bê tông tươi theo cấp độ bền/mác, quản lý khối lượng theo m³." },
            new() { CategoryName = "Sắt thép xây dựng", Description = "Thép cuộn, thép thanh vằn, dây thép buộc và vật tư phụ cốt thép." },
            new() { CategoryName = "Cát đá vật liệu rời", Description = "Cát bê tông, cát xây tô, cát san lấp, đá dăm và cấp phối." },
            new() { CategoryName = "Gạch xây dựng", Description = "Gạch đặc, gạch lỗ và gạch block dùng xây tường, bể và hạng mục phụ." },
            new() { CategoryName = "Cốp pha & phụ kiện", Description = "Ván phủ phim, cây chống, ty ren, dầu chống dính và vật tư cốp pha." },
            new() { CategoryName = "Vữa - chống thấm - keo", Description = "Vữa sửa chữa, chống thấm, keo dán gạch, chà ron và vật tư hoàn thiện ướt." },
            new() { CategoryName = "Gạch ốp lát", Description = "Gạch porcelain, ceramic và gạch chống trơn quản lý theo diện tích." },
            new() { CategoryName = "Sơn & bột bả", Description = "Bột bả, sơn lót, sơn phủ và vật tư sơn." },
            new() { CategoryName = "Điện & phụ kiện", Description = "Dây điện, ống luồn, măng sông, hộp âm, thiết bị điện và vật tư phụ." },
            new() { CategoryName = "Cấp thoát nước & phụ kiện", Description = "Ống PVC/PPR, co, tê, van, keo dán ống và vật tư làm kín ren." },
            new() { CategoryName = "Trần thạch cao", Description = "Tấm thạch cao, khung xương và phụ kiện trần." },
            new() { CategoryName = "Thiết bị vệ sinh", Description = "Bồn cầu, lavabo, vòi, phễu thu sàn và phụ kiện khu vệ sinh." },
            new() { CategoryName = "Cửa & phụ kiện", Description = "Cửa, phụ kiện khóa, bản lề, silicone và vật tư lắp đặt." }
        };

        foreach (var c in categories)
        {
            c.CreatedAt = SeedUtc;
            c.CreatedBy = adminId;
        }

        context.MaterialCategories.AddRange(categories);
        await context.SaveChangesAsync();

        var suppliers = new List<Supplier>
        {
            new() { SupplierName = "Xi măng VICEM Bỉm Sơn", ContactInfo = "Bộ phận kinh doanh miền Bắc", Address = "Bỉm Sơn, Thanh Hóa", ServiceArea = "Hà Nội và miền Bắc", Rating = 4.7m, EvaluationNote = "Cấp xi măng bao và lô xi măng khối lượng lớn; chứng từ lô hàng rõ ràng.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Strategic },
            new() { SupplierName = "Thép Hòa Phát - khu vực miền Bắc", ContactInfo = "Bộ phận kinh doanh thép xây dựng", Address = "Hưng Yên", ServiceArea = "Hà Nội, Hưng Yên và lân cận", Rating = 4.8m, EvaluationNote = "Thép cuộn và thép thanh vằn nhiều đường kính; giao theo bó/cây và đối chiếu khối lượng.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Strategic },
            new() { SupplierName = "Đơn vị bê tông thương phẩm Hưng Yên", ContactInfo = "Điều phối trạm trộn - xe bồn", Address = "Văn Giang, Hưng Yên", ServiceArea = "Văn Giang và khu vực phía Đông Hà Nội", Rating = 4.6m, EvaluationNote = "Điều phối bê tông M100-M350 theo m³, có phiếu giao từng xe.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "Đại lý VLXD Minh Phát Hà Đông", ContactInfo = "Kho vật liệu xây dựng", Address = "Hà Đông, Hà Nội", ServiceArea = "Hà Đông, Thanh Xuân, Nam Từ Liêm", Rating = 4.4m, EvaluationNote = "Cát, đá, gạch, xi măng và vật tư phụ; phù hợp giao nhiều đợt.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "Saint-Gobain Việt Nam - Weber", ContactInfo = "Kênh phân phối vật liệu hoàn thiện", Address = "Hà Nội", ServiceArea = "Toàn quốc", Rating = 4.6m, EvaluationNote = "Keo dán gạch và vật liệu hoàn thiện có tài liệu kỹ thuật.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "Sika Việt Nam", ContactInfo = "Kênh phân phối dự án", Address = "Hà Nội", ServiceArea = "Toàn quốc", Rating = 4.7m, EvaluationNote = "Vật liệu chống thấm và sửa chữa bê tông.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Strategic },
            new() { SupplierName = "Nhà phân phối sơn Dulux Hà Nội", ContactInfo = "Kênh dự án", Address = "Hà Nội", ServiceArea = "Hà Nội và Hưng Yên", Rating = 4.5m, EvaluationNote = "Bột bả, sơn lót, sơn nội thất và ngoại thất theo thùng.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "Đại lý điện nước An Phát", ContactInfo = "Kho điện nước", Address = "Hà Đông, Hà Nội", ServiceArea = "Hà Nội", Rating = 4.3m, EvaluationNote = "Dây điện, ống luồn, hộp âm, PVC/PPR và phụ kiện giao nhanh.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "Kho thạch cao và phụ kiện hoàn thiện Hà Nội", ContactInfo = "Bộ phận bán hàng công trình", Address = "Nam Từ Liêm, Hà Nội", ServiceArea = "Hà Nội và Hưng Yên", Rating = 4.4m, EvaluationNote = "Tấm thạch cao, khung xương, vít và vật tư trần.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Regular },
            new() { SupplierName = "VLXD Thành Đạt", ContactInfo = "Kho gạch", Address = "Thanh Trì, Hà Nội", ServiceArea = "Hà Nội", Rating = 2.1m, EvaluationNote = "Giao hàng thường xuyên trễ hẹn, sai quy cách.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Restricted },
            new() { SupplierName = "Sơn chống thấm Quang Minh", ContactInfo = "Đại lý bán lẻ", Address = "Hai Bà Trưng, Hà Nội", ServiceArea = "Hà Nội", Rating = 1.5m, EvaluationNote = "Hàng giả, chất lượng kém.", CollaborationStatus = BPG.Domain.Constants.CollaborationStatus.Blacklisted }
        };

        foreach (var s in suppliers)
        {
            s.CreatedAt = SeedUtc;
            s.CreatedBy = adminId;
        }

        context.Suppliers.AddRange(suppliers);
        await context.SaveChangesAsync();

        var configs = new List<SystemConfig>
        {
            new() { ConfigKey = SystemConfigKeys.LowStockThreshold, ConfigValue = "10", DataType = "percentage", DisplayName = "Tỷ lệ cảnh báo tồn kho thấp", Description = "Tỷ lệ phần trăm so với nhu cầu BOQ còn lại dùng để cảnh báo tồn kho thấp.", Unit = "%" },
            new() { ConfigKey = SystemConfigKeys.CancellationDays, ConfigValue = "7", DataType = "number", DisplayName = "Hạn hủy phiếu nhập kho", Description = "Số ngày tối đa kể từ lúc tạo phiếu nhập kho được phép hủy.", Unit = "ngày" },
            new() { ConfigKey = SystemConfigKeys.ExpectedDelayPercent, ConfigValue = "10", DataType = "percentage", DisplayName = "Ngưỡng cảnh báo trễ tiến độ", Description = "Ngưỡng phần trăm chậm so với tiến độ kỳ vọng.", Unit = "%" },
            new() { ConfigKey = SystemConfigKeys.DailyLogEditWindowHours, ConfigValue = "24", DataType = "number", DisplayName = "Thời gian được sửa nhật ký", Description = "Số giờ kể từ lúc tạo mà nhật ký thi công còn được sửa.", Unit = "giờ" },
            new() { ConfigKey = SystemConfigKeys.DirectPurchasePhaseMaxAmount, ConfigValue = "20000000", DataType = "number", DisplayName = "Hạn mức mua trực tiếp mỗi giai đoạn", Description = "Tổng giá trị mua trực tiếp cộng dồn tối đa trong một giai đoạn.", Unit = "VNĐ" },
            new() { ConfigKey = SystemConfigKeys.CompanyName, ConfigValue = "BPG", DataType = "string", DisplayName = "Tên công ty", Description = "Tên doanh nghiệp hiển thị trên hệ thống." },
            new() { ConfigKey = SystemConfigKeys.CompanyLogoUrl, ConfigValue = "", DataType = "string", DisplayName = "Logo công ty", Description = "Để trống để giao diện sử dụng logo/fallback nội bộ." }
        };

        var existingConfigs = await context.SystemConfigs.ToDictionaryAsync(x => x.ConfigKey);
        foreach (var cfg in configs)
        {
            if (existingConfigs.TryGetValue(cfg.ConfigKey, out var existing))
            {
                existing.ConfigValue = cfg.ConfigValue;
                existing.DataType = cfg.DataType;
                existing.DisplayName = cfg.DisplayName;
                existing.Description = cfg.Description;
                existing.Unit = cfg.Unit;
            }
            else
            {
                cfg.CreatedAt = SeedUtc;
                cfg.CreatedBy = adminId;
                context.SystemConfigs.Add(cfg);
            }
        }

        await context.SaveChangesAsync();

        return new MasterData(
            units.ToDictionary(x => x.UnitCode),
            categories.ToDictionary(x => x.CategoryName),
            suppliers.ToDictionary(x => x.SupplierName));
    }

    // -------------------------------------------------------------------------
    // DANH MỤC VẬT TƯ + QUY ĐỔI ĐƠN VỊ
    // Công thức của hệ thống: BaseQty = Quantity / ConversionRate.
    //
    // Quy ước thực tế trong seed này:
    // - Xi măng đóng bao: đơn vị gốc BAO; có thể quy đổi sang KG/TẤN.
    // - Xi măng rời/xá: là vật tư RIÊNG, đơn vị gốc TẤN, giao bằng xe bồn/silo.
    // - Bê tông thương phẩm: là vật tư RIÊNG, đơn vị gốc M3.
    // - Thép thanh: đơn vị gốc CÂY 11,7 m; quy đổi sang KG/TẤN theo đơn trọng lý thuyết.
    // - Keo, bột bả: BAO; sơn: THÙNG; SikaTop: BỘ.
    // -------------------------------------------------------------------------
    private static async Task<Dictionary<string, MaterialCatalog>> SeedMaterialsAsync(
        AppDbContext context, MasterData master, long adminId)
    {
        Unit U(string code) => master.Units[code];
        MaterialCategory C(string name) => master.Categories[name];

        MaterialCatalog M(string code, string name, string spec, string category, string baseUnit) =>
            new()
            {
                Code = code,
                Name = name,
                Specification = spec,
                CategoryId = C(category).CategoryId,
                BaseUnitId = U(baseUnit).UnitId,
                CreatedAt = SeedUtc,
                CreatedBy = adminId
            };

        var list = new List<MaterialCatalog>
        {
            // ===== XI MĂNG =====
            M("XM-VICEM-PCB40", "Xi măng VICEM PCB40 đóng bao", "Bao 50 kg; dùng xây, tô, cán nền và các công tác vữa tại chỗ.", "Xi măng", "BAO"),
            M("XM-INSEE-PCB40", "Xi măng INSEE PCB40 đóng bao", "Bao 50 kg; dùng xây tô và các công tác hoàn thiện dân dụng.", "Xi măng", "BAO"),
            M("XM-ROI-PCB40", "Xi măng rời PCB40 (xi măng xá)", "Xi măng dạng rời giao bằng xe bồn chuyên dụng, bơm vào silo; quản lý theo tấn. Không đồng nhất với bê tông tươi.", "Xi măng", "TAN"),

            // ===== BÊ TÔNG THƯƠNG PHẨM =====
            M("BT-TUOI-M100", "Bê tông thương phẩm M100", "Bê tông lót; đặt và nghiệm thu khối lượng theo m³ trên phiếu giao từng xe.", "Bê tông thương phẩm", "M3"),
            M("BT-TUOI-M200", "Bê tông thương phẩm M200", "Bê tông dùng cho hạng mục phù hợp hồ sơ thiết kế; quản lý theo m³.", "Bê tông thương phẩm", "M3"),
            M("BT-TUOI-M250", "Bê tông thương phẩm M250", "Bê tông kết cấu; khối lượng giao nhận theo m³.", "Bê tông thương phẩm", "M3"),
            M("BT-TUOI-M300", "Bê tông thương phẩm M300", "Bê tông kết cấu cột, dầm, sàn theo thiết kế; quản lý theo m³.", "Bê tông thương phẩm", "M3"),
            M("BT-TUOI-M350", "Bê tông thương phẩm M350", "Bê tông cấp độ cao hơn cho cấu kiện theo yêu cầu thiết kế; quản lý theo m³.", "Bê tông thương phẩm", "M3"),

            // ===== THÉP =====
            M("THEP-HP-D6", "Thép cuộn Hòa Phát D6 CB240-T", "Thép cuộn; quản lý tồn theo kg, mua khối lượng lớn có thể theo tấn.", "Sắt thép xây dựng", "KG"),
            M("THEP-HP-D8", "Thép cuộn Hòa Phát D8 CB240-T", "Thép cuộn; quản lý tồn theo kg, mua khối lượng lớn có thể theo tấn.", "Sắt thép xây dựng", "KG"),
            M("THEP-HP-D10", "Thép thanh vằn Hòa Phát D10 CB300-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 7,22 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D12", "Thép thanh vằn Hòa Phát D12 CB300-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 10,39 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D14", "Thép thanh vằn Hòa Phát D14 CB400-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 14,16 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D16", "Thép thanh vằn Hòa Phát D16 CB400-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 18,49 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D18", "Thép thanh vằn Hòa Phát D18 CB400-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 23,40 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D20", "Thép thanh vằn Hòa Phát D20 CB400-V", "Cây tiêu chuẩn 11,7 m; khối lượng lý thuyết khoảng 28,86 kg/cây.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D22", "Thép thanh vằn Hòa Phát D22 CB400-V", "Cây tiêu chuẩn 11,7 m; dùng cho cấu kiện theo thiết kế kết cấu.", "Sắt thép xây dựng", "CAY"),
            M("THEP-HP-D25", "Thép thanh vằn Hòa Phát D25 CB400-V", "Cây tiêu chuẩn 11,7 m; dùng cho cấu kiện chịu lực lớn theo thiết kế.", "Sắt thép xây dựng", "CAY"),
            M("DAY-THEP-BUOC-1", "Dây thép buộc 1 mm", "Dùng buộc cốt thép; quản lý theo kg.", "Sắt thép xây dựng", "KG"),
            M("DINH-THEP-5CM", "Đinh thép 5 cm", "Dùng cốp pha và công tác phụ trợ; quản lý theo kg.", "Sắt thép xây dựng", "KG"),

            // ===== CÁT ĐÁ =====
            M("CAT-VANG-BT", "Cát vàng dùng bê tông", "Cát hạt trung/thô; dùng cho công tác trộn tại chỗ khi cần.", "Cát đá vật liệu rời", "M3"),
            M("CAT-XAY-TO", "Cát xây tô", "Cát sạch phù hợp vữa xây, tô trát và cán nền.", "Cát đá vật liệu rời", "M3"),
            M("CAT-SAN-LAP", "Cát san lấp", "Dùng san nền và bù cốt.", "Cát đá vật liệu rời", "M3"),
            M("DA-1X2", "Đá 1x2", "Đá dăm dùng bê tông trộn tại chỗ hoặc công tác phụ trợ.", "Cát đá vật liệu rời", "M3"),
            M("DA-4X6", "Đá 4x6", "Dùng bê tông lót/nền móng tùy biện pháp thi công.", "Cát đá vật liệu rời", "M3"),
            M("DA-0X4", "Đá cấp phối 0x4", "Dùng lớp cấp phối nền, sân và đường nội bộ.", "Cát đá vật liệu rời", "M3"),

            // ===== GẠCH XÂY =====
            M("GACH-DAC-A1", "Gạch đặc đất sét nung A1", "Gạch đặc dùng chân tường, bể và vị trí cần đặc chắc.", "Gạch xây dựng", "VIEN"),
            M("GACH-2LO-220", "Gạch 2 lỗ 220x105x60", "Gạch xây dân dụng; quản lý theo viên.", "Gạch xây dựng", "VIEN"),
            M("GACH-4LO-80", "Gạch 4 lỗ đất sét nung", "Gạch lỗ dùng xây tường ngăn/tường bao theo thiết kế.", "Gạch xây dựng", "VIEN"),
            M("GACH-6LO-100", "Gạch 6 lỗ đất sét nung", "Gạch lỗ dùng xây tường ngăn, giảm tải bản thân tường.", "Gạch xây dựng", "VIEN"),
            M("GACH-BLOCK-100", "Gạch block bê tông dày 100 mm", "Gạch block dùng tường ngăn; quản lý theo viên.", "Gạch xây dựng", "VIEN"),

            // ===== CỐP PHA =====
            M("VAN-PHU-PHIM-18", "Ván ép phủ phim 18 mm", "Ván cốp pha phủ phim; quản lý theo tấm.", "Cốp pha & phụ kiện", "TAM"),
            M("CAY-CHONG-THEP-3M", "Cây chống thép tăng 3 m", "Cây chống cốp pha có thể tái sử dụng; quản lý theo cây.", "Cốp pha & phụ kiện", "CAY"),
            M("TY-REN-COPPHA-D17", "Bộ ty ren cốp pha D17", "Ty ren, bát chuồn và phụ kiện siết cốp pha.", "Cốp pha & phụ kiện", "BO"),
            M("DAU-COPPHA-20L", "Dầu chống dính cốp pha 20 lít", "Thùng 20 lít; quét bề mặt cốp pha trước đổ bê tông.", "Cốp pha & phụ kiện", "THUNG"),

            // ===== VỮA / CHỐNG THẤM / KEO =====
            M("SIKA-TOP-107", "SikaTop-107 Seal VN", "Bộ 25 kg (A+B); dùng chống thấm khu vệ sinh, ban công, bể và hạng mục phù hợp.", "Vữa - chống thấm - keo", "BO"),
            M("SIKA-GROUT-214", "SikaGrout 214-11 25 kg", "Bao 25 kg; vữa không co ngót dùng cổ ống, chân đế và vị trí sửa chữa phù hợp.", "Vữa - chống thấm - keo", "BAO"),
            M("WEBER-ST250", "Keo dán gạch Weber ST250 25 kg", "Bao 25 kg; dùng ốp lát gạch khu vực nội thất thông dụng.", "Vữa - chống thấm - keo", "BAO"),
            M("WEBER-FIX-PRO", "Keo dán gạch Weber Fix Pro 25 kg", "Bao 25 kg; dùng gạch porcelain/kích thước lớn theo yêu cầu kỹ thuật.", "Vữa - chống thấm - keo", "BAO"),
            M("KEO-CHA-RON-5", "Keo chà ron 5 kg", "Hộp/gói thương mại 5 kg; dùng hoàn thiện mạch gạch.", "Vữa - chống thấm - keo", "HOP"),

            // ===== GẠCH ỐP LÁT =====
            M("GACH-POR-600", "Gạch porcelain 600x600", "Gạch lát sàn; BOQ và xuất dùng theo m².", "Gạch ốp lát", "M2"),
            M("GACH-CER-300", "Gạch ceramic 300x600", "Gạch ốp tường khu vệ sinh/bếp; quản lý theo m².", "Gạch ốp lát", "M2"),
            M("GACH-CT-300", "Gạch chống trơn 300x300", "Gạch lát khu vệ sinh, ban công và khu vực ẩm ướt.", "Gạch ốp lát", "M2"),

            // ===== SƠN =====
            M("BOT-BA-40", "Bột bả nội thất 40 kg", "Bao 40 kg; xử lý bề mặt trước sơn.", "Sơn & bột bả", "BAO"),
            M("BOT-BA-NGOAI-40", "Bột bả ngoại thất 40 kg", "Bao 40 kg; dùng cho bề mặt ngoài nhà theo hệ sơn.", "Sơn & bột bả", "BAO"),
            M("SON-LOT-NOI-18", "Sơn lót nội thất", "Thùng 18 lít; lớp lót trước sơn phủ.", "Sơn & bột bả", "THUNG"),
            M("SON-NOI-18", "Sơn phủ nội thất", "Thùng 18 lít; sơn phủ hoàn thiện nội thất.", "Sơn & bột bả", "THUNG"),
            M("SON-NGOAI-18", "Sơn phủ ngoại thất", "Thùng 18 lít; sơn phủ ngoài trời.", "Sơn & bột bả", "THUNG"),

            // ===== ĐIỆN =====
            M("CADIVI-CV1.5", "Dây điện CV 1.5 mm²", "Quản lý theo m; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV2.5", "Dây điện CV 2.5 mm²", "Quản lý theo m; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV4", "Dây điện CV 4 mm²", "Quản lý theo m; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV6", "Dây điện CV 6 mm²", "Dây cấp nguồn nhánh; quản lý theo m.", "Điện & phụ kiện", "MET"),
            M("ONG-LUON-D20", "Ống luồn dây điện cứng D20", "Cây thương mại 4 m; tồn gốc theo m.", "Điện & phụ kiện", "MET"),
            M("ONG-LUON-D25", "Ống luồn dây điện cứng D25", "Cây thương mại 4 m; tồn gốc theo m.", "Điện & phụ kiện", "MET"),
            M("MANG-SONG-D20", "Măng sông nối ống điện D20", "Phụ kiện nối hai đoạn ống luồn D20.", "Điện & phụ kiện", "CAI"),
            M("MANG-SONG-D25", "Măng sông nối ống điện D25", "Phụ kiện nối hai đoạn ống luồn D25.", "Điện & phụ kiện", "CAI"),
            M("DE-AM-DON", "Đế âm tường đơn", "Đế âm lắp công tắc/ổ cắm đơn.", "Điện & phụ kiện", "CAI"),
            M("DE-AM-DOI", "Đế âm tường đôi", "Đế âm lắp cụm thiết bị đôi.", "Điện & phụ kiện", "CAI"),
            M("MCB-1P-20A", "Aptomat MCB 1P 20A", "Thiết bị bảo vệ mạch nhánh.", "Điện & phụ kiện", "CAI"),
            M("O-CAM-DOI", "Ổ cắm đôi âm tường", "Ổ cắm hoàn thiện lắp âm.", "Điện & phụ kiện", "CAI"),
            M("CONG-TAC-1", "Công tắc 1 chiều", "Công tắc hoàn thiện lắp âm.", "Điện & phụ kiện", "CAI"),

            // ===== CẤP THOÁT NƯỚC =====
            M("PVC-D60", "Ống PVC D60", "Ống thoát; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PVC-D90", "Ống PVC D90", "Ống thoát; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PVC-D114", "Ống PVC D114", "Ống thoát phân/bồn cầu; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("CO-PVC-D90", "Co PVC 90 độ D90", "Phụ kiện đổi hướng tuyến thoát D90.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("TE-PVC-D90", "Tê PVC D90", "Phụ kiện chia/đấu nối tuyến thoát D90.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("CO-PVC-D114", "Co PVC 90 độ D114", "Phụ kiện đổi hướng tuyến thoát D114.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("TE-PVC-D114", "Tê PVC D114", "Phụ kiện đấu nối tuyến thoát D114.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("KEO-PVC-500", "Keo dán ống PVC 500 ml", "Chai keo dán ống và phụ kiện PVC.", "Cấp thoát nước & phụ kiện", "CHAI"),
            M("PPR-D20", "Ống PPR D20", "Ống cấp nước; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PPR-D25", "Ống PPR D25", "Ống cấp nước; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PPR-D32", "Ống PPR D32", "Ống cấp nước trục; cây 4 m, tồn gốc theo m.", "Cấp thoát nước & phụ kiện", "MET"),
            M("CO-PPR-D25", "Co PPR D25", "Phụ kiện chuyển hướng ống cấp D25.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("TE-PPR-D25", "Tê PPR D25", "Phụ kiện chia nhánh ống cấp D25.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("VAN-BI-D25", "Van bi khóa nước D25", "Van khóa nhánh cấp nước.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("BANG-TAN-PTFE", "Băng tan PTFE (cao su non)", "Cuộn băng làm kín mối nối ren cấp nước.", "Cấp thoát nước & phụ kiện", "CUON"),
            M("PHEU-THU-SAN-90", "Phễu thu sàn D90", "Phễu thu nước sàn khu vệ sinh/ban công.", "Cấp thoát nước & phụ kiện", "CAI"),

            // ===== TRẦN THẠCH CAO =====
            M("TAM-THACH-CAO-9", "Tấm thạch cao tiêu chuẩn 9 mm", "Tấm dùng trần chìm/khu vực khô.", "Trần thạch cao", "TAM"),
            M("TAM-THACH-CAO-AM-9", "Tấm thạch cao chịu ẩm 9 mm", "Tấm dùng khu vực yêu cầu khả năng chịu ẩm cao hơn.", "Trần thạch cao", "TAM"),
            M("KHUNG-XUONG-CHINH", "Thanh khung xương trần chính", "Thanh kim loại định hình; quản lý theo cây.", "Trần thạch cao", "CAY"),
            M("KHUNG-XUONG-PHU", "Thanh khung xương trần phụ", "Thanh kim loại định hình; quản lý theo cây.", "Trần thạch cao", "CAY"),
            M("VIT-THACH-CAO", "Vít thạch cao", "Vật tư liên kết tấm và khung; quản lý theo hộp.", "Trần thạch cao", "HOP"),

            // ===== THIẾT BỊ VỆ SINH =====
            M("BON-CAU-2KHOI", "Bồn cầu 2 khối", "Thiết bị vệ sinh hoàn thiện.", "Thiết bị vệ sinh", "BO"),
            M("LAVABO-TREO", "Lavabo treo tường", "Chậu rửa kèm bộ phụ kiện lắp cơ bản.", "Thiết bị vệ sinh", "BO"),
            M("SEN-TAM-NONG-LANH", "Bộ sen tắm nóng lạnh", "Bộ sen vòi hoàn thiện khu vệ sinh.", "Thiết bị vệ sinh", "BO"),
            M("VOI-LAVABO", "Vòi lavabo", "Vòi chậu rửa hoàn thiện.", "Thiết bị vệ sinh", "CAI"),

            // ===== CỬA / PHỤ KIỆN =====
            M("SILICONE-300", "Keo silicone trung tính 300 ml", "Tuýp keo làm kín khe cửa/nhôm kính.", "Cửa & phụ kiện", "TUYP"),
            M("KHOA-CUA-PHONG", "Bộ khóa cửa phòng", "Bộ khóa và phụ kiện cơ bản.", "Cửa & phụ kiện", "BO"),
            M("BAN-LE-CUA", "Bản lề cửa", "Bản lề lắp cánh cửa.", "Cửa & phụ kiện", "CAI")
        };

        context.MaterialCatalogs.AddRange(list);
        await context.SaveChangesAsync();

        var byCode = list.ToDictionary(x => x.Code);
        var conversions = new List<MaterialConversion>();

        void AddConv(string mat, string unit, decimal rate) => conversions.Add(new MaterialConversion
        {
            MaterialId = byCode[mat].MaterialId,
            AlternativeUnitId = U(unit).UnitId,
            ConversionRate = rate,
            CreatedAt = SeedUtc,
            CreatedBy = adminId
        });

        // Xi măng BAO: 1 bao = 50 kg = 0,05 tấn.
        foreach (var code in new[] { "XM-VICEM-PCB40", "XM-INSEE-PCB40" })
        {
            AddConv(code, "KG", 50m);
            AddConv(code, "TAN", 0.05m);
        }

        // Xi măng rời/xá quản lý theo tấn; cho phép nhập chứng từ theo kg nếu cần.
        AddConv("XM-ROI-PCB40", "KG", 1000m);

        // Thép cuộn gốc KG.
        foreach (var code in new[] { "THEP-HP-D6", "THEP-HP-D8" })
            AddConv(code, "TAN", 0.001m);

        // Thép thanh gốc CÂY 11,7 m. Alternative KG/TẤN là khối lượng của 1 cây.
        void AddSteelBarConv(string code, decimal kgPerBar)
        {
            AddConv(code, "KG", kgPerBar);
            AddConv(code, "TAN", kgPerBar / 1000m);
        }

        AddSteelBarConv("THEP-HP-D10", 7.22m);
        AddSteelBarConv("THEP-HP-D12", 10.39m);
        AddSteelBarConv("THEP-HP-D14", 14.16m);
        AddSteelBarConv("THEP-HP-D16", 18.49m);
        AddSteelBarConv("THEP-HP-D18", 23.40m);
        AddSteelBarConv("THEP-HP-D20", 28.86m);
        AddSteelBarConv("THEP-HP-D22", 34.91m);
        AddSteelBarConv("THEP-HP-D25", 45.10m);

        // Vật tư đóng gói: base là bao/bộ/thùng/hộp để thủ kho nhập đúng ngôn ngữ hiện trường.
        AddConv("SIKA-TOP-107", "KG", 25m);
        AddConv("SIKA-GROUT-214", "KG", 25m);
        AddConv("WEBER-ST250", "KG", 25m);
        AddConv("WEBER-FIX-PRO", "KG", 25m);
        AddConv("KEO-CHA-RON-5", "KG", 5m);
        AddConv("BOT-BA-40", "KG", 40m);
        AddConv("BOT-BA-NGOAI-40", "KG", 40m);

        foreach (var code in new[] { "SON-LOT-NOI-18", "SON-NOI-18", "SON-NGOAI-18" })
            AddConv(code, "LIT", 18m);

        // Dây điện gốc mét: 1 cuộn thương mại = 100 m.
        foreach (var code in new[] { "CADIVI-CV1.5", "CADIVI-CV2.5", "CADIVI-CV4" })
            AddConv(code, "CUON", 0.01m);

        // Ống gốc mét: 1 cây = 4 m.
        foreach (var code in new[]
        {
            "ONG-LUON-D20", "ONG-LUON-D25",
            "PVC-D60", "PVC-D90", "PVC-D114",
            "PPR-D20", "PPR-D25", "PPR-D32"
        })
            AddConv(code, "CAY", 0.25m);

        context.MaterialConversions.AddRange(conversions);
        await context.SaveChangesAsync();
        return byCode;
    }

    // -------------------------------------------------------------------------
    // DỰ ÁN / THÀNH VIÊN / CẤU TRÚC CÔNG VIỆC / BOQ
    // -------------------------------------------------------------------------
    private static async Task<Dictionary<string, ProjectBundle>> SeedProjectsWbsAndBoqAsync(
        AppDbContext context,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var tpkt = users["tpkt@bpg.com"];
        var leaders = Enumerable.Range(1, 10).Select(i => users[$"leader{i}@bpg.com"]).ToArray();
        var engineers = Enumerable.Range(1, 20).Select(i => users[$"kysu{i}@bpg.com"]).ToArray();

        var specs = new List<ProjectSeedSpec>
        {
            new(MainProjectName,
                "Đảo Dừa 3, Vinhomes Ocean Park 2, Văn Giang, Hưng Yên",
                "Renovation", ProjectStatus.InProgress,
                new DateOnly(2026,5,18), new DateOnly(2026,10,20),
                FloorCount: 3, ScaleFactor: 1.15m),

            new("Biệt thự nhà chú Công – khu San Hô, Vinhomes Ocean Park 2",
                "Phân khu San Hô, Vinhomes Ocean Park 2, Văn Giang, Hưng Yên",
                "Renovation", ProjectStatus.InProgress,
                new DateOnly(2026,6,1), new DateOnly(2026,11,15),
                FloorCount: 3, ScaleFactor: 1.10m),

            new("Cải tạo chung cư Trần Thủ Độ",
                "Khu đô thị Pháp Vân - Tứ Hiệp, Hoàng Mai, Hà Nội",
                "Renovation", ProjectStatus.InProgress,
                new DateOnly(2026,7,1), new DateOnly(2026,9,30),
                FloorCount: 1, ScaleFactor: 0.62m),

            new("Nhà phố thương mại KĐT Văn Phú – Hà Đông",
                "Khu đô thị Văn Phú, Hà Đông, Hà Nội",
                "NewBuild", ProjectStatus.Paused,
                new DateOnly(2026,2,18), new DateOnly(2026,12,15),
                "Tạm dừng chờ thống nhất điều chỉnh thiết kế mặt đứng và lịch cung ứng vật tư.",
                FloorCount: 5, ScaleFactor: 1.20m),

            new("Biệt thự song lập An Khánh – Hoài Đức",
                "Khu đô thị An Khánh, Hoài Đức, Hà Nội",
                "NewBuild", ProjectStatus.InProgress,
                new DateOnly(2026,3,12), new DateOnly(2026,12,20),
                FloorCount: 3, ScaleFactor: 1.10m),

            new("Cải tạo nhà liền kề Vạn Phúc – Hà Đông",
                "Khu đô thị Vạn Phúc, Hà Đông, Hà Nội",
                "Renovation", ProjectStatus.InProgress,
                new DateOnly(2026,6,20), new DateOnly(2026,10,5),
                FloorCount: 4, ScaleFactor: 0.88m),

            new("Nhà ở liền kề LK4B Mỗ Lao – Hà Đông",
                "Khu tái định cư đô thị Mỗ Lao, Hà Đông, Hà Nội",
                "NewBuild", ProjectStatus.Completed,
                new DateOnly(2025,3,10), new DateOnly(2025,11,25),
                FloorCount: 4, ScaleFactor: 1.00m),

            new("Cải tạo văn phòng Bùi Phú Gia – Mỗ Lao",
                "Mỗ Lao, Hà Đông, Hà Nội",
                "Renovation", ProjectStatus.Closed,
                new DateOnly(2025,8,5), new DateOnly(2025,12,15),
                FloorCount: 3, ScaleFactor: 0.75m),

            new("Cải tạo nhà phố Nguyễn Xiển – Thanh Xuân",
                "Nguyễn Xiển, Thanh Xuân, Hà Nội",
                "Renovation", ProjectStatus.Completed,
                new DateOnly(2026,1,10), new DateOnly(2026,5,30),
                FloorCount: 4, ScaleFactor: 0.82m),

            new("Nhà ở riêng lẻ Yên Nghĩa – Hà Đông",
                "Yên Nghĩa, Hà Đông, Hà Nội",
                "NewBuild", ProjectStatus.Draft,
                new DateOnly(2026,9,15), new DateOnly(2027,5,30),
                FloorCount: 4, ScaleFactor: 0.95m)
        };

        var result = new Dictionary<string, ProjectBundle>();
        for (var i = 0; i < specs.Count; i++)
        {
            var spec = specs[i];
            var leader = leaders[i];
            var engineerA = engineers[(i * 2) % engineers.Length];
            var engineerB = engineers[(i * 2 + 1) % engineers.Length];

            var project = new Project
            {
                Name = spec.Name,
                Address = spec.Address,
                PlannedStart = spec.Start,
                PlannedEnd = spec.End,
                Status = spec.Status,
                PauseReason = spec.Status == ProjectStatus.Paused ? spec.PauseReason : null,
                PausedAt = spec.Status == ProjectStatus.Paused ? SeedUtc.AddDays(-6) : null,
                CreatedAt = DateTime.SpecifyKind(spec.Start.ToDateTime(new TimeOnly(1, 0)), DateTimeKind.Utc).AddDays(-20),
                CreatedBy = tpkt.UserId
            };
            context.Projects.Add(project);
            await context.SaveChangesAsync();

            context.ProjectMembers.AddRange(
                new ProjectMember { ProjectId=project.ProjectId, UserId=leader.UserId, IsLeader=true, JoinedAt=project.CreatedAt.AddDays(3), CreatedAt=project.CreatedAt.AddDays(3), CreatedBy=tpkt.UserId },
                new ProjectMember { ProjectId=project.ProjectId, UserId=engineerA.UserId, IsLeader=false, JoinedAt=project.CreatedAt.AddDays(3), CreatedAt=project.CreatedAt.AddDays(3), CreatedBy=tpkt.UserId },
                new ProjectMember { ProjectId=project.ProjectId, UserId=engineerB.UserId, IsLeader=false, JoinedAt=project.CreatedAt.AddDays(3), CreatedAt=project.CreatedAt.AddDays(3), CreatedBy=tpkt.UserId }
            );
            context.Attachments.Add(new Attachment
            {
                EntityType = EntityType.Project,
                EntityId = project.ProjectId,
                AttachmentType = AttachmentType.Design,
                FileName = spec.Kind == "NewBuild"
                    ? $"anh-tham-khao-thi-cong-{project.ProjectId:D2}.jpg"
                    : $"anh-tham-khao-cai-tao-{project.ProjectId:D2}.jpg",
                FileUrl = spec.Kind == "NewBuild" ? SeedImageConstruction : SeedImageRenovation,
                ContentType = "image/jpeg",
                FileSizeBytes = 420_000,
                CreatedAt = project.CreatedAt,
                CreatedBy = tpkt.UserId
            });
            await context.SaveChangesAsync();

            var phaseRanges = BuildPhaseRanges(spec.Start, spec.End);
            var phaseNames = spec.Kind == "NewBuild"
                ? new[]
                {
                    "Giai đoạn 1: Móng và nền",
                    "Giai đoạn 2: Kết cấu bê tông cốt thép",
                    "Giai đoạn 3: Xây tô, điện nước âm và chống thấm",
                    "Giai đoạn 4: Hoàn thiện, nghiệm thu và bàn giao"
                }
                : new[]
                {
                    "Giai đoạn 1: Khảo sát, bảo vệ hiện trạng và tháo dỡ",
                    "Giai đoạn 2: Sửa chữa phần thô, điện nước âm và chống thấm",
                    "Giai đoạn 3: Ốp lát, sơn và lắp đặt hoàn thiện",
                    "Giai đoạn 4: Kiểm tra, sửa lỗi hoàn thiện và bàn giao"
                };

            var phases = new List<Phase>();
            var taskMap = new Dictionary<long, List<ProjectTask>>();
            for (var phaseIndex = 0; phaseIndex < 4; phaseIndex++)
            {
                var phaseStatus = ResolvePhaseStatus(
                    spec.Status,
                    phaseRanges[phaseIndex].Start,
                    phaseRanges[phaseIndex].End,
                    project.PausedAt);
                var phase = new Phase
                {
                    ProjectId = project.ProjectId,
                    Name = phaseNames[phaseIndex],
                    Description = $"Phạm vi giai đoạn của {project.Name} được chia theo trình tự thi công, đầu mối tổ đội và các điểm kiểm tra nghiệm thu.",
                    OrderIndex = phaseIndex + 1,
                    StartDate = phaseRanges[phaseIndex].Start,
                    EndDate = phaseRanges[phaseIndex].End,
                    Status = phaseStatus,
                    CreatedAt = project.CreatedAt.AddDays(5 + phaseIndex),
                    CreatedBy = tpkt.UserId
                };
                context.Phases.Add(phase);
                await context.SaveChangesAsync();
                phases.Add(phase);

                var tasks = await SeedTasksForPhaseAsync(context, spec, project, phase, phaseIndex, leader, engineerA, engineerB, tpkt);
                taskMap[phase.PhaseId] = tasks;
                await SeedBoqForPhaseAsync(context, spec, phase, phaseIndex, materials, master.Units, tpkt.UserId);

                if (phase.Status == PhaseStatus.Approved)
                    await SeedPhaseAcceptanceAsync(context, phase, tpkt.UserId);
            }

            result[project.Name] = new ProjectBundle(project, leader, engineerA, engineerB, phases, taskMap);
        }

        return result;
    }

    private static (DateOnly Start, DateOnly End)[] BuildPhaseRanges(DateOnly start, DateOnly end)
    {
        var total = Math.Max(80, end.DayNumber - start.DayNumber + 1);
        var d1 = Math.Max(20, total * 18 / 100);
        var d2 = Math.Max(25, total * 28 / 100);
        var d3 = Math.Max(25, total * 34 / 100);
        var p1End = start.AddDays(d1 - 1);
        var p2Start = p1End.AddDays(1);
        var p2End = p2Start.AddDays(d2 - 1);
        var p3Start = p2End.AddDays(1);
        var p3End = p3Start.AddDays(d3 - 1);
        if (p3End >= end) p3End = end.AddDays(-15);
        var p4Start = p3End.AddDays(1);
        return new[] { (start,p1End), (p2Start,p2End), (p3Start,p3End), (p4Start,end) };
    }

    private static string ResolvePhaseStatus(
        string projectStatus,
        DateOnly phaseStart,
        DateOnly phaseEnd,
        DateTime? pausedAt)
    {
        if (projectStatus is ProjectStatus.Completed or ProjectStatus.Closed)
            return PhaseStatus.Approved;

        if (projectStatus == ProjectStatus.Draft)
            return PhaseStatus.Draft;

        var referenceDate = projectStatus == ProjectStatus.Paused && pausedAt.HasValue
            ? DateOnly.FromDateTime(pausedAt.Value)
            : DemoDate;

        if (phaseEnd < referenceDate)
            return PhaseStatus.Approved;

        if (phaseStart <= referenceDate && referenceDate <= phaseEnd)
            return PhaseStatus.InProgress;

        return PhaseStatus.Draft;
    }

    private static async Task<List<ProjectTask>> SeedTasksForPhaseAsync(
        AppDbContext context,
        ProjectSeedSpec spec,
        Project project,
        Phase phase,
        int phaseIndex,
        User leader,
        User engineerA,
        User engineerB,
        User tpkt)
    {
        var groups = spec.Kind == "NewBuild"
            ? BuildNewBuildWbs(spec, phaseIndex)
            : BuildRenovationWbs(spec, phaseIndex);

        var approved = phase.Status == PhaseStatus.Approved;
        var active = phase.Status == PhaseStatus.InProgress;
        var result = new List<ProjectTask>();
        var parentTasks = new List<ProjectTask>();

        byte ProgressForGroup(int groupIndex)
        {
            if (approved) return 100;
            if (!active) return 0;

            // Đảo Dừa 3 cần nhiều trạng thái để bảng tiến độ nhìn thật và tiện demo.
            var mainPattern = new byte[] { 90, 100, 95, 88, 76, 62, 45, 30, 15, 0 };
            var normalPattern = new byte[] { 100, 92, 78, 64, 48, 32, 18, 0 };
            var pattern = spec.Name == MainProjectName ? mainPattern : normalPattern;
            return pattern[groupIndex % pattern.Length];
        }

        string StatusFromProgress(byte progress)
        {
            if (approved) return TaskStatusConstants.Approved;
            if (!active) return TaskStatusConstants.New;
            if (progress >= 100) return TaskStatusConstants.Completed;
            if (progress > 0) return TaskStatusConstants.InProgress;
            return TaskStatusConstants.Assigned;
        }

        var phaseDays = Math.Max(1, phase.EndDate!.Value.DayNumber - phase.StartDate!.Value.DayNumber + 1);
        var parentSlice = Math.Max(1m, phaseDays / (decimal)Math.Max(1, groups.Count));

        for (var g = 0; g < groups.Count; g++)
        {
            var group = groups[g];
            var progress = ProgressForGroup(g);
            var status = StatusFromProgress(progress);

            var parentStart = phase.StartDate.Value.AddDays((int)Math.Floor(g * parentSlice));
            var parentEnd = g == groups.Count - 1
                ? phase.EndDate.Value
                : phase.StartDate.Value.AddDays((int)Math.Floor((g + 1) * parentSlice));

            if (parentEnd < parentStart) parentEnd = parentStart;
            if (parentEnd > phase.EndDate.Value) parentEnd = phase.EndDate.Value;

            var parent = new ProjectTask
            {
                PhaseId = phase.PhaseId,
                Name = group.Name,
                Description = group.Description,
                OrderIndex = g + 1,
                StartDate = parentStart,
                EndDate = parentEnd,
                Status = status,
                ProgressPercent = progress,
                Weight = 1,
                IsLocked = approved,
                IsOutsourced = group.IsOutsourced,
                OutsourcedTeamName = group.IsOutsourced ? group.OutsourcedTeamName : null,
                OutsourcedTeamContact = group.IsOutsourced ? "Liên hệ và điều phối thông qua Chỉ huy trưởng công trình" : null,
                CreatedAt = DateTime.SpecifyKind(parentStart.ToDateTime(new TimeOnly(1, 0)), DateTimeKind.Utc).AddDays(-3),
                CreatedBy = tpkt.UserId
            };

            context.Tasks.Add(parent);
            await context.SaveChangesAsync();
            result.Add(parent);
            parentTasks.Add(parent);

            // Parent được Chỉ huy trưởng theo dõi; leaf mới là đơn vị giao việc hằng ngày cho kỹ sư.
            if (status != TaskStatusConstants.New)
            {
                context.TaskAssignees.Add(new TaskAssignee
                {
                    TaskId = parent.TaskId,
                    UserId = leader.UserId,
                    AssignedAt = parent.CreatedAt.AddHours(2)
                });
            }

            var children = group.Children;
            var parentDays = Math.Max(1, parentEnd.DayNumber - parentStart.DayNumber + 1);
            var childSlice = Math.Max(1m, parentDays / (decimal)Math.Max(1, children.Length));

            for (var c = 0; c < children.Length; c++)
            {
                var childStart = parentStart.AddDays((int)Math.Floor(c * childSlice));
                var childEnd = c == children.Length - 1
                    ? parentEnd
                    : parentStart.AddDays((int)Math.Floor((c + 1) * childSlice));
                if (childEnd < childStart) childEnd = childStart;
                if (childEnd > parentEnd) childEnd = parentEnd;

                var child = new ProjectTask
                {
                    PhaseId = phase.PhaseId,
                    ParentTaskId = parent.TaskId,
                    Name = children[c],
                    Description = $"Thực hiện {children[c].ToLowerInvariant()}; kiểm tra hiện trạng, khối lượng và chất lượng trước khi chuyển bước tiếp theo.",
                    OrderIndex = c + 1,
                    StartDate = childStart,
                    EndDate = childEnd,
                    Status = status,
                    ProgressPercent = progress,
                    Weight = 1,
                    IsLocked = approved,
                    IsOutsourced = group.IsOutsourced,
                    OutsourcedTeamName = group.IsOutsourced ? group.OutsourcedTeamName : null,
                    OutsourcedTeamContact = group.IsOutsourced ? "Liên hệ và điều phối thông qua Chỉ huy trưởng công trình" : null,
                    CreatedAt = parent.CreatedAt.AddMinutes(c + 1),
                    CreatedBy = tpkt.UserId
                };

                context.Tasks.Add(child);
                await context.SaveChangesAsync();
                result.Add(child);

                if (child.Status != TaskStatusConstants.New)
                {
                    var assignee = ((g + c) % 3) switch
                    {
                        0 => engineerA,
                        1 => engineerB,
                        _ => leader
                    };

                    context.TaskAssignees.Add(new TaskAssignee
                    {
                        TaskId = child.TaskId,
                        UserId = assignee.UserId,
                        AssignedAt = child.CreatedAt.AddHours(2)
                    });
                }
            }

            await context.SaveChangesAsync();
        }

        // Quan hệ tiên quyết chỉ đặt ở các hạng mục cha. Leaf vẫn có thể cập nhật nhật ký
        // độc lập trong hạng mục đang triển khai, tránh tự khóa nhau khi demo.
        for (var i = 1; i < parentTasks.Count; i++)
        {
            context.TaskDependencies.Add(new TaskDependency
            {
                TaskId = parentTasks[i].TaskId,
                PredecessorTaskId = parentTasks[i - 1].TaskId
            });
        }

        await context.SaveChangesAsync();
        return result;
    }

    private static List<WbsGroup> BuildNewBuildWbs(ProjectSeedSpec spec, int phaseIndex)
    {
        static WbsGroup G(string name, string desc, string[] children, bool outsourced = false, string? team = null)
            => new(name, desc, children, outsourced, team);

        if (phaseIndex == 0)
        {
            return new List<WbsGroup>
            {
                G("1.1 Công tác chuẩn bị và hạ tầng tạm",
                    "Chuẩn bị điều kiện thi công, bảo vệ khu vực xung quanh và tổ chức mặt bằng.",
                    new[]
                    {
                        "Khảo sát công trình liền kề, chụp ảnh và lập biên bản hiện trạng",
                        "Lắp hàng rào tôn, biển báo và lối ra vào công trường",
                        "Lắp điện thi công tạm, tủ điện bảo vệ và chiếu sáng tạm",
                        "Lắp bồn nước, đường cấp nước tạm và vị trí rửa xe",
                        "Bố trí kho vật tư, khu gia công thép và khu tập kết phế thải"
                    }),

                G("1.2 Trắc đạc, định vị và ép cọc nền móng",
                    "Thiết lập tim mốc, cao độ và thi công hệ cọc theo hồ sơ thiết kế.",
                    new[]
                    {
                        "Định vị tim trục công trình và gửi mốc cao độ ±0.000",
                        "Kiểm tra mặt bằng và đường tiếp cận thiết bị ép cọc",
                        "Tập kết cọc bê tông cốt thép và kiểm tra hồ sơ lô cọc",
                        "Ép cọc thử để xác nhận chiều sâu và lực ép",
                        "Ép cọc đại trà theo thứ tự tim cọc",
                        "Nghiệm thu lực ép cuối và hoàn thiện nhật ký ép cọc"
                    },
                    true, "Đội ép cọc chuyên nghiệp"),

                G("1.3 Đào đất, xử lý hố móng và đầu cọc",
                    "Đào đất, chỉnh sửa hố móng và chuẩn bị đầu cọc trước thi công đài móng.",
                    new[]
                    {
                        "Đào đất hố móng và tuyến giằng móng bằng máy",
                        "Đào sửa thủ công quanh đầu cọc và vị trí chật hẹp",
                        "Bơm thoát nước hố móng và gia cố mép đào khi cần",
                        "Đập đầu cọc đến cao độ thiết kế, làm sạch cốt thép chờ",
                        "Nghiệm thu cao độ đáy móng trước khi đổ bê tông lót"
                    }),

                G("1.4 Bể phốt, bể nước ngầm và hạ tầng ngầm",
                    "Thi công kết cấu, xây trát và chống thấm các bể ngầm trước khi lấp đất.",
                    new[]
                    {
                        "Đào và xử lý nền bể phốt, bể nước ngầm",
                        "Thi công bê tông lót và kết cấu đáy bể",
                        "Xây hoặc đổ thành bể theo hồ sơ thiết kế",
                        "Lắp ống chờ cấp thoát, ống thông hơi và cổ ống",
                        "Tô trát, xử lý góc chân tường và thi công chống thấm",
                        "Ngâm thử nước và nghiệm thu kín nước trước khi lấp"
                    }),

                G("1.5 Đài móng, giằng móng và cổ cột",
                    "Hoàn thiện kết cấu bê tông cốt thép phần móng.",
                    new[]
                    {
                        "Đổ bê tông lót móng và giằng móng",
                        "Gia công, lắp dựng cốt thép đài móng",
                        "Gia công, lắp dựng cốt thép giằng móng",
                        "Lắp thép chờ cột và kiểm tra chiều dài neo",
                        "Lắp dựng cốp pha móng và giằng móng",
                        "Nghiệm thu cốt thép, cốp pha và chi tiết chờ",
                        "Đổ bê tông móng, giằng móng và đầm chặt",
                        "Bảo dưỡng bê tông, tháo cốp pha và lấp đất hoàn trả"
                    })
            };
        }

        if (phaseIndex == 1)
        {
            var groups = new List<WbsGroup>();

            // Lặp cấu trúc thân khung cho từng tầng để danh sách công việc đủ chi tiết như vận hành thực tế.
            for (var floor = 1; floor <= Math.Max(1, spec.FloorCount); floor++)
            {
                var f = $"Tầng {floor}";

                groups.Add(G($"2.{groups.Count + 1} Cột và vách {f}",
                    $"Thi công cốt thép, cốp pha và bê tông cột/vách {f}.",
                    new[]
                    {
                        $"Bắn mực định vị chân cột và vách {f}",
                        $"Gia công, lắp dựng cốt thép cột và vách {f}",
                        $"Lắp con kê, thép râu và chi tiết chờ {f}",
                        $"Lắp dựng cốp pha cột/vách và hệ chống {f}",
                        $"Kiểm tra độ thẳng đứng, kích thước hình học {f}",
                        $"Đổ bê tông cột/vách và bảo dưỡng {f}"
                    }));

                groups.Add(G($"2.{groups.Count + 1} Cốp pha dầm và sàn {f}",
                    $"Lắp hệ chống, xà gồ và ván khuôn dầm sàn {f}.",
                    new[]
                    {
                        $"Lắp hệ giàn giáo và cây chống sàn {f}",
                        $"Lắp xà gồ, đáy dầm và thành dầm {f}",
                        $"Trải ván khuôn mặt sàn {f}",
                        $"Bịt khe, vệ sinh mặt khuôn và quét dầu chống dính {f}",
                        $"Kiểm tra cao độ và độ phẳng cốp pha {f}"
                    }));

                groups.Add(G($"2.{groups.Count + 1} Cốt thép dầm sàn và đường ống âm {f}",
                    $"Gia công cốt thép dầm sàn, đồng thời chốt các tuyến ống và lỗ chờ trước đổ bê tông {f}.",
                    new[]
                    {
                        $"Gia công và lắp cốt thép dầm chính, dầm phụ {f}",
                        $"Rải cốt thép sàn lớp dưới và lắp con kê {f}",
                        $"Lắp ống luồn điện âm sàn và hộp chờ {f}",
                        $"Lắp ống xuyên sàn, ống thoát và lỗ chờ kỹ thuật {f}",
                        $"Rải cốt thép sàn lớp trên và thép tăng cường {f}",
                        $"Nghiệm thu cốt thép, chi tiết chờ và đường ống âm {f}"
                    }));

                groups.Add(G($"2.{groups.Count + 1} Đổ bê tông dầm sàn {f}",
                    $"Đổ, hoàn thiện bề mặt, lấy mẫu và bảo dưỡng bê tông dầm sàn {f}.",
                    new[]
                    {
                        $"Vệ sinh khuôn, tưới ẩm và chốt đường bơm bê tông {f}",
                        $"Kiểm tra phiếu giao bê tông và độ sụt từng đợt {f}",
                        $"Đổ bê tông dầm sàn theo phân khu {f}",
                        $"Đầm dùi, đầm bàn và kiểm soát cao độ mặt sàn {f}",
                        $"Lấy mẫu bê tông phục vụ kiểm tra cường độ {f}",
                        $"Che phủ, tưới nước và bảo dưỡng bê tông {f}"
                    }));
            }

            groups.Add(G($"2.{groups.Count + 1} Cầu thang bê tông cốt thép",
                "Thi công bản thang, chiếu nghỉ và các chi tiết liên kết.",
                new[]
                {
                    "Lắp cốp pha bản thang và chiếu nghỉ",
                    "Gia công lắp cốt thép cầu thang",
                    "Nghiệm thu kích thước, cao độ và cốt thép cầu thang",
                    "Đổ bê tông cầu thang và hoàn thiện bề mặt",
                    "Bảo dưỡng và tháo cốp pha cầu thang"
                }));

            groups.Add(G($"2.{groups.Count + 1} Kết cấu mái và sê-nô",
                "Thi công kết cấu mái, sê-nô và các chi tiết chờ trên mái.",
                new[]
                {
                    "Lắp cốp pha và hệ chống dầm sàn mái",
                    "Gia công lắp cốt thép dầm sàn mái",
                    "Lắp ống thoát mái và chi tiết chờ xuyên sàn",
                    "Đổ bê tông mái, sê-nô và tạo cao độ ban đầu",
                    "Bảo dưỡng bê tông mái và kiểm tra nứt bề mặt"
                }));

            return groups;
        }

        if (phaseIndex == 2)
        {
            return new List<WbsGroup>
            {
                G("3.1 Xây tường bao và tường ngăn",
                    "Xây tường theo đúng tim, chiều dày và vị trí cửa trên hồ sơ kiến trúc.",
                    new[]
                    {
                        "Tập kết gạch, cát và xi măng theo khu vực thi công",
                        "Bật mực tim tường và kiểm tra vị trí cửa",
                        "Xây hàng gạch chân và xử lý liên kết chân tường",
                        "Xây tường bao theo chiều dày thiết kế",
                        "Xây tường ngăn phòng và tường khu vệ sinh",
                        "Lắp lanh tô cửa và thép râu liên kết",
                        "Kiểm tra độ thẳng, phẳng và kích thước ô cửa"
                    }),

                G("3.2 Điện âm tường và hệ thống hộp âm",
                    "Thi công ống luồn, hộp âm và tuyến điện trước khi tô trát.",
                    new[]
                    {
                        "Định vị công tắc, ổ cắm và tủ điện theo bản vẽ",
                        "Cắt rãnh tường đi ống luồn dây điện",
                        "Lắp ống luồn D20/D25 và măng sông nối ống",
                        "Lắp đế âm đơn, đế âm đôi và hộp nối",
                        "Luồn dây mồi, bịt đầu ống và kiểm tra thông tuyến",
                        "Hoàn trả rãnh tường và nghiệm thu tuyến điện âm"
                    }),

                G("3.3 Cấp nước âm và thử áp đường ống",
                    "Lắp đặt đường ống PPR, van khóa và thử áp trước khi che kín.",
                    new[]
                    {
                        "Định vị tuyến cấp nước và cao độ thiết bị",
                        "Lắp ống PPR D20/D25/D32 theo tuyến",
                        "Hàn nhiệt co, tê và các đầu chờ thiết bị",
                        "Lắp van khóa nhánh và cố định đường ống",
                        "Bịt đầu chờ, bơm thử áp và giữ áp theo biện pháp",
                        "Kiểm tra rò rỉ và nghiệm thu trước khi trát/ốp"
                    }),

                G("3.4 Thoát nước âm và hộp kỹ thuật",
                    "Thi công ống thoát PVC, nhánh bồn cầu, phễu sàn và tuyến trục.",
                    new[]
                    {
                        "Định vị lỗ xuyên sàn và trục thoát đứng",
                        "Lắp ống PVC D60/D90 cho nhánh thoát",
                        "Lắp ống PVC D114 cho nhánh bồn cầu và trục chính",
                        "Lắp co, tê và vệ sinh bề mặt trước khi dán keo",
                        "Lắp phễu thu sàn và kiểm soát cao độ",
                        "Thử nước tuyến thoát và nghiệm thu trước khi đóng hộp kỹ thuật"
                    }),

                G("3.5 Tô trát trong và ngoài nhà",
                    "Chuẩn bị bề mặt, đóng lưới chống nứt và tô trát theo mốc ghém.",
                    new[]
                    {
                        "Đục vệ sinh mạch tường và tưới ẩm bề mặt",
                        "Đóng lưới chống nứt tại tiếp giáp bê tông - gạch và rãnh kỹ thuật",
                        "Đắp mốc ghém kiểm soát chiều dày lớp trát",
                        "Tô trát tường trong nhà",
                        "Tô trát tường ngoài nhà",
                        "Kiểm tra độ phẳng bằng thước và sửa khuyết tật"
                    }),

                G("3.6 Chống thấm khu vệ sinh, ban công và mái",
                    "Xử lý cổ ống, góc chân tường, thi công lớp chống thấm và thử nước.",
                    new[]
                    {
                        "Đục vệ sinh cổ ống xuyên sàn và xử lý vữa không co ngót",
                        "Bo góc chân tường và xử lý các khe nứt ổn định",
                        "Vệ sinh, làm ẩm nền và quét lớp chống thấm thứ nhất",
                        "Thi công lớp chống thấm thứ hai đủ định mức",
                        "Be bờ và ngâm thử nước tối thiểu 48 giờ",
                        "Kiểm tra mặt dưới sàn, lập biên bản nghiệm thu kín nước"
                    }),

                G("3.7 Cán nền và chuẩn bị bề mặt ốp lát",
                    "Tạo cốt, độ dốc và mặt nền ổn định trước khi chuyển sang ốp lát.",
                    new[]
                    {
                        "Xác định cốt hoàn thiện và mốc cao độ từng phòng",
                        "Cán nền khu khô theo cao độ thiết kế",
                        "Cán nền khu vệ sinh tạo dốc về phễu thu sàn",
                        "Cán nền ban công/sân thượng tạo dốc thoát nước",
                        "Kiểm tra độ phẳng, độ dốc và vệ sinh bề mặt"
                    })
            };
        }

        return new List<WbsGroup>
        {
            G("4.1 Trần thạch cao và hoàn thiện khe kỹ thuật",
                "Thi công khung, tấm và xử lý mối nối trần trước sơn.",
                new[]
                {
                    "Định vị cao độ trần và vị trí thiết bị âm trần",
                    "Lắp thanh treo và khung xương chính",
                    "Lắp khung xương phụ và gia cường vị trí thiết bị",
                    "Bắn tấm thạch cao tiêu chuẩn/khu vực chịu ẩm",
                    "Xử lý mối nối, đầu vít và khe tiếp giáp",
                    "Kiểm tra độ phẳng trần trước bả sơn"
                }),

            G("4.2 Bả matit, sơn lót và sơn phủ",
                "Hoàn thiện hệ sơn trong/ngoài nhà theo mẫu màu đã duyệt.",
                new[]
                {
                    "Vệ sinh bề mặt và xử lý nứt chân chim",
                    "Bả lớp thứ nhất và sửa khuyết tật bề mặt",
                    "Bả lớp thứ hai, xả nhám và rà phẳng",
                    "Lăn sơn lót kháng kiềm",
                    "Lăn lớp sơn phủ thứ nhất",
                    "Lăn lớp sơn phủ thứ hai và dặm vá"
                }),

            G("4.3 Ốp lát gạch sàn và tường",
                "Thi công gạch theo mốc, kiểm soát cao độ, mạch và bề mặt hoàn thiện.",
                new[]
                {
                    "Kiểm tra lô gạch, phân loại màu và kích thước",
                    "Bật mực, chia viên và chốt mạch gạch",
                    "Lát sàn phòng khách, phòng ngủ và hành lang",
                    "Lát gạch chống trơn khu vệ sinh/ban công",
                    "Ốp gạch tường khu vệ sinh và bếp",
                    "Chà ron, vệ sinh mạch và bảo vệ bề mặt"
                }),

            G("4.4 Cửa, nhôm kính và lan can",
                "Lắp cửa, phụ kiện và các cấu kiện hoàn thiện liên quan.",
                new[]
                {
                    "Kiểm tra kích thước ô chờ trước lắp cửa",
                    "Lắp khung cửa và căn chỉnh cao độ, độ thẳng",
                    "Lắp cánh cửa, khóa, bản lề và phụ kiện",
                    "Lắp hệ nhôm kính theo khu vực",
                    "Bơm silicone làm kín khe tiếp giáp",
                    "Lắp lan can ban công và lan can cầu thang"
                },
                true, "Đội cửa - nhôm kính chuyên nghiệp"),

            G("4.5 Lắp thiết bị điện hoàn thiện",
                "Lắp thiết bị cuối, kiểm tra mạch và vận hành hệ thống điện.",
                new[]
                {
                    "Luồn và đấu nối dây điện các mạch nhánh",
                    "Lắp công tắc, ổ cắm và mặt che",
                    "Lắp aptomat, hoàn thiện tủ điện và dán nhãn mạch",
                    "Lắp đèn chiếu sáng và thiết bị điện cuối",
                    "Đo kiểm cách điện, kiểm tra đóng cắt và thử vận hành"
                }),

            G("4.6 Lắp thiết bị cấp thoát nước và vệ sinh",
                "Lắp thiết bị vệ sinh, vòi, phụ kiện và thử vận hành cấp thoát.",
                new[]
                {
                    "Lắp bồn cầu và đấu nối ống thoát D114",
                    "Lắp lavabo, vòi và bộ xả",
                    "Lắp sen tắm và phụ kiện phòng tắm",
                    "Lắp phễu thu sàn, nắp thăm và hoàn thiện silicone",
                    "Mở nước thử kín, thử thoát và xử lý rò rỉ"
                }),

            G("4.7 Sân, cổng, tường rào và ngoại cảnh",
                "Hoàn thiện hạ tầng ngoài nhà và các hạng mục tiếp giáp.",
                new[]
                {
                    "Thi công hố ga và tuyến thoát nước quanh nhà",
                    "Thi công tường rào và trụ cổng",
                    "Lắp cổng và phụ kiện đóng mở",
                    "Cán nền sân và tạo dốc thoát nước",
                    "Lát gạch sân chống trơn và hoàn thiện cảnh quan"
                }),

            G("4.8 Kiểm tra hoàn thiện, vệ sinh và bàn giao",
                "Rà soát chất lượng, sửa lỗi tồn tại, vệ sinh và hoàn thiện hồ sơ bàn giao.",
                new[]
                {
                    "Kiểm tra nội bộ từng phòng và lập danh sách lỗi cần sửa",
                    "Sửa lỗi ốp lát, sơn, cửa và thiết bị",
                    "Vệ sinh công nghiệp thô, thu gom phế thải",
                    "Vệ sinh tinh kính, sàn, thiết bị và bề mặt hoàn thiện",
                    "Kiểm tra vận hành điện nước lần cuối",
                    "Tập hợp bản vẽ hoàn công và hồ sơ nghiệm thu",
                    "Tổ chức nghiệm thu bàn giao với Chủ đầu tư"
                })
        };
    }

    private static List<WbsGroup> BuildRenovationWbs(ProjectSeedSpec spec, int phaseIndex)
    {
        static WbsGroup G(string name, string desc, string[] children, bool outsourced = false, string? team = null)
            => new(name, desc, children, outsourced, team);

        if (phaseIndex == 0)
        {
            return new List<WbsGroup>
            {
                G("1.1 Khảo sát và lập hồ sơ hiện trạng",
                    "Ghi nhận đầy đủ hiện trạng trước khi tháo dỡ và thống nhất phạm vi giữ lại.",
                    new[]
                    {
                        "Khảo sát kích thước hiện trạng từng khu vực",
                        "Chụp ảnh tường, sàn, trần, cửa và thiết bị hiện hữu",
                        "Kiểm tra sơ bộ hệ thống điện, cấp nước và thoát nước",
                        "Đánh dấu khu vực giữ lại, khu vực tháo dỡ",
                        "Chốt các điểm cần Chủ đầu tư xác nhận trước thi công"
                    }),

                G("1.2 Che chắn và bảo vệ phần giữ lại",
                    "Bảo vệ thang máy, cửa, sàn và khu vực không nằm trong phạm vi cải tạo.",
                    new[]
                    {
                        "Trải vật liệu bảo vệ sàn và lối vận chuyển",
                        "Che chắn cửa, kính và thiết bị giữ lại",
                        "Bố trí vách ngăn bụi tạm thời",
                        "Bố trí biển báo, bình chữa cháy và lối thoát an toàn",
                        "Thiết lập vị trí tập kết vật tư và phế thải"
                    }),

                G("1.3 Tháo dỡ hoàn thiện cũ",
                    "Tháo dỡ có kiểm soát để hạn chế ảnh hưởng kết cấu và phần giữ lại.",
                    new[]
                    {
                        "Ngắt điện, khóa nước khu vực trước khi tháo dỡ",
                        "Tháo thiết bị vệ sinh và thiết bị điện cũ",
                        "Tháo trần, vách nhẹ và đồ gắn cố định",
                        "Đục gạch lát sàn và gạch ốp tường cần thay",
                        "Phá dỡ tường ngăn theo phạm vi được duyệt",
                        "Phân loại vật tư tái sử dụng và phế thải"
                    },
                    true, "Đội tháo dỡ và vận chuyển phế thải"),

                G("1.4 Thu gom, vận chuyển phế thải",
                    "Giữ mặt bằng gọn, không để phế thải cản trở lối đi và khu vực dân cư.",
                    new[]
                    {
                        "Đóng bao, phân loại phế thải theo đợt",
                        "Vận chuyển phế thải ra vị trí tập kết",
                        "Bốc xếp lên xe và vệ sinh đường vận chuyển",
                        "Vệ sinh thô mặt bằng sau tháo dỡ"
                    }),

                G("1.5 Định vị lại tim cốt và phạm vi sửa chữa",
                    "Chốt tim tường, cốt sàn và kích thước trước khi sửa phần thô.",
                    new[]
                    {
                        "Bật mực vị trí tường ngăn mới",
                        "Xác định cốt nền hoàn thiện mới",
                        "Định vị cửa, thiết bị vệ sinh và khu bếp",
                        "Định vị trục kỹ thuật và các tuyến điện nước",
                        "Nghiệm thu kích thước trước khi xây sửa"
                    })
            };
        }

        if (phaseIndex == 1)
        {
            return new List<WbsGroup>
            {
                G("2.1 Sửa chữa tường, nền và vị trí nứt",
                    "Xử lý phần thô hư hỏng sau tháo dỡ trước khi đi hệ thống âm.",
                    new[]
                    {
                        "Đục mở và vệ sinh các vị trí nứt cần xử lý",
                        "Xử lý nứt tường và mạch tiếp giáp",
                        "Xây bù tường, vá lỗ mở và chỉnh ô cửa",
                        "Sửa nền bong rỗng và vị trí cao độ không phù hợp",
                        "Kiểm tra lại bề mặt trước công tác tiếp theo"
                    }),

                G("2.2 Điện âm và hộp âm cải tạo",
                    "Đi lại tuyến điện theo bố trí nội thất và thiết bị mới.",
                    new[]
                    {
                        "Định vị công tắc, ổ cắm và thiết bị mới",
                        "Cắt rãnh tường theo tuyến điện điều chỉnh",
                        "Lắp ống luồn D20/D25 và măng sông",
                        "Lắp đế âm đơn/đôi và hộp nối",
                        "Luồn dây mồi, bịt đầu ống và kiểm tra thông tuyến"
                    }),

                G("2.3 Cấp nước cải tạo và thử áp",
                    "Đi lại đường cấp PPR, khóa nhánh và kiểm tra kín nước.",
                    new[]
                    {
                        "Định vị tuyến cấp và vị trí thiết bị",
                        "Lắp ống PPR D20/D25",
                        "Lắp co, tê, van và đầu chờ",
                        "Cố định ống trước khi hoàn trả rãnh",
                        "Bơm thử áp và kiểm tra rò rỉ"
                    }),

                G("2.4 Thoát nước cải tạo",
                    "Điều chỉnh đường thoát theo vị trí thiết bị mới.",
                    new[]
                    {
                        "Mở hộp kỹ thuật và xác định điểm đấu nối",
                        "Lắp PVC D60/D90 cho thoát sàn, lavabo",
                        "Lắp PVC D114 cho bồn cầu khi thay đổi vị trí",
                        "Lắp co, tê, phễu thu và dán keo các mối nối",
                        "Thử nước tuyến thoát trước khi che kín"
                    }),

                G("2.5 Chống thấm khu vực ướt",
                    "Xử lý cổ ống và thi công chống thấm trước cán nền/ốp lát.",
                    new[]
                    {
                        "Vệ sinh nền và xử lý cổ ống",
                        "Bo góc chân tường và xử lý điểm nứt",
                        "Thi công lớp chống thấm thứ nhất",
                        "Thi công lớp chống thấm thứ hai",
                        "Ngâm thử nước tối thiểu 48 giờ",
                        "Nghiệm thu kín nước trước cán nền"
                    }),

                G("2.6 Tô vá, hoàn trả rãnh và cán nền",
                    "Hoàn trả bề mặt sau khi hệ thống âm đã nghiệm thu.",
                    new[]
                    {
                        "Đóng lưới tại rãnh điện nước và vị trí tiếp giáp",
                        "Tô vá rãnh điện nước",
                        "Tô sửa tường và cạnh cửa",
                        "Cán nền khu khô theo cốt hoàn thiện",
                        "Cán nền khu vệ sinh tạo dốc thoát nước",
                        "Kiểm tra độ phẳng và độ dốc"
                    })
            };
        }

        if (phaseIndex == 2)
        {
            return new List<WbsGroup>
            {
                G("3.1 Ốp lát sàn và tường",
                    "Thi công gạch mới theo mặt bằng và mẫu hoàn thiện đã chốt.",
                    new[]
                    {
                        "Kiểm tra lô gạch, phân loại màu và kích thước",
                        "Bật mực chia viên, chốt mạch và cao độ",
                        "Lát gạch sàn khu khô",
                        "Lát gạch chống trơn khu vệ sinh/ban công",
                        "Ốp gạch tường khu vệ sinh và bếp",
                        "Chà ron, vệ sinh và bảo vệ mặt gạch"
                    }),

                G("3.2 Trần thạch cao và khe kỹ thuật",
                    "Hoàn thiện trần mới, cửa thăm và vị trí thiết bị âm trần.",
                    new[]
                    {
                        "Định vị cao độ trần",
                        "Lắp thanh treo và khung xương",
                        "Gia cường vị trí đèn và cửa thăm",
                        "Bắn tấm thạch cao",
                        "Xử lý mối nối và đầu vít",
                        "Rà phẳng trước bả sơn"
                    },
                    true, "Đội trần thạch cao hoàn thiện"),

                G("3.3 Bả và sơn lót",
                    "Chuẩn bị bề mặt trước khi sơn màu hoàn thiện.",
                    new[]
                    {
                        "Vệ sinh và xử lý khuyết tật tường",
                        "Bả lớp thứ nhất",
                        "Bả lớp thứ hai",
                        "Xả nhám, soi đèn kiểm tra độ phẳng",
                        "Lăn sơn lót kháng kiềm"
                    }),

                G("3.4 Sơn phủ hoàn thiện",
                    "Hoàn thiện màu sắc theo mẫu duyệt và bảo vệ bề mặt.",
                    new[]
                    {
                        "Pha/chốt mã màu theo mẫu",
                        "Sơn phủ lớp thứ nhất",
                        "Kiểm tra lỗi sau lớp thứ nhất",
                        "Sơn phủ lớp thứ hai",
                        "Dặm vá góc cạnh và vị trí tiếp giáp",
                        "Vệ sinh, bóc băng che và nghiệm thu màu"
                    }),

                G("3.5 Lắp thiết bị điện hoàn thiện",
                    "Hoàn thiện công tắc, ổ cắm, đèn và tủ điện.",
                    new[]
                    {
                        "Luồn dây điện các mạch nhánh",
                        "Lắp công tắc và ổ cắm",
                        "Lắp aptomat và hoàn thiện tủ điện",
                        "Lắp đèn và thiết bị điện cuối",
                        "Đo kiểm và thử vận hành các mạch"
                    }),

                G("3.6 Lắp thiết bị cấp thoát nước",
                    "Lắp thiết bị vệ sinh và thử vận hành cấp thoát.",
                    new[]
                    {
                        "Lắp bồn cầu và đấu nối thoát D114",
                        "Lắp lavabo, vòi và bộ xả",
                        "Lắp sen tắm, vòi và phụ kiện",
                        "Lắp phễu thu sàn và hoàn thiện silicone",
                        "Mở nước thử kín và thử thoát"
                    }),

                G("3.7 Lắp cửa, kính và phụ kiện",
                    "Lắp cửa và hoàn thiện các khe tiếp giáp.",
                    new[]
                    {
                        "Kiểm tra kích thước ô cửa",
                        "Lắp khung và căn chỉnh",
                        "Lắp cánh, khóa và bản lề",
                        "Lắp kính/phụ kiện theo thiết kế",
                        "Bơm silicone và vệ sinh hoàn thiện"
                    },
                    true, "Đội cửa - kính hoàn thiện"),

                G("3.8 Kiểm tra chất lượng hoàn thiện",
                    "Rà soát từng không gian trước khi chuyển sang giai đoạn bàn giao.",
                    new[]
                    {
                        "Kiểm tra cao độ, mạch và bề mặt ốp lát",
                        "Kiểm tra độ phẳng và màu sơn",
                        "Kiểm tra khe cửa và phụ kiện",
                        "Kiểm tra công tắc, ổ cắm và đèn",
                        "Kiểm tra thiết bị vệ sinh và thoát nước",
                        "Lập danh sách lỗi cần sửa"
                    })
            };
        }

        return new List<WbsGroup>
        {
            G("4.1 Kiểm tra vận hành điện",
                "Kiểm tra an toàn và khả năng vận hành của các mạch điện hoàn thiện.",
                new[]
                {
                    "Kiểm tra tủ điện và nhãn mạch",
                    "Thử đóng cắt aptomat",
                    "Thử công tắc, ổ cắm và thiết bị",
                    "Kiểm tra đèn và tải cơ bản"
                }),

            G("4.2 Kiểm tra cấp thoát nước",
                "Kiểm tra rò rỉ, áp lực và khả năng thoát nước.",
                new[]
                {
                    "Mở nước thử các điểm cấp",
                    "Kiểm tra mối nối và van khóa",
                    "Xả thử lavabo, sàn và bồn cầu",
                    "Kiểm tra mùi và khả năng thoát tại phễu sàn"
                }),

            G("4.3 Sửa các lỗi hoàn thiện còn lại",
                "Khắc phục toàn bộ lỗi đã ghi nhận trong đợt kiểm tra nội bộ.",
                new[]
                {
                    "Sửa lỗi gạch và mạch chà ron",
                    "Dặm vá sơn và xử lý vết bẩn",
                    "Căn chỉnh cửa, khóa và bản lề",
                    "Xử lý rò rỉ điện nước nếu có",
                    "Kiểm tra lại các lỗi sau sửa"
                }),

            G("4.4 Vệ sinh công nghiệp",
                "Vệ sinh từ thô đến tinh trước nghiệm thu bàn giao.",
                new[]
                {
                    "Thu gom phế thải và vật tư thừa",
                    "Vệ sinh thô sàn, tường và trần",
                    "Tẩy vết sơn/keo bám trên bề mặt",
                    "Lau kính, cửa và thiết bị",
                    "Hút bụi và vệ sinh tinh từng phòng"
                },
                true, "Đội vệ sinh công nghiệp"),

            G("4.5 Nghiệm thu nội bộ và bàn giao",
                "Chốt chất lượng, hồ sơ và hiện trạng trước bàn giao cho Chủ đầu tư.",
                new[]
                {
                    "Nghiệm thu nội bộ từng phòng/khu vực",
                    "Đối chiếu phạm vi đã hoàn thành với hồ sơ",
                    "Tập hợp ảnh, biên bản và tài liệu hoàn công",
                    "Hướng dẫn sử dụng thiết bị cần thiết",
                    "Tổ chức nghiệm thu và bàn giao cho Chủ đầu tư"
                })
        };
    }

    private static async Task SeedBoqForPhaseAsync(
        AppDbContext context,
        ProjectSeedSpec spec,
        Phase phase,
        int phaseIndex,
        Dictionary<string, MaterialCatalog> materials,
        Dictionary<string, Unit> units,
        long createdBy)
    {
        decimal Q(decimal raw, string unitCode)
        {
            var scaled = raw * spec.ScaleFactor;

            // Số lượng theo đơn vị nguyên phải là số nguyên để không sinh seed trái validator.
            if (units[unitCode].IsDiscrete)
                return Math.Ceiling(scaled);

            return Math.Round(scaled, 2);
        }

        BoqLine B(string material, string unit, decimal raw) => new(material, unit, Q(raw, unit));

        List<BoqLine> lines;

        if (spec.Kind == "NewBuild")
        {
            var floorFactor = Math.Max(1, spec.FloorCount) / 3m;

            lines = phaseIndex switch
            {
                0 => new()
                {
                    B("BT-TUOI-M100", "M3", 18m),
                    B("BT-TUOI-M250", "M3", 55m),
                    B("THEP-HP-D10", "CAY", 260m),
                    B("THEP-HP-D12", "CAY", 320m),
                    B("THEP-HP-D14", "CAY", 150m),
                    B("THEP-HP-D16", "CAY", 210m),
                    B("THEP-HP-D18", "CAY", 110m),
                    B("THEP-HP-D20", "CAY", 85m),
                    B("DAY-THEP-BUOC-1", "KG", 180m),
                    B("VAN-PHU-PHIM-18", "TAM", 120m),
                    B("CAY-CHONG-THEP-3M", "CAY", 160m),
                    B("TY-REN-COPPHA-D17", "BO", 90m),
                    B("DAU-COPPHA-20L", "THUNG", 5m),
                    B("GACH-DAC-A1", "VIEN", 1600m),
                    B("XM-VICEM-PCB40", "BAO", 160m),
                    B("CAT-XAY-TO", "M3", 18m),
                    B("DA-4X6", "M3", 16m),
                    B("PVC-D90", "CAY", 16m),
                    B("PVC-D114", "CAY", 20m)
                },

                1 => new()
                {
                    B("BT-TUOI-M300", "M3", 155m * floorFactor),
                    B("THEP-HP-D6", "TAN", 1.8m * floorFactor),
                    B("THEP-HP-D8", "TAN", 2.4m * floorFactor),
                    B("THEP-HP-D10", "CAY", 420m * floorFactor),
                    B("THEP-HP-D12", "CAY", 520m * floorFactor),
                    B("THEP-HP-D14", "CAY", 360m * floorFactor),
                    B("THEP-HP-D16", "CAY", 430m * floorFactor),
                    B("THEP-HP-D18", "CAY", 260m * floorFactor),
                    B("THEP-HP-D20", "CAY", 180m * floorFactor),
                    B("THEP-HP-D22", "CAY", 70m * floorFactor),
                    B("DAY-THEP-BUOC-1", "KG", 340m * floorFactor),
                    B("VAN-PHU-PHIM-18", "TAM", 260m * floorFactor),
                    B("CAY-CHONG-THEP-3M", "CAY", 360m * floorFactor),
                    B("TY-REN-COPPHA-D17", "BO", 180m * floorFactor),
                    B("DAU-COPPHA-20L", "THUNG", 9m * floorFactor),
                    B("ONG-LUON-D20", "CAY", 90m * floorFactor),
                    B("ONG-LUON-D25", "CAY", 45m * floorFactor),
                    B("PVC-D90", "CAY", 22m * floorFactor),
                    B("PVC-D114", "CAY", 18m * floorFactor)
                },

                2 => new()
                {
                    B("XM-INSEE-PCB40", "BAO", 720m),
                    B("XM-ROI-PCB40", "TAN", 12m),
                    B("CAT-XAY-TO", "M3", 78m),
                    B("GACH-2LO-220", "VIEN", 6500m),
                    B("GACH-4LO-80", "VIEN", 9500m),
                    B("GACH-6LO-100", "VIEN", 7000m),
                    B("GACH-DAC-A1", "VIEN", 2200m),
                    B("SIKA-TOP-107", "BO", 38m),
                    B("SIKA-GROUT-214", "BAO", 15m),
                    B("CADIVI-CV1.5", "CUON", 16m),
                    B("CADIVI-CV2.5", "CUON", 18m),
                    B("CADIVI-CV4", "CUON", 9m),
                    B("CADIVI-CV6", "MET", 280m),
                    B("ONG-LUON-D20", "CAY", 160m),
                    B("ONG-LUON-D25", "CAY", 80m),
                    B("MANG-SONG-D20", "CAI", 420m),
                    B("MANG-SONG-D25", "CAI", 180m),
                    B("DE-AM-DON", "CAI", 150m),
                    B("DE-AM-DOI", "CAI", 70m),
                    B("PVC-D60", "CAY", 36m),
                    B("PVC-D90", "CAY", 48m),
                    B("PVC-D114", "CAY", 42m),
                    B("CO-PVC-D90", "CAI", 44m),
                    B("TE-PVC-D90", "CAI", 24m),
                    B("CO-PVC-D114", "CAI", 32m),
                    B("TE-PVC-D114", "CAI", 18m),
                    B("KEO-PVC-500", "CHAI", 24m),
                    B("PPR-D20", "CAY", 55m),
                    B("PPR-D25", "CAY", 44m),
                    B("PPR-D32", "CAY", 22m),
                    B("CO-PPR-D25", "CAI", 60m),
                    B("TE-PPR-D25", "CAI", 34m),
                    B("VAN-BI-D25", "CAI", 20m),
                    B("BANG-TAN-PTFE", "CUON", 40m),
                    B("PHEU-THU-SAN-90", "CAI", 24m)
                },

                _ => new()
                {
                    B("WEBER-ST250", "BAO", 160m),
                    B("WEBER-FIX-PRO", "BAO", 90m),
                    B("KEO-CHA-RON-5", "HOP", 70m),
                    B("GACH-POR-600", "M2", 620m),
                    B("GACH-CER-300", "M2", 340m),
                    B("GACH-CT-300", "M2", 95m),
                    B("BOT-BA-40", "BAO", 140m),
                    B("BOT-BA-NGOAI-40", "BAO", 62m),
                    B("SON-LOT-NOI-18", "THUNG", 30m),
                    B("SON-NOI-18", "THUNG", 52m),
                    B("SON-NGOAI-18", "THUNG", 24m),
                    B("TAM-THACH-CAO-9", "TAM", 260m),
                    B("TAM-THACH-CAO-AM-9", "TAM", 55m),
                    B("KHUNG-XUONG-CHINH", "CAY", 190m),
                    B("KHUNG-XUONG-PHU", "CAY", 360m),
                    B("VIT-THACH-CAO", "HOP", 22m),
                    B("MCB-1P-20A", "CAI", 28m),
                    B("O-CAM-DOI", "CAI", 95m),
                    B("CONG-TAC-1", "CAI", 80m),
                    B("BON-CAU-2KHOI", "BO", 8m),
                    B("LAVABO-TREO", "BO", 8m),
                    B("SEN-TAM-NONG-LANH", "BO", 8m),
                    B("VOI-LAVABO", "CAI", 8m),
                    B("SILICONE-300", "TUYP", 45m),
                    B("KHOA-CUA-PHONG", "BO", 18m),
                    B("BAN-LE-CUA", "CAI", 60m)
                }
            };
        }
        else
        {
            lines = phaseIndex switch
            {
                0 => new()
                {
                    B("DINH-THEP-5CM", "KG", 18m),
                    B("GACH-DAC-A1", "VIEN", 450m),
                    B("XM-INSEE-PCB40", "BAO", 30m),
                    B("CAT-XAY-TO", "M3", 4m)
                },

                1 => new()
                {
                    B("XM-INSEE-PCB40", "BAO", 210m),
                    B("GACH-2LO-220", "VIEN", 1800m),
                    B("GACH-4LO-80", "VIEN", 2200m),
                    B("GACH-DAC-A1", "VIEN", 600m),
                    B("CAT-XAY-TO", "M3", 24m),
                    B("SIKA-TOP-107", "BO", 22m),
                    B("SIKA-GROUT-214", "BAO", 8m),
                    B("CADIVI-CV1.5", "CUON", 7m),
                    B("CADIVI-CV2.5", "CUON", 8m),
                    B("CADIVI-CV4", "CUON", 4m),
                    B("ONG-LUON-D20", "CAY", 70m),
                    B("ONG-LUON-D25", "CAY", 28m),
                    B("MANG-SONG-D20", "CAI", 180m),
                    B("MANG-SONG-D25", "CAI", 70m),
                    B("DE-AM-DON", "CAI", 65m),
                    B("DE-AM-DOI", "CAI", 28m),
                    B("PVC-D60", "CAY", 12m),
                    B("PVC-D90", "CAY", 18m),
                    B("PVC-D114", "CAY", 14m),
                    B("CO-PVC-D90", "CAI", 18m),
                    B("TE-PVC-D90", "CAI", 10m),
                    B("CO-PVC-D114", "CAI", 12m),
                    B("TE-PVC-D114", "CAI", 6m),
                    B("KEO-PVC-500", "CHAI", 10m),
                    B("PPR-D20", "CAY", 26m),
                    B("PPR-D25", "CAY", 20m),
                    B("CO-PPR-D25", "CAI", 30m),
                    B("TE-PPR-D25", "CAI", 16m),
                    B("VAN-BI-D25", "CAI", 10m),
                    B("BANG-TAN-PTFE", "CUON", 20m),
                    B("PHEU-THU-SAN-90", "CAI", 12m)
                },

                2 => new()
                {
                    B("WEBER-ST250", "BAO", 82m),
                    B("WEBER-FIX-PRO", "BAO", 46m),
                    B("KEO-CHA-RON-5", "HOP", 32m),
                    B("GACH-POR-600", "M2", 280m),
                    B("GACH-CER-300", "M2", 145m),
                    B("GACH-CT-300", "M2", 42m),
                    B("BOT-BA-40", "BAO", 68m),
                    B("SON-LOT-NOI-18", "THUNG", 16m),
                    B("SON-NOI-18", "THUNG", 25m),
                    B("SON-NGOAI-18", "THUNG", 8m),
                    B("TAM-THACH-CAO-9", "TAM", 135m),
                    B("TAM-THACH-CAO-AM-9", "TAM", 28m),
                    B("KHUNG-XUONG-CHINH", "CAY", 92m),
                    B("KHUNG-XUONG-PHU", "CAY", 175m),
                    B("VIT-THACH-CAO", "HOP", 12m),
                    B("MCB-1P-20A", "CAI", 12m),
                    B("O-CAM-DOI", "CAI", 42m),
                    B("CONG-TAC-1", "CAI", 36m),
                    B("BON-CAU-2KHOI", "BO", 4m),
                    B("LAVABO-TREO", "BO", 4m),
                    B("SEN-TAM-NONG-LANH", "BO", 4m),
                    B("VOI-LAVABO", "CAI", 4m),
                    B("SILICONE-300", "TUYP", 20m),
                    B("KHOA-CUA-PHONG", "BO", 9m),
                    B("BAN-LE-CUA", "CAI", 30m)
                },

                _ => new()
                {
                    B("SON-NOI-18", "THUNG", 4m),
                    B("BOT-BA-40", "BAO", 8m),
                    B("KEO-CHA-RON-5", "HOP", 8m),
                    B("SILICONE-300", "TUYP", 10m),
                    B("O-CAM-DOI", "CAI", 6m),
                    B("CONG-TAC-1", "CAI", 6m),
                    B("BANG-TAN-PTFE", "CUON", 6m)
                }
            };
        }

        foreach (var line in lines)
        {
            var material = materials[line.MaterialCode];
            var unit = units[line.UnitCode];
            var rate = await GetConversionRateAsync(context, material, unit);

            context.BOQItems.Add(new BOQItem
            {
                PhaseId = phase.PhaseId,
                MaterialId = material.MaterialId,
                UnitId = unit.UnitId,
                Quantity = line.Quantity,
                ConversionRate = rate,
                CreatedAt = phase.CreatedAt.AddHours(1),
                CreatedBy = createdBy
            });
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedPhaseAcceptanceAsync(AppDbContext context, Phase phase, long acceptedBy)
    {
        var at = DateTime.SpecifyKind(phase.EndDate!.Value.ToDateTime(new TimeOnly(9, 0)), DateTimeKind.Utc).AddDays(1);
        var acceptance = new PhaseAcceptance
        {
            PhaseId = phase.PhaseId,
            AcceptedBy = acceptedBy,
            AcceptanceDate = at,
            ReportContent = $"Nghiệm thu {phase.Name}: các công việc trong phạm vi đã hoàn thành 100%, hồ sơ nội bộ và hiện trạng phù hợp để khóa giai đoạn.",
            PdfUrl = null,
            IsCancelled = false,
            CreatedAt = at,
            CreatedBy = acceptedBy
        };
        context.PhaseAcceptances.Add(acceptance);
        await context.SaveChangesAsync();
        // Không seed URL PDF giả. Biên bản tạo thật qua luồng nghiệp vụ sẽ có file thật.
        await context.SaveChangesAsync();
    }

    // -------------------------------------------------------------------------
    // DỰ ÁN DEMO CHÍNH: yêu cầu vật tư -> PO -> nhập kho -> xuất/hoàn -> nhật ký
    // -> sự cố/điều chỉnh -> mua trực tiếp. Dữ liệu được sắp để demo xuyên suốt.
    // -------------------------------------------------------------------------
    private static async Task SeedMainDemoLifecycleAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var b = projects[MainProjectName];
        var project = b.Project;
        var phase = b.Phases[2]; // active finishing phase
        var leader = b.Leader;
        var engineer = b.EngineerA;
        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];
        var tpkt = users["tpkt@bpg.com"];

        // BOQ hiện có là đầu vào bất biến. Kịch bản vượt định mức được tính từ
        // chính hạn mức đã seed, không sửa BOQ để hợp thức hóa dữ liệu YCVT.
        var demoTileBoq = await context.BOQItems.FirstAsync(item =>
            item.PhaseId == phase.PhaseId &&
            item.MaterialId == materials["GACH-POR-600"].MaterialId &&
            !item.IsDeleted);
        var tileLimitInRequestUnit = demoTileBoq.Quantity /
            (demoTileBoq.ConversionRate > 0 ? demoTileBoq.ConversionRate : 1m);
        const decimal receivedTileRequestQuantity = 140m;
        const decimal tileOverAmount = 14m;
        var overTileRequestQuantity = tileLimitInRequestUnit - receivedTileRequestQuantity + tileOverAmount;

        // Nhật ký thi công trên các công việc chi tiết đang triển khai, kèm lịch sử tiến độ và bình luận.
        var phaseLeafTasks = b.TasksByPhase[phase.PhaseId]
            .Where(t => t.ParentTaskId != null)
            .ToList();

        var tileTask = phaseLeafTasks.FirstOrDefault(t =>
            t.Name.Contains("Lát gạch sàn khu khô", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Không tìm thấy công việc ốp lát chi tiết của dự án demo.");

        var paintTask = phaseLeafTasks.FirstOrDefault(t =>
            t.Name.Contains("Sơn phủ lớp thứ hai", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Không tìm thấy công việc sơn phủ chi tiết của dự án demo.");

        await SeedDailyLogAsync(context, tileTask, 70, 95, engineer,
            "Ốp lát khu vực tầng 1 đạt 95%; đã kiểm tra cao độ, mạch gạch và vệ sinh bề mặt.",
            SeedUtc.AddDays(-5));

        var lastLog = await SeedDailyLogAsync(context, paintTask, 88, 100, leader,
            "Hoàn thành sơn phủ khu vực theo phạm vi kế hoạch; đã kiểm tra màu sắc, độ phủ và các vị trí tiếp giáp.",
            SeedUtc.AddDays(-3));
        context.Comments.Add(new Comment
        {
            LogId = lastLog.LogId,
            AuthorId = tpkt.UserId,
            Content = "Tiếp tục kiểm tra độ phẳng và che chắn bề mặt hoàn thiện trước khi sơn phủ lớp cuối.",
            CreatedAt = SeedUtc.AddDays(-3).AddHours(2),
            CreatedBy = tpkt.UserId
        });
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.DailyLog,
            EntityId = lastLog.LogId,
            AttachmentType = AttachmentType.DailyLogPhoto,
            FileName = "dao-dua-3-nhat-ky-hoan-thien.jpg",
            FileUrl = SeedImageRenovation,
            ContentType = "image/jpeg",
            FileSizeBytes = 420_000,
            CreatedAt = lastLog.CreatedAt,
            CreatedBy = lastLog.CreatedBy
        });
        await context.SaveChangesAsync();

        // 1) Yêu cầu đã duyệt -> PO đã nhận đủ, tạo tồn kho nền ổn định cho demo.
        var request1 = await CreateMaterialRequestAsync(context, phase, leader, accountant, null,
            MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ,
            "Cấp vật tư ốp lát, sơn và điện nước theo kế hoạch hoàn thiện tuần 33.",
            "Đã đối chiếu BOQ, tồn hiện tại và khối lượng thi công còn lại; đề nghị mua theo tiến độ giao 2 đợt.",
            null,
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 45m, false, (string?)null),
                (materials["GACH-POR-600"], master.Units["M2"], receivedTileRequestQuantity, false, (string?)null),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m, false, (string?)null),
                (materials["O-CAM-DOI"], master.Units["CAI"], 4m, false, (string?)null)
            }, SeedUtc.AddDays(-18));

        var po1 = await CreatePurchaseOrderAsync(context, request1, project,
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"], accountant, director,
            PurchaseOrderStatus.FullyReceived, "PO-DEMO-DAO-DUA-001", SeedUtc.AddDays(-16),
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 45m, 225_000m),
                (materials["GACH-POR-600"], master.Units["M2"], receivedTileRequestQuantity, 285_000m),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m, 2_650_000m),
                (materials["O-CAM-DOI"], master.Units["CAI"], 4m, 82_000m)
            }, "Đã phê duyệt đơn giá và điều kiện giao vật tư theo tiến độ hoàn thiện.");

        await CreateGoodsReceiptAsync(context, po1, leader, GoodsReceiptStatus.Approved,
            "GR-DEMO-DAO-DUA-001", "Xe giao hàng NCC – biển số demo 29C-123.45", "BBGH-0826-001",
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 45m),
                (materials["GACH-POR-600"], master.Units["M2"], receivedTileRequestQuantity),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m),
                (materials["O-CAM-DOI"], master.Units["CAI"], 4m)
            }, SeedUtc.AddDays(-13));

        // 2) Yêu cầu vượt BOQ đang chờ Giám đốc; Kế toán đã kiểm tra và ghi rõ căn cứ trình duyệt.
        await CreateMaterialRequestAsync(context, phase, leader, accountant, null,
            MaterialRequestStatus.WaitingApproval, BOQCheckStatus.OverBOQ,
            "Bổ sung gạch porcelain do thay đổi bố trí khu sinh hoạt chung và tăng tỷ lệ dự phòng cắt hao.",
            $"BOQ còn {overTileRequestQuantity - tileOverAmount:N0} m²; hiện trường cần thêm {overTileRequestQuantity:N0} m². Tồn khả dụng tại Đảo Dừa 3 không đủ cho phần phát sinh. Đề nghị Giám đốc chấp thuận ngoại lệ {tileOverAmount:N0} m² vượt định mức.",
            null,
            new[]
            {
                (materials["GACH-POR-600"], master.Units["M2"], overTileRequestQuantity, true, (string?)"Vượt 14 m² so với phần định mức còn lại do thay đổi phạm vi hoàn thiện.")
            }, SeedUtc.AddDays(-2));

        // 3) Yêu cầu đã duyệt, PO đang chờ Giám đốc để tiện demo bước phê duyệt đơn mua.
        var request2 = await CreateMaterialRequestAsync(context, phase, leader, accountant, null,
            MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ,
            "Bổ sung keo dán gạch và bột bả cho khu vực tầng 2.",
            "Định mức còn đủ; so sánh tồn hiện tại và tiến độ thi công cho thấy cần cấp trong tuần.",
            null,
            new[]
            {
                (materials["WEBER-FIX-PRO"], master.Units["BAO"], 18m, false, (string?)null),
                (materials["WEBER-ST250"], master.Units["BAO"], 12m, false, (string?)null)
            }, SeedUtc.AddDays(-4));

        await CreatePurchaseOrderAsync(context, request2, project,
            master.Suppliers["Saint-Gobain Việt Nam - Weber"], accountant, null,
            PurchaseOrderStatus.PendingApproval, "PO-DEMO-DAO-DUA-002", SeedUtc.AddDays(-1),
            new[]
            {
                (materials["WEBER-FIX-PRO"], master.Units["BAO"], 18m, 285_000m),
                (materials["WEBER-ST250"], master.Units["BAO"], 12m, 225_000m)
            }, null);

        // 4) PO đã phát hành nhưng chưa có phiếu nhập để tiện demo nhận hàng tại công trường.
        var request3 = await CreateMaterialRequestAsync(context, phase, leader, accountant, null,
            MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ,
            "Cấp gạch chống trơn để hoàn thiện các khu vực ướt còn lại.",
            "Đã kiểm tra BOQ và lịch thi công; cần giao trước khi hoàn thiện nền khu vực ướt.",
            null,
            new[] { (materials["GACH-CT-300"], master.Units["M2"], 8m, false, (string?)null) }, SeedUtc.AddDays(-7));
        await CreatePurchaseOrderAsync(context, request3, project,
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"], accountant, director,
            PurchaseOrderStatus.Sent, "PO-DEMO-DAO-DUA-003", SeedUtc.AddDays(-6),
            new[] { (materials["GACH-CT-300"], master.Units["M2"], 8m, 230_000m) },
            "Duyệt PO gạch chống trơn; giao thẳng công trình Đảo Dừa 3.");

        // Xuất và hoàn vật tư luôn lấy từ tồn kho đã nhập ở bước trước.
        var taskForIssue = tileTask;
        var issuance = new MaterialIssuance
        {
            IssuanceNo = "PXK-DAO-DUA-20260817-01",
            TaskId = taskForIssue.TaskId,
            Purpose = "Xuất vật tư phục vụ ốp lát và hoàn thiện khu vực tầng 1.",
            CreatedAt = SeedUtc.AddDays(-3),
            CreatedBy = leader.UserId
        };
        context.MaterialIssuances.Add(issuance);
        await context.SaveChangesAsync();
        await AddIssuanceLineAsync(context, issuance, project, materials["WEBER-ST250"], master.Units["BAO"], 8m, leader.UserId, SeedUtc.AddDays(-3));
        await AddIssuanceLineAsync(context, issuance, project, materials["GACH-POR-600"], master.Units["M2"], 30m, leader.UserId, SeedUtc.AddDays(-3));
        await AddIssuanceLineAsync(context, issuance, project, materials["SON-NOI-18"], master.Units["THUNG"], 1m, leader.UserId, SeedUtc.AddDays(-3));

        var materialReturn = new MaterialReturn
        {
            ReturnNo = "PTRA-DAO-DUA-20260819-01",
            OriginalIssuanceId = issuance.MaterialIssuanceId,
            Reason = "Hoàn lại 2 bao keo còn nguyên sau khi chốt khối lượng ốp lát khu vực tầng 1.",
            CreatedAt = SeedUtc.AddDays(-1),
            CreatedBy = leader.UserId
        };
        context.MaterialReturns.Add(materialReturn);
        await context.SaveChangesAsync();
        await AddReturnLineAsync(context, materialReturn, project, materials["WEBER-ST250"], master.Units["BAO"], 2m, leader.UserId, SeedUtc.AddDays(-1));

        // Sự cố vật tư đã xác minh -> điều chỉnh giảm -> giảm tồn.
        var invIncident = new Incident
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            TaskId = taskForIssue.TaskId,
            ReportedBy = leader.UserId,
            ReviewedBy = accountant.UserId,
            IncidentType = "InventoryDamage",
            Description = "Phát hiện một số gạch porcelain bị sứt cạnh do va chạm trong quá trình tập kết và di chuyển nội bộ.",
            Status = IncidentStatus.Closed,
            DamageDescription = "8 m² gạch không đạt yêu cầu thẩm mỹ, tách riêng không đưa vào thi công.",
            EstimatedMaterialLoss = 8,
            EstimatedLaborDays = 0.5m,
            EstimatedDelayDays = 0,
            ProposedAction = "Xác minh hiện trường và lập phiếu giảm tồn 8 m² gạch hư hỏng.",
            HandlingInstruction = "Kế toán đã đối chiếu biên bản và ảnh; trình giảm tồn đúng khối lượng hư hỏng.",
            CreatedAt = SeedUtc.AddDays(-2),
            CreatedBy = leader.UserId
        };
        context.Incidents.Add(invIncident);
        await context.SaveChangesAsync();
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.Incident,
            EntityId = invIncident.IncidentId,
            AttachmentType = AttachmentType.IncidentPhoto,
            FileName = "su-co-gach-vo-dao-dua-3.jpg",
            FileUrl = SeedImageRenovation,
            ContentType = "image/jpeg",
            FileSizeBytes = 360_000,
            CreatedAt = invIncident.CreatedAt,
            CreatedBy = leader.UserId
        });
        await context.SaveChangesAsync();

        var decrease = new InventoryAdjustment
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            IncidentId = invIncident.IncidentId,
            AdjustmentType = InventoryAdjustmentType.Decrease,
            Reason = "Giảm tồn theo sự cố vật tư đã được xác minh.",
            Description = "Cơ sở duyệt: tồn hệ thống trước xử lý 110 m²; sự cố xác nhận hư hỏng 8 m²; tồn sau giảm dự kiến 102 m²; kèm ảnh hiện trường và biên bản kiểm tra.",
            Status = InventoryAdjustmentStatus.Approved,
            ApprovedBy = director.UserId,
            ApprovedAt = SeedUtc.AddDays(-1).AddHours(3),
            CreatedAt = SeedUtc.AddDays(-1),
            CreatedBy = accountant.UserId
        };
        context.InventoryAdjustments.Add(decrease);
        await context.SaveChangesAsync();
        context.AdjustmentItems.Add(new AdjustmentItem
        {
            AdjustmentId = decrease.AdjustmentId,
            MaterialId = materials["GACH-POR-600"].MaterialId,
            UnitId = master.Units["M2"].UnitId,
            Quantity = 8m,
            ConversionRate = 1m
        });
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, project, materials["GACH-POR-600"], -8m,
            InventoryTransactionType.IncidentLoss, decrease.AdjustmentId, EntityType.InventoryAdjustment,
            director.UserId, decrease.ApprovedAt!.Value);

        // Phiếu điều chỉnh tăng đang chờ duyệt: thể hiện cơ sở kiểm kê thực tế, chưa làm thay đổi tồn.
        var increase = new InventoryAdjustment
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            AdjustmentType = InventoryAdjustmentType.Increase,
            Reason = "Kiểm kê thực tế phát hiện 1 thùng sơn nội thất chưa được ghi nhận vào số liệu hệ thống.",
            Description = "Tồn hệ thống 9 thùng; kiểm kê thực tế 10 thùng; chênh lệch đề nghị +1 thùng sơn nội thất. Ảnh kiểm kê và biên bản lưu tại công trường.",
            Status = InventoryAdjustmentStatus.Pending,
            CreatedAt = SeedUtc,
            CreatedBy = leader.UserId
        };
        context.InventoryAdjustments.Add(increase);
        await context.SaveChangesAsync();
        context.AdjustmentItems.Add(new AdjustmentItem
        {
            AdjustmentId = increase.AdjustmentId,
            MaterialId = materials["SON-NOI-18"].MaterialId,
            UnitId = master.Units["THUNG"].UnitId,
            Quantity = 1m,
            ConversionRate = await GetConversionRateAsync(context, materials["SON-NOI-18"], master.Units["THUNG"])
        });
        await context.SaveChangesAsync();

        // Sự cố thi công có giảm tiến độ và tạo công việc khắc phục.
        var constructionIncident = new Incident
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            TaskId = paintTask.TaskId,
            ReportedBy = engineer.UserId,
            ReviewedBy = tpkt.UserId,
            IncidentType = "Construction",
            Description = "Bề mặt sơn khu hành lang xuất hiện phồng cục bộ do lớp nền chưa đạt độ khô yêu cầu.",
            Status = IncidentStatus.Resolved,
            DamageDescription = "Khoảng 18 m² cần cạo bỏ, xử lý nền và thi công lại.",
            EstimatedLaborDays = 2,
            EstimatedDelayDays = 1,
            ProposedAction = "Giảm tiến độ hạng mục và tạo công việc sửa chữa bề mặt trước khi sơn lại.",
            HandlingInstruction = "Tạm dừng sơn phủ khu vực lỗi; kiểm tra độ ẩm, xử lý bề mặt rồi nghiệm thu lại.",
            CreatedAt = SeedUtc.AddDays(-4),
            CreatedBy = engineer.UserId
        };
        context.Incidents.Add(constructionIncident);
        await context.SaveChangesAsync();

        var rework = new ProjectTask
        {
            PhaseId = phase.PhaseId,
            IncidentId = constructionIncident.IncidentId,
            Name = "Sửa chữa bề mặt sơn hành lang sau sự cố",
            Description = "Cạo bỏ lớp lỗi, xử lý nền, kiểm tra độ ẩm và sơn lại khu vực bị phồng.",
            OrderIndex = 99,
            StartDate = DemoDate.AddDays(-1),
            EndDate = DemoDate.AddDays(3),
            Status = TaskStatusConstants.Assigned,
            ProgressPercent = 0,
            Weight = 1,
            CreatedAt = SeedUtc.AddDays(-1),
            CreatedBy = tpkt.UserId
        };
        context.Tasks.Add(rework);
        await context.SaveChangesAsync();
        context.TaskAssignees.Add(new TaskAssignee { TaskId = rework.TaskId, UserId = engineer.UserId, AssignedAt = SeedUtc.AddDays(-1) });
        constructionIncident.ReworkTaskId = rework.TaskId;
        await context.SaveChangesAsync();

        // Mẫu sự cố dừng khẩn cấp đã có kế hoạch khắc phục để Giám đốc xem xét.
        var emergency = new Incident
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            ReportedBy = leader.UserId,
            ReviewedBy = tpkt.UserId,
            IncidentType = "Construction",
            Description = "Rò nước bất thường tại khu vực kỹ thuật cần cô lập để kiểm tra đường ống trước khi tiếp tục hoàn thiện.",
            Status = IncidentStatus.UnderReview,
            DamageDescription = "Chưa ghi nhận hư hại kết cấu; cần mở cục bộ trần kỹ thuật để kiểm tra.",
            EstimatedLaborDays = 1.5m,
            EstimatedDelayDays = 1,
            ProposedAction = "Tạm dừng khu vực bị ảnh hưởng, kiểm tra áp lực và mối nối, chỉ mở lại sau khi test đạt.",
            HandlingInstruction = "TPKT đã chấp thuận dừng cục bộ khu vực kỹ thuật.",
            IsEmergency = true,
            RecoveryPlanText = "Cô lập tuyến, kiểm tra mối nối, thay đoạn lỗi nếu có, test áp lực tối thiểu 2 giờ, đóng trần sau nghiệm thu.",
            RecoveryEstimateCost = 4_800_000m,
            CreatedAt = SeedUtc.AddHours(-6),
            CreatedBy = leader.UserId
        };
        context.Incidents.Add(emergency);
        await context.SaveChangesAsync();

        // Mua trực tiếp: vật tư thực nhận được ghi kho ngay; Kế toán/Giám đốc xử lý phần chứng từ và hoàn ứng.
        await SeedDirectPurchaseAsync(context, project, phase, taskForIssue, leader, accountant, director,
            materials["WEBER-ST250"], master.Units["BAO"], 4m, 230_000m, SeedUtc.AddDays(-8));
    }

    private static async Task<DailyLog> SeedDailyLogAsync(
        AppDbContext context, ProjectTask task, byte oldProgress, byte newProgress,
        User creator, string description, DateTime at)
    {
        var log = new DailyLog
        {
            TaskId = task.TaskId,
            LogDate = DateOnly.FromDateTime(at),
            NewProgressPercent = newProgress,
            Description = description,
            CreatedBy = creator.UserId,
            CreatedAt = at
        };
        context.DailyLogs.Add(log);
        context.TaskProgressLogs.Add(new TaskProgressLog
        {
            TaskId = task.TaskId,
            OldProgress = oldProgress,
            NewProgress = newProgress,
            UpdateReason = $"Cập nhật từ nhật ký thi công ngày {DateOnly.FromDateTime(at):dd/MM/yyyy}",
            CreatedAt = at,
            UpdatedAt = at,
            CreatedBy = creator.UserId
        });
        task.ProgressPercent = newProgress;
        task.UpdatedAt = at;
        task.UpdatedBy = creator.UserId;
        if (newProgress == 100 && task.Status == TaskStatusConstants.InProgress) task.Status = TaskStatusConstants.Completed;
        await context.SaveChangesAsync();
        return log;
    }

    private static async Task<MaterialRequest> CreateMaterialRequestAsync(
        AppDbContext context,
        Phase phase,
        User creator,
        User? checker,
        User? approver,
        string status,
        string boqStatus,
        string reason,
        string? accountantNote,
        string? approvalNote,
        IEnumerable<(MaterialCatalog Material, Unit Unit, decimal Quantity, bool IsOver, string? Explanation)> items,
        DateTime createdAt)
    {
        var request = new MaterialRequest
        {
            PhaseId = phase.PhaseId,
            Reason = reason,
            Status = status,
            BOQCheckStatus = boqStatus,
            CheckedBy = checker?.UserId,
            ApprovedBy = status == MaterialRequestStatus.Approved
                ? (approver ?? checker)?.UserId
                : approver?.UserId,
            AccountantNote = accountantNote,
            ApprovalNote = approvalNote,
            ProcurementDecision = status is MaterialRequestStatus.Approved or MaterialRequestStatus.WaitingApproval
                ? MaterialRequestProcurementDecision.ExternalPurchase
                : null,
            CreatedAt = createdAt,
            CreatedBy = creator.UserId
        };
        context.MaterialRequests.Add(request);
        await context.SaveChangesAsync();

        foreach (var item in items)
        {
            context.MaterialRequestItems.Add(new MaterialRequestItem
            {
                RequestId = request.RequestId,
                MaterialId = item.Material.MaterialId,
                UnitId = item.Unit.UnitId,
                Quantity = item.Quantity,
                ConversionRate = await GetConversionRateAsync(context, item.Material, item.Unit),
                IsOverBOQ = item.IsOver,
                Explanation = item.Explanation
            });
        }
        await context.SaveChangesAsync();
        return request;
    }

    private static async Task CreateActiveSurplusFromCurrentInventoryAsync(
        AppDbContext context,
        ProjectBundle source,
        DateTime createdAt,
        string reason)
    {
        var inventoryItems = await context.CurrentInventories
            .Where(inventory =>
                inventory.ProjectId == source.Project.ProjectId &&
                inventory.Quantity > 0)
            .ToListAsync();
        if (inventoryItems.Count == 0)
        {
            throw new InvalidOperationException(
                $"Không có tồn kho để seed nguồn surplus tại dự án {source.Project.Name}.");
        }

        var surplus = new SurplusRequest
        {
            ProjectId = source.Project.ProjectId,
            Reason = reason,
            Status = SurplusRequestStatus.Processing,
            CreatedAt = createdAt,
            CreatedBy = source.Leader.UserId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        foreach (var inventory in inventoryItems)
        {
            context.SurplusRequestItems.Add(new SurplusRequestItem
            {
                SurplusRequestId = surplus.SurplusRequestId,
                MaterialId = inventory.MaterialId,
                UnitId = inventory.UnitId,
                Quantity = inventory.Quantity,
                ProcessedQuantity = 0,
                ConversionRate = 1,
                Status = SurplusRequestItemStatus.Pending,
                CreatedAt = createdAt,
                CreatedBy = source.Leader.UserId
            });
            inventory.ReservedQuantity += inventory.Quantity;
            inventory.LastUpdated = createdAt;
        }

        await context.SaveChangesAsync();
    }

    private static async Task<PurchaseOrder> CreatePurchaseOrderAsync(
        AppDbContext context,
        MaterialRequest? request,
        Project project,
        Supplier? supplier,
        User creator,
        User? approver,
        string status,
        string poNumber,
        DateTime orderDate,
        IEnumerable<(MaterialCatalog Material, Unit Unit, decimal Quantity, decimal UnitPrice)> lines,
        string? approvalNote)
    {
        var po = new PurchaseOrder
        {
            RequestId = request?.RequestId,
            SupplierId = supplier?.SupplierId,
            ProjectId = project.ProjectId,
            PONumber = poNumber,
            OrderDate = orderDate,
            ExpectedDeliveryDate = DateOnly.FromDateTime(orderDate.AddDays(3)),
            DeliveryAddress = project.Address,
            Notes = "Giao thẳng tới công trường; đối chiếu số lượng và chứng từ khi nhận.",
            Status = status,
            ApprovedBy = approver?.UserId,
            ApprovedAt = approver != null ? orderDate.AddHours(4) : null,
            ApprovalNote = approvalNote,
            CreatedAt = orderDate,
            CreatedBy = creator.UserId
        };
        context.PurchaseOrders.Add(po);
        await context.SaveChangesAsync();

        decimal total = 0;
        foreach (var line in lines)
        {
            var amount = line.Quantity * line.UnitPrice;
            total += amount;
            context.PurchaseOrderItems.Add(new PurchaseOrderItem
            {
                POId = po.POId,
                MaterialId = line.Material.MaterialId,
                UnitId = line.Unit.UnitId,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                LineTotal = amount,
                ConversionRate = await GetConversionRateAsync(context, line.Material, line.Unit),
                Notes = "Đơn giá seed phục vụ demo, không phải báo giá/hóa đơn thực tế của BPG."
            });
        }
        po.TotalAmount = total;
        await context.SaveChangesAsync();
        return po;
    }

    private static async Task<GoodsReceipt> CreateGoodsReceiptAsync(
        AppDbContext context,
        PurchaseOrder po,
        User receiver,
        string status,
        string receiptNo,
        string deliverer,
        string deliveryDocNo,
        IEnumerable<(MaterialCatalog Material, Unit Unit, decimal Quantity)> lines,
        DateTime receivedAt)
    {
        var gr = new GoodsReceipt
        {
            POId = po.POId,
            ReceiptNo = receiptNo,
            DelivererInfo = deliverer,
            DeliveryDocNo = deliveryDocNo,
            Status = status,
            CreatedAt = receivedAt,
            CreatedBy = receiver.UserId
        };
        context.GoodsReceipts.Add(gr);
        await context.SaveChangesAsync();

        var project = await context.Projects.FirstAsync(x => x.ProjectId == po.ProjectId);
        foreach (var line in lines)
        {
            var rate = await GetConversionRateAsync(context, line.Material, line.Unit);
            context.GoodsReceiptItems.Add(new GoodsReceiptItem
            {
                ReceiptId = gr.ReceiptId,
                MaterialId = line.Material.MaterialId,
                UnitId = line.Unit.UnitId,
                Quantity = line.Quantity,
                ConversionRate = rate
            });
            if (status == GoodsReceiptStatus.Approved)
            {
                var baseQty = line.Quantity / rate;
                await ApplyStockAsync(context, project, line.Material, baseQty,
                    InventoryTransactionType.GoodsReceipt, gr.ReceiptId, EntityType.GoodsReceipt,
                    receiver.UserId, receivedAt);
            }
        }
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.GoodsReceipt,
            EntityId = gr.ReceiptId,
            AttachmentType = AttachmentType.DeliveryPhoto,
            FileName = $"{receiptNo}-giao-hang.jpg",
            FileUrl = SeedImageDelivery,
            ContentType = "image/jpeg",
            FileSizeBytes = 310_000,
            CreatedAt = receivedAt,
            CreatedBy = receiver.UserId
        });
        await context.SaveChangesAsync();
        return gr;
    }

    private static async Task AddIssuanceLineAsync(
        AppDbContext context, MaterialIssuance issuance, Project project,
        MaterialCatalog material, Unit unit, decimal qty, long actorId, DateTime at)
    {
        var rate = await GetConversionRateAsync(context, material, unit);
        context.MaterialIssuanceItems.Add(new MaterialIssuanceItem
        {
            MaterialIssuanceId = issuance.MaterialIssuanceId,
            MaterialId = material.MaterialId,
            UnitId = unit.UnitId,
            Quantity = qty,
            ConversionRate = rate
        });
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, project, material, -(qty / rate),
            InventoryTransactionType.Issuance, issuance.MaterialIssuanceId, EntityType.MaterialIssuance,
            actorId, at);
    }

    private static async Task AddReturnLineAsync(
        AppDbContext context, MaterialReturn materialReturn, Project project,
        MaterialCatalog material, Unit unit, decimal qty, long actorId, DateTime at)
    {
        var rate = await GetConversionRateAsync(context, material, unit);
        context.MaterialReturnItems.Add(new MaterialReturnItem
        {
            MaterialReturnId = materialReturn.MaterialReturnId,
            MaterialId = material.MaterialId,
            UnitId = unit.UnitId,
            Quantity = qty,
            ConversionRate = rate
        });
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, project, material, qty / rate,
            InventoryTransactionType.IssuanceReturn, materialReturn.MaterialReturnId, EntityType.MaterialReturn,
            actorId, at);
    }

    private static async Task SeedDirectPurchaseAsync(
        AppDbContext context,
        Project project,
        Phase phase,
        ProjectTask task,
        User requester,
        User accountant,
        User director,
        MaterialCatalog material,
        Unit unit,
        decimal quantity,
        decimal unitPrice,
        DateTime purchaseDate)
    {
        var rate = await GetConversionRateAsync(context, material, unit);
        var total = quantity * unitPrice;
        var dp = new DirectPurchaseRequest
        {
            ProjectId = project.ProjectId,
            PhaseId = phase.PhaseId,
            TaskId = task.TaskId,
            RequestedBy = requester.UserId,
            Reason = "Mua trực tiếp số lượng nhỏ để xử lý thiếu vật tư tức thời, tránh gián đoạn tổ ốp lát trong ngày.",
            Status = DirectPurchaseStatus.Approved,
            AuditStatus = DirectPurchaseAuditStatus.Audited,
            BOQCheckStatus = BOQCheckStatus.WithinBOQ,
            SubmittedAt = purchaseDate,
            TotalAmount = total,
            PurchaseDate = purchaseDate,
            AuditedBy = accountant.UserId,
            AuditedAt = purchaseDate.AddDays(1),
            AuditNote = "Đã đối chiếu hóa đơn, vật tư thực nhận và định mức phase; chứng từ hợp lệ.",
            ApprovedBy = director.UserId,
            ApprovedAt = purchaseDate.AddDays(2),
            ApprovalNote = "Duyệt chi hoàn ứng khoản mua trực tiếp.",
            CreatedAt = purchaseDate,
            CreatedBy = requester.UserId
        };
        context.DirectPurchaseRequests.Add(dp);
        await context.SaveChangesAsync();

        context.DirectPurchaseItems.Add(new DirectPurchaseItem
        {
            DirectPurchaseId = dp.DirectPurchaseId,
            MaterialId = material.MaterialId,
            UnitId = unit.UnitId,
            Quantity = quantity,
            ConversionRate = rate,
            UnitPrice = unitPrice,
            LineTotal = total,
            IsOverBOQ = false
        });
        await context.SaveChangesAsync();

        var autoPo = await CreatePurchaseOrderAsync(context, null, project, null, requester, null,
            PurchaseOrderStatus.FullyReceived, $"DP-PO-{dp.DirectPurchaseId:D5}", purchaseDate,
            new[] { (material, unit, quantity, unitPrice) }, null);
        var autoGr = await CreateGoodsReceiptAsync(context, autoPo, requester, GoodsReceiptStatus.Approved,
            $"DP-GR-{dp.DirectPurchaseId:D5}", "Mua tại cửa hàng gần công trường", $"HD-DP-{dp.DirectPurchaseId:D5}",
            new[] { (material, unit, quantity) }, purchaseDate);
        dp.AutoPOId = autoPo.POId;
        dp.AutoReceiptId = autoGr.ReceiptId;

        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.DirectPurchaseRequest,
            EntityId = dp.DirectPurchaseId,
            AttachmentType = AttachmentType.InvoicePhoto,
            FileName = $"hoa-don-mua-truc-tiep-{dp.DirectPurchaseId}.jpg",
            FileUrl = SeedImageDelivery,
            ContentType = "image/jpeg",
            FileSizeBytes = 250_000,
            CreatedAt = purchaseDate,
            CreatedBy = requester.UserId
        });
        await context.SaveChangesAsync();
    }

    // -------------------------------------------------------------------------
    // KỊCH BẢN THẨM ĐỊNH YCVT CÓ LIÊN KẾT CHỨNG TỪ
    // Không tạo/chỉnh BOQ. Mọi dòng đều lấy từ BOQ hiện có của đúng phase:
    // - hai dự án nguồn: YCVT -> PO -> GR -> tồn -> khóa toàn bộ tồn -> Surplus Processing;
    // - dự án đích: YCVT đã nhận tạo tồn, YCVT đã duyệt tạo PO đang về;
    // - YCVT Pending dùng đúng bốn vật tư trên để cơ sở thẩm định có coverage đa dạng;
    // - 5/6 vật tư demo phổ biến có nguồn nội bộ và giá gần nhất; Đá 1x2 chủ động để trống;
    // - các phương án điều chuyển/chờ cung ứng/bổ sung thông tin/từ chối không sinh PO;
    // - cùng một dự án có đủ Pending/WaitingApproval/Approved/Rejected/Cancelled để danh sách không một màu.
    // -------------------------------------------------------------------------
    private static async Task SeedMaterialRequestAssessmentScenariosAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var source = projects["Biệt thự nhà chú Công – khu San Hô, Vinhomes Ocean Park 2"];
        var demoMaterialSource = projects["Biệt thự song lập An Khánh – Hoài Đức"];
        var target = projects["Cải tạo nhà liền kề Vạn Phúc – Hà Đông"];
        var sourcePhase = source.Phases[2];
        var targetPhase = target.Phases[2];
        var decisionPhase = target.Phases[1];
        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];
        var supplier = master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"];

        var sourceLines = new[]
        {
            new AssessmentSupplyLine("WEBER-ST250", "BAO", 10m, 228_000m),
            new AssessmentSupplyLine("GACH-POR-600", "M2", 40m, 285_000m),
            new AssessmentSupplyLine("SON-NOI-18", "THUNG", 6m, 2_700_000m),
            new AssessmentSupplyLine("BOT-BA-40", "BAO", 12m, 295_000m)
        };
        var sourceRequest = await CreateMaterialRequestAsync(
            context,
            sourcePhase,
            source.Leader,
            accountant,
            null,
            MaterialRequestStatus.Approved,
            BOQCheckStatus.WithinBOQ,
            "Cấp lô vật tư hoàn thiện theo BOQ; phần chưa dùng được rà soát làm nguồn điều phối nội bộ.",
            "Đã đối chiếu BOQ và tiến độ thi công trước khi mua.",
            null,
            sourceLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
            SeedUtc.AddDays(-18));
        var sourcePo = await CreatePurchaseOrderAsync(
            context,
            sourceRequest,
            source.Project,
            supplier,
            accountant,
            director,
            PurchaseOrderStatus.FullyReceived,
            "PO-DEMO-SOURCE-STOCK-V1",
            SeedUtc.AddDays(-16),
            sourceLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
            "Đơn hàng đã giao đủ và nhập kho dự án nguồn.");
        await CreateGoodsReceiptAsync(
            context,
            sourcePo,
            source.Leader,
            GoodsReceiptStatus.Approved,
            "GR-DEMO-SOURCE-STOCK-V1",
            supplier.SupplierName,
            "BBGH-DEMO-SOURCE-STOCK-V1",
            sourceLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity)),
            SeedUtc.AddDays(-14));

        await CreateActiveSurplusFromCurrentInventoryAsync(
            context,
            source,
            SeedUtc.AddDays(-4),
            AssessmentReferenceReason);

        // Nguồn thứ hai phủ 5/6 vật tư thường dùng khi demo YCVT mới.
        // Đá 1x2 được chủ động để trống nhằm giữ tình huống "không có dữ liệu tham khảo".
        var demoFoundationLines = new[]
        {
            new AssessmentSupplyLine("XM-VICEM-PCB40", "BAO", 24m, 93_000m),
            new AssessmentSupplyLine("BT-TUOI-M250", "M3", 8m, 1_285_000m),
            new AssessmentSupplyLine("THEP-HP-D16", "CAY", 36m, 244_000m),
            new AssessmentSupplyLine("CAT-XAY-TO", "M3", 5m, 335_000m)
        };
        var demoFoundationRequest = await CreateMaterialRequestAsync(
            context,
            demoMaterialSource.Phases[0],
            demoMaterialSource.Leader,
            accountant,
            null,
            MaterialRequestStatus.Approved,
            BOQCheckStatus.WithinBOQ,
            "Cấp vật tư móng và nền theo BOQ để tạo tồn phục vụ thi công.",
            "Đã đối chiếu BOQ, tiến độ và kế hoạch giao nhận.",
            null,
            demoFoundationLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
            SeedUtc.AddDays(-20));
        var demoFoundationPo = await CreatePurchaseOrderAsync(
            context,
            demoFoundationRequest,
            demoMaterialSource.Project,
            supplier,
            accountant,
            director,
            PurchaseOrderStatus.FullyReceived,
            "PO-DEMO-COMMON-MATERIALS-01",
            SeedUtc.AddDays(-18),
            demoFoundationLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
            "Đơn hàng vật tư móng đã giao đủ và nhập kho.");
        await CreateGoodsReceiptAsync(
            context,
            demoFoundationPo,
            demoMaterialSource.Leader,
            GoodsReceiptStatus.Approved,
            "GR-DEMO-COMMON-MATERIALS-01",
            supplier.SupplierName,
            "BBGH-DEMO-COMMON-MATERIALS-01",
            demoFoundationLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity)),
            SeedUtc.AddDays(-16));

        var demoMasonryLines = new[]
        {
            new AssessmentSupplyLine("GACH-2LO-220", "VIEN", 600m, 1_450m)
        };
        var demoMasonryRequest = await CreateMaterialRequestAsync(
            context,
            demoMaterialSource.Phases[2],
            demoMaterialSource.Leader,
            accountant,
            null,
            MaterialRequestStatus.Approved,
            BOQCheckStatus.WithinBOQ,
            "Cấp gạch xây theo BOQ cho công tác tường bao và tường ngăn.",
            "Khối lượng phù hợp BOQ và kế hoạch thi công xây tô.",
            null,
            demoMasonryLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
            SeedUtc.AddDays(-15));
        var demoMasonryPo = await CreatePurchaseOrderAsync(
            context,
            demoMasonryRequest,
            demoMaterialSource.Project,
            supplier,
            accountant,
            director,
            PurchaseOrderStatus.FullyReceived,
            "PO-DEMO-COMMON-MATERIALS-02",
            SeedUtc.AddDays(-13),
            demoMasonryLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
            "Đơn hàng gạch xây đã giao đủ và nhập kho.");
        await CreateGoodsReceiptAsync(
            context,
            demoMasonryPo,
            demoMaterialSource.Leader,
            GoodsReceiptStatus.Approved,
            "GR-DEMO-COMMON-MATERIALS-02",
            supplier.SupplierName,
            "BBGH-DEMO-COMMON-MATERIALS-02",
            demoMasonryLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity)),
            SeedUtc.AddDays(-11));
        await CreateActiveSurplusFromCurrentInventoryAsync(
            context,
            demoMaterialSource,
            SeedUtc.AddDays(-3),
            "Rà soát toàn bộ tồn kho chưa sử dụng để làm nguồn điều phối nội bộ.");

        var targetStockLines = new[]
        {
            new AssessmentSupplyLine("WEBER-ST250", "BAO", 12m, 226_000m),
            new AssessmentSupplyLine("GACH-POR-600", "M2", 30m, 282_000m)
        };
        var targetStockRequest = await CreateMaterialRequestAsync(
            context,
            targetPhase,
            target.Leader,
            accountant,
            null,
            MaterialRequestStatus.Approved,
            BOQCheckStatus.WithinBOQ,
            "Cấp vật tư ốp lát theo BOQ để triển khai khối lượng đầu đợt.",
            "Đã đối chiếu BOQ, tiến độ và chứng từ giao nhận.",
            null,
            targetStockLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
            SeedUtc.AddDays(-12));
        var targetStockPo = await CreatePurchaseOrderAsync(
            context,
            targetStockRequest,
            target.Project,
            supplier,
            accountant,
            director,
            PurchaseOrderStatus.FullyReceived,
            "PO-DEMO-TARGET-STOCK-V1",
            SeedUtc.AddDays(-10),
            targetStockLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
            "Đơn hàng đã giao đủ và nhập kho dự án đích.");
        await CreateGoodsReceiptAsync(
            context,
            targetStockPo,
            target.Leader,
            GoodsReceiptStatus.Approved,
            "GR-DEMO-TARGET-STOCK-V1",
            supplier.SupplierName,
            "BBGH-DEMO-TARGET-STOCK-V1",
            targetStockLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity)),
            SeedUtc.AddDays(-8));

        var activeSupplyLines = new[]
        {
            new AssessmentSupplyLine("SON-NOI-18", "THUNG", 4m, 2_680_000m),
            new AssessmentSupplyLine("BOT-BA-40", "BAO", 10m, 292_000m)
        };
        var activeSupplyRequest = await CreateMaterialRequestAsync(
            context,
            targetPhase,
            target.Leader,
            accountant,
            null,
            MaterialRequestStatus.Approved,
            BOQCheckStatus.WithinBOQ,
            "Cấp vật tư sơn bả theo tiến độ hoàn thiện; nhà cung cấp đang chuẩn bị giao.",
            "Đã đối chiếu BOQ và lịch giao hàng.",
            null,
            activeSupplyLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
            SeedUtc.AddDays(-6));
        await CreatePurchaseOrderAsync(
            context,
            activeSupplyRequest,
            target.Project,
            supplier,
            accountant,
            director,
            PurchaseOrderStatus.Sent,
            "PO-DEMO-TARGET-SUPPLY-V1",
            SeedUtc.AddDays(-5),
            activeSupplyLines.Select(line =>
                (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
            "Đã gửi nhà cung cấp; chưa phát sinh phiếu nhập kho.");

        await CreateMaterialRequestAsync(
            context,
            targetPhase,
            target.Leader,
            null,
            null,
            MaterialRequestStatus.Pending,
            BOQCheckStatus.WithinBOQ,
            "Yêu cầu vật tư hoàn thiện đợt tiếp theo để Kế toán thẩm định nguồn cung ứng.",
            null,
            null,
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 8m, false, (string?)null),
                (materials["GACH-POR-600"], master.Units["M2"], 20m, false, (string?)null),
                (materials["SON-NOI-18"], master.Units["THUNG"], 3m, false, (string?)null),
                (materials["BOT-BA-40"], master.Units["BAO"], 6m, false, (string?)null)
            },
            SeedUtc.AddDays(-1));

        async Task SeedDecisionAsync(string decision, MaterialCatalog material, Unit unit, decimal quantity, string note, DateTime createdAt)
        {
            var request = await CreateMaterialRequestAsync(
                context,
                decisionPhase,
                target.Leader,
                accountant,
                null,
                MaterialRequestStatus.Rejected,
                BOQCheckStatus.WithinBOQ,
                "Yêu cầu vật tư để minh họa kết quả thẩm định theo từng phương án xử lý.",
                note,
                null,
                new[] { (material, unit, quantity, false, (string?)null) },
                createdAt);
            request.ProcurementDecision = decision;
            request.UpdatedAt = createdAt.AddHours(2);
            request.UpdatedBy = accountant.UserId;
            await context.SaveChangesAsync();
        }

        await SeedDecisionAsync(
            MaterialRequestProcurementDecision.InternalTransfer,
            materials["CAT-XAY-TO"],
            master.Units["M3"],
            2m,
            "Ưu tiên điều chuyển từ nguồn nội bộ đã rà soát; không lập PO mua ngoài.",
            SeedUtc.AddDays(-3).AddHours(1));
        await SeedDecisionAsync(
            MaterialRequestProcurementDecision.WaitSupply,
            materials["GACH-2LO-220"],
            master.Units["VIEN"],
            200m,
            "Tạm chờ lô đang cung ứng về kho; không lập thêm PO.",
            SeedUtc.AddDays(-3).AddHours(2));
        await SeedDecisionAsync(
            MaterialRequestProcurementDecision.NotApproved,
            materials["SIKA-TOP-107"],
            master.Units["BO"],
            2m,
            "Không chấp thuận do chưa đủ căn cứ nhu cầu tại thời điểm thẩm định.",
            SeedUtc.AddDays(-3).AddHours(3));
        await SeedDecisionAsync(
            MaterialRequestProcurementDecision.NeedMoreInfo,
            materials["CADIVI-CV1.5"],
            master.Units["CUON"],
            2m,
            "Yêu cầu bổ sung phạm vi sử dụng và tiến độ cần vật tư trước khi thẩm định lại.",
            SeedUtc.AddDays(-3).AddHours(4));

        await CreateMaterialRequestAsync(
            context,
            decisionPhase,
            target.Leader,
            null,
            null,
            MaterialRequestStatus.Cancelled,
            BOQCheckStatus.WithinBOQ,
            "Phiếu được hủy do đội thi công điều chỉnh lại thời điểm cấp vật tư.",
            null,
            null,
            new[] { (materials["GACH-DAC-A1"], master.Units["VIEN"], 120m, false, (string?)null) },
            SeedUtc.AddDays(-2).AddHours(1));

        var pendingOverMaterial = materials["GACH-4LO-80"];
        var pendingOverBoq = await context.BOQItems.SingleAsync(item =>
            item.PhaseId == decisionPhase.PhaseId &&
            item.MaterialId == pendingOverMaterial.MaterialId &&
            !item.IsDeleted);
        var pendingOverQuantity = Math.Ceiling(
            pendingOverBoq.Quantity / (pendingOverBoq.ConversionRate > 0 ? pendingOverBoq.ConversionRate : 1m)) + 10m;
        await CreateMaterialRequestAsync(
            context,
            decisionPhase,
            target.Leader,
            null,
            null,
            MaterialRequestStatus.Pending,
            BOQCheckStatus.OverBOQ,
            "Bổ sung gạch xây vượt phần định mức còn lại, đang chờ Kế toán thẩm định.",
            null,
            null,
            new[]
            {
                (pendingOverMaterial, master.Units["VIEN"], pendingOverQuantity, true,
                    (string?)"Khối lượng yêu cầu vượt định mức BOQ của giai đoạn.")
            },
            SeedUtc.AddHours(-8));

        var waitingApprovalMaterial = materials["SIKA-GROUT-214"];
        var waitingApprovalBoq = await context.BOQItems.SingleAsync(item =>
            item.PhaseId == decisionPhase.PhaseId &&
            item.MaterialId == waitingApprovalMaterial.MaterialId &&
            !item.IsDeleted);
        var waitingApprovalQuantity = Math.Ceiling(
            waitingApprovalBoq.Quantity /
            (waitingApprovalBoq.ConversionRate > 0 ? waitingApprovalBoq.ConversionRate : 1m)) + 2m;
        await CreateMaterialRequestAsync(
            context,
            decisionPhase,
            target.Leader,
            accountant,
            null,
            MaterialRequestStatus.WaitingApproval,
            BOQCheckStatus.OverBOQ,
            "Bổ sung vữa rót vượt định mức, đã được Kế toán trình Giám đốc phê duyệt.",
            "Nhu cầu có căn cứ hiện trường nhưng vượt BOQ nên cần Giám đốc quyết định.",
            null,
            new[]
            {
                (waitingApprovalMaterial, master.Units["BAO"], waitingApprovalQuantity, true,
                    (string?)"Khối lượng yêu cầu vượt định mức BOQ của giai đoạn.")
            },
            SeedUtc.AddHours(-7));
    }

    // -------------------------------------------------------------------------
    // COMPLETED MỖ LAO PROJECT: diverse 2025 history for reporting.
    // -------------------------------------------------------------------------
    private static async Task SeedCompletedMoLaoHistoryAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var bundle = projects["Nhà ở liền kề LK4B Mỗ Lao – Hà Đông"];
        var project = bundle.Project;
        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];
        var technicalManager = users["tpkt@bpg.com"];

        static DateTime At(DateOnly date, int hour = 2)
            => DateTime.SpecifyKind(date.ToDateTime(new TimeOnly(hour, 0)), DateTimeKind.Utc);

        // Give every task a real progress history. Without these logs a completed task appears
        // as 100% immediately from its creation date and makes the historical S-curve unrealistic.
        var progressLogs = new List<TaskProgressLog>();
        var dailyLogs = new List<DailyLog>();
        foreach (var phase in bundle.Phases)
        {
            var phaseTasks = bundle.TasksByPhase[phase.PhaseId];
            foreach (var task in phaseTasks)
            {
                var totalDays = Math.Max(0, task.EndDate.DayNumber - task.StartDate.DayNumber);
                var firstAt = At(task.StartDate.AddDays(totalDays * 30 / 100), 1);
                var secondAt = At(task.StartDate.AddDays(totalDays * 70 / 100), 2);
                var completedAt = At(task.EndDate, 3);

                progressLogs.AddRange(new[]
                {
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId,
                        OldProgress = 0,
                        NewProgress = 35,
                        UpdateReason = "Hoàn thành công tác chuẩn bị và khối lượng đầu kỳ.",
                        CreatedAt = firstAt,
                        UpdatedAt = firstAt,
                        CreatedBy = bundle.Leader.UserId
                    },
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId,
                        OldProgress = 35,
                        NewProgress = 75,
                        UpdateReason = "Khối lượng chính đã thi công và được kiểm tra nội bộ.",
                        CreatedAt = secondAt,
                        UpdatedAt = secondAt,
                        CreatedBy = bundle.EngineerA.UserId
                    },
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId,
                        OldProgress = 75,
                        NewProgress = 100,
                        UpdateReason = "Hoàn thành, nghiệm thu và khóa khối lượng công việc.",
                        CreatedAt = completedAt,
                        UpdatedAt = completedAt,
                        CreatedBy = bundle.Leader.UserId
                    }
                });

                task.UpdatedAt = completedAt;
                task.UpdatedBy = bundle.Leader.UserId;
            }

            var representativeTask = phaseTasks.First(t => t.ParentTaskId.HasValue);
            dailyLogs.Add(new DailyLog
            {
                TaskId = representativeTask.TaskId,
                LogDate = representativeTask.EndDate,
                NewProgressPercent = 100,
                Description = $"Hoàn tất khối lượng đại diện của {phase.Name}; chất lượng đạt yêu cầu và đủ điều kiện chuyển bước.",
                CreatedAt = At(representativeTask.EndDate),
                CreatedBy = bundle.Leader.UserId
            });
        }
        context.TaskProgressLogs.AddRange(progressLogs);
        context.DailyLogs.AddRange(dailyLogs);
        await context.SaveChangesAsync();

        async Task<(PurchaseOrder Po, MaterialIssuance Issuance)> SeedProcurementBatchAsync(
            Phase phase,
            ProjectTask task,
            DateTime requestAt,
            string numberSuffix,
            Supplier supplier,
            string reason,
            string boqStatus,
            (MaterialCatalog Material, Unit Unit, decimal Quantity, decimal UnitPrice, decimal IssuedQuantity, bool IsOver)[] lines)
        {
            var request = await CreateMaterialRequestAsync(
                context, phase, bundle.Leader, accountant, director,
                MaterialRequestStatus.Approved, boqStatus, reason,
                "Đã đối chiếu BOQ, tồn kho và tiến độ thực tế trước khi lập đơn mua.",
                "Giám đốc đã duyệt căn cứ kỹ thuật và giá trị mua sắm.",
                lines.Select(x => (x.Material, x.Unit, x.Quantity, x.IsOver,
                    x.IsOver ? (string?)"Khối lượng phát sinh đã được xác nhận theo hiện trường và biên bản thay đổi." : null)),
                requestAt);

            var po = await CreatePurchaseOrderAsync(
                context, request, project, supplier, accountant, director,
                PurchaseOrderStatus.FullyReceived, $"PO-MO-LAO-{numberSuffix}", requestAt.AddDays(3),
                lines.Select(x => (x.Material, x.Unit, x.Quantity, x.UnitPrice)),
                "Đơn mua đã được duyệt, giao đủ và đối chiếu chứng từ.");

            await CreateGoodsReceiptAsync(
                context, po, bundle.Leader, GoodsReceiptStatus.Approved,
                $"GR-MO-LAO-{numberSuffix}", supplier.SupplierName, $"BBGH-ML-{numberSuffix}",
                lines.Select(x => (x.Material, x.Unit, x.Quantity)), requestAt.AddDays(7));

            var issuance = new MaterialIssuance
            {
                IssuanceNo = $"PXK-MO-LAO-{numberSuffix}",
                TaskId = task.TaskId,
                Purpose = $"Xuất vật tư theo kế hoạch: {reason}",
                CreatedAt = requestAt.AddDays(14),
                CreatedBy = bundle.Leader.UserId
            };
            context.MaterialIssuances.Add(issuance);
            await context.SaveChangesAsync();
            foreach (var line in lines.Where(x => x.IssuedQuantity > 0))
            {
                await AddIssuanceLineAsync(
                    context, issuance, project, line.Material, line.Unit, line.IssuedQuantity,
                    bundle.Leader.UserId, issuance.CreatedAt);
            }

            return (po, issuance);
        }

        var phase1 = bundle.Phases[0];
        var phase2 = bundle.Phases[1];
        var phase3 = bundle.Phases[2];
        var phase4 = bundle.Phases[3];
        var task1 = bundle.TasksByPhase[phase1.PhaseId].First(t => t.ParentTaskId.HasValue);
        var task2 = bundle.TasksByPhase[phase2.PhaseId].First(t => t.ParentTaskId.HasValue);
        var task3 = bundle.TasksByPhase[phase3.PhaseId].First(t => t.ParentTaskId.HasValue);
        var task4 = bundle.TasksByPhase[phase4.PhaseId].First(t => t.ParentTaskId.HasValue);
        var d16Boq = await context.BOQItems.SingleAsync(item =>
            item.PhaseId == phase2.PhaseId &&
            item.MaterialId == materials["THEP-HP-D16"].MaterialId &&
            !item.IsDeleted);
        var d16OverQuantity = Math.Ceiling(
            d16Boq.Quantity / (d16Boq.ConversionRate > 0 ? d16Boq.ConversionRate : 1m)) + 10m;

        await SeedProcurementBatchAsync(
            phase1, task1, new DateTime(2025, 3, 12, 2, 0, 0, DateTimeKind.Utc), "202503-01",
            master.Suppliers["Xi măng VICEM Bỉm Sơn"],
            "Cấp xi măng cho công tác xây, cán nền và các hạng mục vữa tại chỗ.",
            BOQCheckStatus.WithinBOQ,
            new[]
            {
                (materials["XM-VICEM-PCB40"], master.Units["BAO"], 120m, 92_000m, 100m, false)
            });

        await SeedProcurementBatchAsync(
            phase1, task1, new DateTime(2025, 4, 1, 2, 0, 0, DateTimeKind.Utc), "202504-01",
            master.Suppliers["Đơn vị bê tông thương phẩm Hưng Yên"],
            "Cấp bê tông thương phẩm cho phần móng, nền và giằng móng.",
            BOQCheckStatus.WithinBOQ,
            new[]
            {
                (materials["BT-TUOI-M250"], master.Units["M3"], 40m, 1_280_000m, 38m, false)
            });

        await SeedProcurementBatchAsync(
            phase2, task2, new DateTime(2025, 5, 20, 2, 0, 0, DateTimeKind.Utc), "202505-01",
            master.Suppliers["Thép Hòa Phát - khu vực miền Bắc"],
            "Cấp thép kết cấu thân nhà; bổ sung một phần do điều chỉnh cấu tạo ô cầu thang.",
            BOQCheckStatus.OverBOQ,
            new[]
            {
                (materials["THEP-HP-D16"], master.Units["CAY"], d16OverQuantity, 242_000m, d16OverQuantity - 20m, true),
                (materials["THEP-HP-D10"], master.Units["CAY"], 280m, 98_000m, 265m, false)
            });

        var finishingBatch = await SeedProcurementBatchAsync(
            phase4, task4, new DateTime(2025, 10, 8, 2, 0, 0, DateTimeKind.Utc), "202510-01",
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"],
            "Cấp vật tư ốp lát, keo và sơn cho giai đoạn hoàn thiện.",
            BOQCheckStatus.WithinBOQ,
            new[]
            {
                (materials["GACH-POR-600"], master.Units["M2"], 320m, 275_000m, 290m, false),
                (materials["WEBER-ST250"], master.Units["BAO"], 90m, 215_000m, 82m, false),
                (materials["SON-NOI-18"], master.Units["THUNG"], 22m, 2_480_000m, 18m, false)
            });

        var materialReturn = new MaterialReturn
        {
            ReturnNo = "PTRA-MO-LAO-20251025-01",
            OriginalIssuanceId = finishingBatch.Issuance.MaterialIssuanceId,
            Reason = "Hoàn vật tư nguyên đai còn dư sau khi chốt khối lượng căn hộ mẫu và khu vực tầng tum.",
            CreatedAt = new DateTime(2025, 10, 25, 2, 0, 0, DateTimeKind.Utc),
            CreatedBy = bundle.Leader.UserId
        };
        context.MaterialReturns.Add(materialReturn);
        await context.SaveChangesAsync();
        await AddReturnLineAsync(context, materialReturn, project, materials["GACH-POR-600"], master.Units["M2"], 12m, bundle.Leader.UserId, materialReturn.CreatedAt);
        await AddReturnLineAsync(context, materialReturn, project, materials["WEBER-ST250"], master.Units["BAO"], 2m, bundle.Leader.UserId, materialReturn.CreatedAt);

        await SeedDirectPurchaseAsync(
            context, project, phase4, task4, bundle.EngineerA, accountant, director,
            materials["WEBER-ST250"], master.Units["BAO"], 4m, 228_000m,
            new DateTime(2025, 10, 22, 2, 0, 0, DateTimeKind.Utc));

        var reworkTask = new ProjectTask
        {
            PhaseId = phase3.PhaseId,
            Name = "Khắc phục thấm cục bộ chân tường khu vệ sinh tầng 3",
            Description = "Tháo cục bộ lớp hoàn thiện, xử lý chống thấm tăng cường và test ngâm nước trước khi hoàn thiện lại.",
            OrderIndex = 98,
            StartDate = new DateOnly(2025, 9, 22),
            EndDate = new DateOnly(2025, 9, 26),
            Status = TaskStatusConstants.Approved,
            ProgressPercent = 100,
            Weight = 1,
            IsLocked = true,
            CreatedAt = new DateTime(2025, 9, 21, 2, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2025, 9, 26, 2, 0, 0, DateTimeKind.Utc),
            CreatedBy = technicalManager.UserId,
            UpdatedBy = bundle.Leader.UserId
        };
        context.Tasks.Add(reworkTask);
        await context.SaveChangesAsync();

        var incidents = new[]
        {
            new Incident
            {
                ProjectId = project.ProjectId,
                PhaseId = phase1.PhaseId,
                TaskId = task1.TaskId,
                ReportedBy = bundle.EngineerA.UserId,
                ReviewedBy = bundle.Leader.UserId,
                IncidentType = "Safety",
                Description = "Lối vận chuyển vật tư xuống hố móng bị trơn sau mưa, cần bổ sung lối đi và biển cảnh báo.",
                Status = IncidentStatus.Resolved,
                DamageDescription = "Không có thiệt hại vật tư hoặc con người.",
                EstimatedMaterialLoss = 0,
                EstimatedLaborDays = 0.5m,
                EstimatedDelayDays = 0,
                ProposedAction = "Rải đá dăm, tạo rãnh thoát nước và bổ sung biển cảnh báo.",
                HandlingInstruction = "Đã xử lý trong ca và nghiệm thu điều kiện an toàn trước khi làm việc lại.",
                CreatedAt = new DateTime(2025, 4, 3, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = bundle.EngineerA.UserId
            },
            new Incident
            {
                ProjectId = project.ProjectId,
                PhaseId = phase3.PhaseId,
                TaskId = task3.TaskId,
                ReworkTaskId = reworkTask.TaskId,
                ReportedBy = bundle.Leader.UserId,
                ReviewedBy = technicalManager.UserId,
                IncidentType = "Construction",
                Description = "Test ngâm nước phát hiện thấm cục bộ tại chân tường khu vệ sinh tầng 3.",
                Status = IncidentStatus.Closed,
                DamageDescription = "Tháo và thi công lại khoảng 7 m² lớp hoàn thiện, không ảnh hưởng kết cấu.",
                EstimatedMaterialLoss = 3_850_000m,
                EstimatedLaborDays = 3,
                EstimatedDelayDays = 2,
                ProposedAction = "Tạo công việc khắc phục, test lại 24 giờ và chỉ ốp lát sau khi nghiệm thu.",
                HandlingInstruction = "Đã hoàn thành khắc phục và đóng sự cố sau kết quả test đạt.",
                CreatedAt = new DateTime(2025, 9, 20, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = bundle.Leader.UserId
            },
            new Incident
            {
                ProjectId = project.ProjectId,
                PhaseId = phase4.PhaseId,
                ReportedBy = bundle.EngineerB.UserId,
                ReviewedBy = technicalManager.UserId,
                IncidentType = "Material",
                Description = "Phản ánh sai khác màu sơn giữa mẫu thử và khu vực giao cuối đợt.",
                Status = "Rejected",
                DamageDescription = "Kiểm tra mã lô cho thấy màu nằm trong dung sai được chủ đầu tư chấp thuận.",
                EstimatedMaterialLoss = 0,
                EstimatedLaborDays = 0,
                EstimatedDelayDays = 0,
                ProposedAction = "Đối chiếu mẫu duyệt và biên bản xác nhận màu.",
                HandlingInstruction = "Không ghi nhận sự cố chất lượng; phản ánh được đóng sau xác minh.",
                CreatedAt = new DateTime(2025, 11, 5, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = bundle.EngineerB.UserId
            }
        };
        context.Incidents.AddRange(incidents);
        await context.SaveChangesAsync();

        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.Incident,
            EntityId = incidents[1].IncidentId,
            AttachmentType = AttachmentType.IncidentPhoto,
            FileName = "bien-ban-khac-phuc-tham-mo-lao.jpg",
            FileUrl = SeedImageConcrete,
            ContentType = "image/jpeg",
            FileSizeBytes = 380_000,
            CreatedAt = incidents[1].CreatedAt,
            CreatedBy = bundle.Leader.UserId
        });
        await context.SaveChangesAsync();
    }

    private static ProjectTask FindLeafTask(ProjectBundle bundle, Phase phase, string nameFragment)
    {
        var phaseTasks = bundle.TasksByPhase[phase.PhaseId];
        var parentIds = phaseTasks
            .Where(task => task.ParentTaskId.HasValue)
            .Select(task => task.ParentTaskId!.Value)
            .ToHashSet();

        return phaseTasks.First(task =>
            !parentIds.Contains(task.TaskId) &&
            task.Name.Contains(nameFragment, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task SeedNguyenXienDailyLogHistoryAsync(
        AppDbContext context,
        ProjectBundle bundle)
    {
        var allTasks = bundle.TasksByPhase.Values.SelectMany(tasks => tasks).ToList();
        var parentIds = allTasks
            .Where(task => task.ParentTaskId.HasValue)
            .Select(task => task.ParentTaskId!.Value)
            .ToHashSet();
        var completedLeafTasks = allTasks
            .Where(task => !parentIds.Contains(task.TaskId))
            .Where(task => task.ProgressPercent == 100 &&
                           task.Status is TaskStatusConstants.Completed or TaskStatusConstants.Approved)
            .ToList();
        var leafTaskIds = completedLeafTasks.Select(task => task.TaskId).ToList();
        var existingMilestones = await context.DailyLogs
            .Where(log => leafTaskIds.Contains(log.TaskId))
            .Select(log => new { log.TaskId, log.NewProgressPercent })
            .ToListAsync();
        var existingByTask = existingMilestones
            .GroupBy(log => log.TaskId)
            .ToDictionary(group => group.Key, group => group.Select(log => log.NewProgressPercent).ToHashSet());
        var assigneeByTask = await context.TaskAssignees
            .Where(assignee => leafTaskIds.Contains(assignee.TaskId))
            .GroupBy(assignee => assignee.TaskId)
            .Select(group => new { TaskId = group.Key, UserId = group.Select(item => item.UserId).First() })
            .ToDictionaryAsync(item => item.TaskId, item => item.UserId);

        foreach (var task in completedLeafTasks)
        {
            var duration = Math.Max(0, task.EndDate.DayNumber - task.StartDate.DayNumber);
            var milestones = new List<(byte Progress, DateOnly Date, string Description)>();
            if (duration <= 1)
            {
                milestones.Add((100, task.EndDate,
                    $"Hoàn thành {task.Name.ToLowerInvariant()}; đã kiểm tra chất lượng, vệ sinh vị trí thi công và bàn giao nội bộ."));
            }
            else if (duration <= 3)
            {
                milestones.Add((30, task.StartDate,
                    $"Triển khai {task.Name.ToLowerInvariant()}; đã kiểm tra hiện trạng, bố trí nhân lực và chuẩn bị đủ điều kiện thi công."));
                milestones.Add((100, task.EndDate,
                    $"Hoàn thành {task.Name.ToLowerInvariant()}; khối lượng và chất lượng đạt yêu cầu để chuyển bước tiếp theo."));
            }
            else
            {
                milestones.Add((30, task.StartDate.AddDays(Math.Max(1, duration * 30 / 100)),
                    $"Đã triển khai {task.Name.ToLowerInvariant()}; mặt bằng, vật tư và biện pháp thi công đã được kiểm tra."));
                milestones.Add((75, task.StartDate.AddDays(Math.Max(2, duration * 70 / 100)),
                    $"{task.Name} đạt khoảng 75% khối lượng; đã tự kiểm tra kích thước, cao độ và chất lượng phần đã làm."));
                milestones.Add((100, task.EndDate,
                    $"Hoàn thành {task.Name.ToLowerInvariant()}; đã xử lý các điểm tồn tại và nghiệm thu nội bộ đạt yêu cầu."));
            }

            existingByTask.TryGetValue(task.TaskId, out var existingProgressValues);
            var creatorId = assigneeByTask.GetValueOrDefault(task.TaskId, bundle.Leader.UserId);
            foreach (var milestone in milestones.Where(item =>
                         existingProgressValues == null || !existingProgressValues.Contains(item.Progress)))
            {
                var createdAt = DateTime.SpecifyKind(
                    milestone.Date.ToDateTime(new TimeOnly(2 + milestone.Progress % 3, 0)),
                    DateTimeKind.Utc);
                context.DailyLogs.Add(new DailyLog
                {
                    TaskId = task.TaskId,
                    LogDate = milestone.Date,
                    NewProgressPercent = milestone.Progress,
                    Description = milestone.Description,
                    CreatedBy = creatorId,
                    CreatedAt = createdAt
                });
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedNguyenXienProcurementHistoryAsync(
        AppDbContext context,
        ProjectBundle bundle,
        User accountant,
        User director,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        async Task<MaterialIssuance> SeedBatchAsync(
            Phase phase,
            ProjectTask task,
            DateTime requestAt,
            string numberSuffix,
            Supplier supplier,
            string reason,
            (string MaterialCode, string UnitCode, decimal Quantity, decimal UnitPrice)[] lines)
        {
            var poNumber = $"PO-NGUYEN-XIEN-{numberSuffix}";
            var issuanceNumber = $"PXK-NGUYEN-XIEN-{numberSuffix}";
            var existingPo = await context.PurchaseOrders.SingleOrDefaultAsync(po => po.PONumber == poNumber);
            if (existingPo != null)
            {
                var existingIssuance = await context.MaterialIssuances
                    .SingleOrDefaultAsync(issuance => issuance.IssuanceNo == issuanceNumber);
                return existingIssuance ?? throw new InvalidOperationException(
                    $"Seed Nguyễn Xiển không nhất quán: đã có {poNumber} nhưng thiếu {issuanceNumber}.");
            }

            var request = await CreateMaterialRequestAsync(
                context, phase, bundle.Leader, accountant, director,
                MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ, reason,
                "Đã đối chiếu BOQ, tồn kho công trường và kế hoạch thi công trước khi đặt hàng.",
                "Duyệt mua đúng định mức và tiến độ của giai đoạn.",
                lines.Select(line =>
                    (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, false, (string?)null)),
                requestAt);
            var po = await CreatePurchaseOrderAsync(
                context, request, bundle.Project, supplier, accountant, director,
                PurchaseOrderStatus.FullyReceived, poNumber, requestAt.AddDays(3),
                lines.Select(line =>
                    (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity, line.UnitPrice)),
                "Nhà cung cấp giao đủ; số lượng, quy cách và chứng từ đã được đối chiếu.");
            await CreateGoodsReceiptAsync(
                context, po, bundle.Leader, GoodsReceiptStatus.Approved,
                $"GR-NGUYEN-XIEN-{numberSuffix}", supplier.SupplierName, $"BBGH-NX-{numberSuffix}",
                lines.Select(line =>
                    (materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity)),
                requestAt.AddDays(7));

            var issuance = new MaterialIssuance
            {
                IssuanceNo = issuanceNumber,
                TaskId = task.TaskId,
                Purpose = $"Xuất đúng khối lượng đã nhập để thực hiện: {reason}",
                CreatedAt = requestAt.AddDays(14),
                CreatedBy = bundle.Leader.UserId
            };
            context.MaterialIssuances.Add(issuance);
            await context.SaveChangesAsync();
            foreach (var line in lines)
            {
                await AddIssuanceLineAsync(
                    context, issuance, bundle.Project,
                    materials[line.MaterialCode], master.Units[line.UnitCode], line.Quantity,
                    bundle.Leader.UserId, issuance.CreatedAt);
            }

            return issuance;
        }

        var phase1 = bundle.Phases[0];
        var phase2 = bundle.Phases[1];
        var phase3 = bundle.Phases[2];

        await SeedBatchAsync(
            phase1, FindLeafTask(bundle, phase1, "Bố trí vách ngăn bụi"),
            new DateTime(2026, 1, 11, 2, 0, 0, DateTimeKind.Utc), "202601-01",
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"],
            "Cấp vật tư làm vách ngăn bụi, bịt tạm ô mở và hoàn trả cục bộ sau tháo dỡ.",
            new[]
            {
                ("DINH-THEP-5CM", "KG", 12m, 25_000m),
                ("GACH-DAC-A1", "VIEN", 320m, 1_350m),
                ("XM-INSEE-PCB40", "BAO", 22m, 103_000m),
                ("CAT-XAY-TO", "M3", 3m, 390_000m)
            });

        var masonryIssuance = await SeedBatchAsync(
            phase2, FindLeafTask(bundle, phase2, "Xây bù tường"),
            new DateTime(2026, 2, 5, 2, 0, 0, DateTimeKind.Utc), "202602-01",
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"],
            "Cấp gạch, xi măng và cát cho xây bù tường, vá lỗ mở, tô rãnh và cán nền.",
            new[]
            {
                ("XM-INSEE-PCB40", "BAO", 145m, 102_000m),
                ("GACH-2LO-220", "VIEN", 1_300m, 1_250m),
                ("GACH-DAC-A1", "VIEN", 420m, 1_350m),
                ("CAT-XAY-TO", "M3", 18m, 385_000m)
            });

        await SeedBatchAsync(
            phase2, FindLeafTask(bundle, phase2, "Lắp ống luồn D20/D25"),
            new DateTime(2026, 2, 17, 2, 0, 0, DateTimeKind.Utc), "202602-02",
            master.Suppliers["Đại lý điện nước An Phát"],
            "Cấp đồng bộ ống luồn, dây điện và ống cấp thoát cho phần điện nước âm.",
            new[]
            {
                ("CADIVI-CV1.5", "CUON", 6m, 1_650_000m),
                ("ONG-LUON-D20", "CAY", 55m, 29_000m),
                ("ONG-LUON-D25", "CAY", 22m, 42_000m),
                ("PPR-D20", "CAY", 20m, 82_000m),
                ("PVC-D90", "CAY", 14m, 118_000m),
                ("CO-PPR-D25", "CAI", 24m, 18_000m)
            });

        await SeedBatchAsync(
            phase2, FindLeafTask(bundle, phase2, "Thi công lớp chống thấm thứ nhất"),
            new DateTime(2026, 2, 27, 2, 0, 0, DateTimeKind.Utc), "202602-03",
            master.Suppliers["Sika Việt Nam"],
            "Cấp vật liệu chống thấm và vữa không co ngót cho khu vệ sinh, ban công và cổ ống.",
            new[]
            {
                ("SIKA-TOP-107", "BO", 16m, 1_380_000m),
                ("SIKA-GROUT-214", "BAO", 6m, 310_000m)
            });

        await SeedBatchAsync(
            phase3, FindLeafTask(bundle, phase3, "Lắp thanh treo và khung xương"),
            new DateTime(2026, 3, 16, 2, 0, 0, DateTimeKind.Utc), "202603-01",
            master.Suppliers["Kho thạch cao và phụ kiện hoàn thiện Hà Nội"],
            "Cấp tấm, khung xương và vít cho trần thạch cao các tầng.",
            new[]
            {
                ("TAM-THACH-CAO-9", "TAM", 100m, 125_000m),
                ("KHUNG-XUONG-CHINH", "CAY", 70m, 43_000m),
                ("KHUNG-XUONG-PHU", "CAY", 130m, 31_000m),
                ("VIT-THACH-CAO", "HOP", 9m, 145_000m)
            });

        await SeedBatchAsync(
            phase3, FindLeafTask(bundle, phase3, "Bả lớp thứ nhất"),
            new DateTime(2026, 4, 2, 2, 0, 0, DateTimeKind.Utc), "202604-02",
            master.Suppliers["Nhà phân phối sơn Dulux Hà Nội"],
            "Cấp bột bả, sơn lót và sơn phủ theo mã màu đã được Chủ đầu tư xác nhận.",
            new[]
            {
                ("BOT-BA-40", "BAO", 55m, 285_000m),
                ("SON-LOT-NOI-18", "THUNG", 13m, 2_250_000m),
                ("SON-NOI-18", "THUNG", 6m, 2_520_000m)
            });

        const string masonryReturnNo = "PTRA-NGUYEN-XIEN-20260224-01";
        if (!await context.MaterialReturns.AnyAsync(materialReturn => materialReturn.ReturnNo == masonryReturnNo))
        {
            var materialReturn = new MaterialReturn
            {
                ReturnNo = masonryReturnNo,
                OriginalIssuanceId = masonryIssuance.MaterialIssuanceId,
                Reason = "Hoàn tạm 60 viên gạch và 3 bao xi măng còn nguyên khi Chủ đầu tư điều chỉnh vị trí tường ngăn.",
                CreatedAt = new DateTime(2026, 2, 24, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = bundle.Leader.UserId
            };
            context.MaterialReturns.Add(materialReturn);
            await context.SaveChangesAsync();
            await AddReturnLineAsync(
                context, materialReturn, bundle.Project,
                materials["GACH-2LO-220"], master.Units["VIEN"], 60m,
                bundle.Leader.UserId, materialReturn.CreatedAt);
            await AddReturnLineAsync(
                context, materialReturn, bundle.Project,
                materials["XM-INSEE-PCB40"], master.Units["BAO"], 3m,
                bundle.Leader.UserId, materialReturn.CreatedAt);
        }

        const string reissuanceNo = "PXK-NGUYEN-XIEN-20260301-BS";
        if (!await context.MaterialIssuances.AnyAsync(issuance => issuance.IssuanceNo == reissuanceNo))
        {
            var reissuance = new MaterialIssuance
            {
                IssuanceNo = reissuanceNo,
                TaskId = FindLeafTask(bundle, phase2, "Tô vá rãnh điện nước").TaskId,
                Purpose = "Xuất lại vật tư đã hoàn kho sau khi chốt vị trí tường ngăn và phạm vi tô vá điều chỉnh.",
                CreatedAt = new DateTime(2026, 3, 1, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = bundle.Leader.UserId
            };
            context.MaterialIssuances.Add(reissuance);
            await context.SaveChangesAsync();
            await AddIssuanceLineAsync(
                context, reissuance, bundle.Project,
                materials["GACH-2LO-220"], master.Units["VIEN"], 60m,
                bundle.Leader.UserId, reissuance.CreatedAt);
            await AddIssuanceLineAsync(
                context, reissuance, bundle.Project,
                materials["XM-INSEE-PCB40"], master.Units["BAO"], 3m,
                bundle.Leader.UserId, reissuance.CreatedAt);
        }
    }

    private static async Task SeedNguyenXienReturnedSurplusAsync(
        AppDbContext context,
        ProjectBundle source,
        ProjectBundle target,
        User accountant,
        User technicalManager,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        const string reasonMarker = "Đối soát riêng vật tư nguyên kiện đã hoàn lại từ công trường Nguyễn Xiển";
        if (await context.SurplusRequests.AnyAsync(request =>
                request.ProjectId == source.Project.ProjectId &&
                request.Reason != null && request.Reason.StartsWith(reasonMarker)))
        {
            return;
        }

        async Task EnsureAvailableAsync(string materialCode, decimal requiredQuantity)
        {
            var material = materials[materialCode];
            var available = await context.CurrentInventories
                .Where(inventory => inventory.ProjectId == source.Project.ProjectId &&
                                    inventory.MaterialId == material.MaterialId &&
                                    inventory.UnitId == material.BaseUnitId)
                .Select(inventory => inventory.Quantity)
                .SingleOrDefaultAsync();
            if (available < requiredQuantity)
            {
                throw new InvalidOperationException(
                    $"Không đủ tồn thực tế {materialCode} để xử lý vật tư hoàn lại của Nguyễn Xiển.");
            }
        }

        await EnsureAvailableAsync("GACH-POR-600", 5m);
        await EnsureAvailableAsync("WEBER-ST250", 2m);

        var createdAt = new DateTime(2026, 5, 21, 2, 0, 0, DateTimeKind.Utc);
        var surplus = new SurplusRequest
        {
            ProjectId = source.Project.ProjectId,
            Reason = $"{reasonMarker}; đã tách riêng và xử lý hết trước khi nghiệm thu bàn giao dự án.",
            Status = SurplusRequestStatus.Processed,
            CreatedAt = createdAt,
            CreatedBy = source.Leader.UserId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        async Task<SurplusRequestItem> AddItemAsync(
            string materialCode, string unitCode, decimal quantity, string closeReason)
        {
            var material = materials[materialCode];
            var unit = master.Units[unitCode];
            var item = new SurplusRequestItem
            {
                SurplusRequestId = surplus.SurplusRequestId,
                MaterialId = material.MaterialId,
                UnitId = unit.UnitId,
                Quantity = quantity,
                ProcessedQuantity = quantity,
                ConversionRate = await GetConversionRateAsync(context, material, unit),
                Status = SurplusRequestItemStatus.Completed,
                CloseReason = closeReason,
                CreatedAt = createdAt,
                CreatedBy = source.Leader.UserId
            };
            context.SurplusRequestItems.Add(item);
            await context.SaveChangesAsync();
            return item;
        }

        var tileItem = await AddItemAsync(
            "GACH-POR-600", "M2", 5m,
            "Đã điều chuyển đủ 5 m² gạch nguyên hộp sang dự án đang thi công.");
        var adhesiveItem = await AddItemAsync(
            "WEBER-ST250", "BAO", 2m,
            "Nhà cung cấp đã nhận lại đủ 2 bao còn nguyên và xác nhận hoàn tiền.");

        var transfer = new SurplusTransfer
        {
            SurplusRequestItemId = tileItem.SurplusRequestItemId,
            FromProjectId = source.Project.ProjectId,
            ToProjectId = target.Project.ProjectId,
            TransferQuantity = 5m,
            Status = SurplusTransferStatus.Received,
            ApprovedBy = technicalManager.UserId,
            ApprovedAt = createdAt.AddDays(1),
            DispatchedBy = source.Leader.UserId,
            DispatchedAt = createdAt.AddDays(2),
            ReceivedBy = target.Leader.UserId,
            ReceivedAt = createdAt.AddDays(3),
            CreatedAt = createdAt,
            CreatedBy = source.Leader.UserId
        };
        context.SurplusTransfers.Add(transfer);
        await context.SaveChangesAsync();
        await ApplyStockAsync(
            context, source.Project, materials["GACH-POR-600"], -(5m / tileItem.ConversionRate),
            InventoryTransactionType.TransferOut, transfer.SurplusTransferId, EntityType.SurplusTransferDispatch,
            source.Leader.UserId, transfer.DispatchedAt!.Value);
        await ApplyStockAsync(
            context, target.Project, materials["GACH-POR-600"], 5m / tileItem.ConversionRate,
            InventoryTransactionType.TransferIn, transfer.SurplusTransferId, EntityType.SurplusTransferReceive,
            target.Leader.UserId, transfer.ReceivedAt!.Value);

        var supplierReturn = new SurplusReturnSupplier
        {
            SurplusRequestItemId = adhesiveItem.SurplusRequestItemId,
            SupplierId = master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"].SupplierId,
            ReturnQuantity = 2m,
            RefundAmount = 420_000m,
            Note = "Nhà cung cấp nhận lại 2 bao keo nguyên đai, khấu trừ theo đơn giá lô mua ban đầu.",
            CreatedAt = createdAt.AddDays(4),
            CreatedBy = accountant.UserId
        };
        context.SurplusReturnSuppliers.Add(supplierReturn);
        await context.SaveChangesAsync();
        await ApplyStockAsync(
            context, source.Project, materials["WEBER-ST250"], -(2m / adhesiveItem.ConversionRate),
            InventoryTransactionType.ReturnToSupplier, supplierReturn.SurplusReturnSupplierId,
            EntityType.SurplusReturnSupplier, accountant.UserId, supplierReturn.CreatedAt);

        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.SurplusRequest,
            EntityId = surplus.SurplusRequestId,
            AttachmentType = AttachmentType.SurplusEvidence,
            FileName = "doi-soat-vat-tu-hoan-lai-nguyen-xien.jpg",
            FileUrl = SeedImageDelivery,
            ContentType = "image/jpeg",
            FileSizeBytes = 365_000,
            CreatedAt = createdAt,
            CreatedBy = source.Leader.UserId
        });
        await context.SaveChangesAsync();
    }

    private static async Task NormalizeNguyenXienCompletedProjectHistoryAsync(
        AppDbContext context,
        ProjectBundle source,
        ProjectBundle target,
        Dictionary<string, MaterialCatalog> materials)
    {
        var issuance = await context.MaterialIssuances
            .SingleAsync(item => item.IssuanceNo == "PXK-NGUYEN-XIEN-20260425-01");
        var issuanceItems = await context.MaterialIssuanceItems
            .Where(item => item.MaterialIssuanceId == issuance.MaterialIssuanceId)
            .ToListAsync();

        async Task SetIssuanceQuantityAsync(string materialCode, decimal quantity)
        {
            var material = materials[materialCode];
            var item = issuanceItems.Single(line => line.MaterialId == material.MaterialId);
            item.Quantity = quantity;
            var transaction = await context.InventoryTransactions.SingleAsync(movement =>
                movement.ProjectId == source.Project.ProjectId &&
                movement.MaterialId == material.MaterialId &&
                movement.ReferenceId == issuance.MaterialIssuanceId &&
                movement.ReferenceType == EntityType.MaterialIssuance);
            transaction.QuantityChange = -(quantity / item.ConversionRate);
        }

        // Khối lượng dư phải phản ánh phần còn lại hợp lý của một công trình cải tạo,
        // không phải 30-35% lô gạch/keo cuối kỳ như phiên bản seed cũ.
        await SetIssuanceQuantityAsync("GACH-POR-600", 90m);
        await SetIssuanceQuantityAsync("WEBER-ST250", 55m);
        await SetIssuanceQuantityAsync("SON-NOI-18", 11m);

        var requests = await context.SurplusRequests
            .Include(request => request.Items)
            .Where(request => request.ProjectId == source.Project.ProjectId)
            .ToListAsync();
        var primary = requests.Single(request => request.Items.Count == 3 &&
            request.Items.Any(item => item.MaterialId == materials["SON-NOI-18"].MaterialId));
        var returned = requests.Single(request => request.Items.Count == 2 &&
            request.Items.Any(item => item.MaterialId == materials["GACH-POR-600"].MaterialId) &&
            request.Items.Any(item => item.MaterialId == materials["WEBER-ST250"].MaterialId));

        var primaryCreatedAt = new DateTime(2026, 5, 15, 2, 0, 0, DateTimeKind.Utc);
        primary.Reason = "Đối soát vật tư trước nghiệm thu bàn giao; toàn bộ phần dư được điều chuyển, trả NCC hoặc thanh lý trước khi đóng dự án.";
        primary.Status = SurplusRequestStatus.Processed;
        primary.CreatedAt = primaryCreatedAt;
        primary.UpdatedAt = primaryCreatedAt.AddDays(5);

        SurplusRequestItem SetCompletedItem(
            SurplusRequest request, string materialCode, decimal quantity, string closeReason)
        {
            var item = request.Items.Single(row => row.MaterialId == materials[materialCode].MaterialId);
            item.Quantity = quantity;
            item.ProcessedQuantity = quantity;
            item.Status = SurplusRequestItemStatus.Completed;
            item.CloseReason = closeReason;
            item.CreatedAt = request.CreatedAt;
            item.UpdatedAt = request.UpdatedAt;
            return item;
        }

        var primaryTile = SetCompletedItem(primary, "GACH-POR-600", 10m,
            "Đã điều chuyển đủ 10 m² sang dự án đang thi công.");
        var primaryAdhesive = SetCompletedItem(primary, "WEBER-ST250", 5m,
            "Nhà cung cấp đã nhận lại đủ 5 bao nguyên kiện và hoàn tiền.");
        var primaryPaint = SetCompletedItem(primary, "SON-NOI-18", 1m,
            "Đã thanh lý 1 thùng còn niêm phong theo biên bản.");

        var primaryTransfer = await context.SurplusTransfers
            .SingleAsync(action => action.SurplusRequestItemId == primaryTile.SurplusRequestItemId);
        primaryTransfer.TransferQuantity = 10m;
        primaryTransfer.Status = SurplusTransferStatus.Received;
        primaryTransfer.CreatedAt = primaryCreatedAt;
        primaryTransfer.ApprovedAt = primaryCreatedAt.AddDays(1);
        primaryTransfer.DispatchedAt = primaryCreatedAt.AddDays(2);
        primaryTransfer.ReceivedAt = primaryCreatedAt.AddDays(3);
        primaryTransfer.UpdatedAt = primaryTransfer.ReceivedAt;

        var primarySupplierReturn = await context.SurplusReturnSuppliers
            .SingleAsync(action => action.SurplusRequestItemId == primaryAdhesive.SurplusRequestItemId);
        primarySupplierReturn.ReturnQuantity = 5m;
        primarySupplierReturn.RefundAmount = 1_050_000m;
        primarySupplierReturn.Note = "NCC nhận lại 5 bao keo nguyên đai và hoàn tiền theo đơn giá thỏa thuận.";
        primarySupplierReturn.CreatedAt = primaryCreatedAt.AddDays(4);

        var primaryLiquidation = await context.SurplusLiquidations
            .SingleAsync(action => action.SurplusRequestItemId == primaryPaint.SurplusRequestItemId);
        primaryLiquidation.LiquidationQuantity = 1m;
        primaryLiquidation.TotalAmount = 1_600_000m;
        primaryLiquidation.CreatedAt = primaryCreatedAt.AddDays(5);

        var returnedCreatedAt = new DateTime(2026, 5, 21, 2, 0, 0, DateTimeKind.Utc);
        returned.Reason = "Đối soát riêng vật tư nguyên kiện đã hoàn lại từ công trường Nguyễn Xiển; đã tách riêng và xử lý hết trước khi nghiệm thu bàn giao dự án.";
        returned.Status = SurplusRequestStatus.Processed;
        returned.CreatedAt = returnedCreatedAt;
        returned.UpdatedAt = returnedCreatedAt.AddDays(4);
        var returnedTile = SetCompletedItem(returned, "GACH-POR-600", 5m,
            "Đã điều chuyển đủ 5 m² gạch nguyên hộp sang dự án đang thi công.");
        var returnedAdhesive = SetCompletedItem(returned, "WEBER-ST250", 2m,
            "Nhà cung cấp đã nhận lại đủ 2 bao còn nguyên và xác nhận hoàn tiền.");

        var returnedTransfer = await context.SurplusTransfers
            .SingleAsync(action => action.SurplusRequestItemId == returnedTile.SurplusRequestItemId);
        returnedTransfer.TransferQuantity = 5m;
        returnedTransfer.Status = SurplusTransferStatus.Received;
        returnedTransfer.CreatedAt = returnedCreatedAt;
        returnedTransfer.ApprovedAt = returnedCreatedAt.AddDays(1);
        returnedTransfer.DispatchedAt = returnedCreatedAt.AddDays(2);
        returnedTransfer.ReceivedAt = returnedCreatedAt.AddDays(3);
        returnedTransfer.UpdatedAt = returnedTransfer.ReceivedAt;

        var returnedSupplierReturn = await context.SurplusReturnSuppliers
            .SingleAsync(action => action.SurplusRequestItemId == returnedAdhesive.SurplusRequestItemId);
        returnedSupplierReturn.ReturnQuantity = 2m;
        returnedSupplierReturn.RefundAmount = 420_000m;
        returnedSupplierReturn.CreatedAt = returnedCreatedAt.AddDays(4);

        async Task SetMovementAsync(
            long projectId, long materialId, long referenceId, string referenceType,
            decimal quantityChange, DateTime createdAt)
        {
            var movement = await context.InventoryTransactions.SingleAsync(transaction =>
                transaction.ProjectId == projectId &&
                transaction.MaterialId == materialId &&
                transaction.ReferenceId == referenceId &&
                transaction.ReferenceType == referenceType);
            movement.QuantityChange = quantityChange;
            movement.CreatedAt = createdAt;
        }

        var tile = materials["GACH-POR-600"];
        var adhesive = materials["WEBER-ST250"];
        var paint = materials["SON-NOI-18"];
        await SetMovementAsync(source.Project.ProjectId, tile.MaterialId,
            primaryTransfer.SurplusTransferId, EntityType.SurplusTransferDispatch,
            -(primaryTransfer.TransferQuantity / primaryTile.ConversionRate), primaryTransfer.DispatchedAt!.Value);
        await SetMovementAsync(target.Project.ProjectId, tile.MaterialId,
            primaryTransfer.SurplusTransferId, EntityType.SurplusTransferReceive,
            primaryTransfer.TransferQuantity / primaryTile.ConversionRate, primaryTransfer.ReceivedAt!.Value);
        await SetMovementAsync(source.Project.ProjectId, adhesive.MaterialId,
            primarySupplierReturn.SurplusReturnSupplierId, EntityType.SurplusReturnSupplier,
            -(primarySupplierReturn.ReturnQuantity / primaryAdhesive.ConversionRate), primarySupplierReturn.CreatedAt);
        await SetMovementAsync(source.Project.ProjectId, paint.MaterialId,
            primaryLiquidation.SurplusLiquidationId, EntityType.SurplusLiquidation,
            -(primaryLiquidation.LiquidationQuantity / primaryPaint.ConversionRate), primaryLiquidation.CreatedAt);
        await SetMovementAsync(source.Project.ProjectId, tile.MaterialId,
            returnedTransfer.SurplusTransferId, EntityType.SurplusTransferDispatch,
            -(returnedTransfer.TransferQuantity / returnedTile.ConversionRate), returnedTransfer.DispatchedAt!.Value);
        await SetMovementAsync(target.Project.ProjectId, tile.MaterialId,
            returnedTransfer.SurplusTransferId, EntityType.SurplusTransferReceive,
            returnedTransfer.TransferQuantity / returnedTile.ConversionRate, returnedTransfer.ReceivedAt!.Value);
        await SetMovementAsync(source.Project.ProjectId, adhesive.MaterialId,
            returnedSupplierReturn.SurplusReturnSupplierId, EntityType.SurplusReturnSupplier,
            -(returnedSupplierReturn.ReturnQuantity / returnedAdhesive.ConversionRate), returnedSupplierReturn.CreatedAt);

        var requestIds = new[] { primary.SurplusRequestId, returned.SurplusRequestId };
        var evidence = await context.Attachments
            .Where(file => file.EntityType == EntityType.SurplusRequest && requestIds.Contains(file.EntityId))
            .ToListAsync();
        foreach (var file in evidence)
        {
            file.CreatedAt = file.EntityId == primary.SurplusRequestId ? primaryCreatedAt : returnedCreatedAt;
        }

        await context.SaveChangesAsync();

        async Task RebuildInventoryBalanceAsync(Project project, MaterialCatalog material)
        {
            var movements = await context.InventoryTransactions
                .Where(transaction => transaction.ProjectId == project.ProjectId &&
                                      transaction.MaterialId == material.MaterialId)
                .OrderBy(transaction => transaction.CreatedAt)
                .ThenBy(transaction => transaction.TransactionId)
                .ToListAsync();
            decimal balance = 0;
            foreach (var movement in movements)
            {
                balance += movement.QuantityChange;
                if (balance < 0)
                {
                    throw new InvalidOperationException(
                        $"Lịch sử kho Nguyễn Xiển không hợp lệ tại giao dịch {movement.TransactionId}: số dư {balance}.");
                }
                movement.BalanceAfter = balance;
            }

            var inventory = await context.CurrentInventories.SingleAsync(item =>
                item.ProjectId == project.ProjectId &&
                item.MaterialId == material.MaterialId &&
                item.UnitId == material.BaseUnitId);
            inventory.Quantity = balance;
            if (inventory.ReservedQuantity > balance) inventory.ReservedQuantity = balance;
            inventory.LastUpdated = movements.Count == 0 ? SeedUtc : movements[^1].CreatedAt;
        }

        await RebuildInventoryBalanceAsync(source.Project, tile);
        await RebuildInventoryBalanceAsync(source.Project, adhesive);
        await RebuildInventoryBalanceAsync(source.Project, paint);
        await RebuildInventoryBalanceAsync(target.Project, tile);
        await context.SaveChangesAsync();
    }

    // -------------------------------------------------------------------------
    // COMPLETED PROJECT REPORT SHOWCASE: keep two finished projects rich enough
    // to demonstrate every report tab. This patch is idempotent so it can enrich
    // an existing current seed without resetting the whole database.
    // -------------------------------------------------------------------------
    public static async Task SeedCompletedProjectReportShowcaseAsync(AppDbContext context)
    {
        const string moLaoName = "Nhà ở liền kề LK4B Mỗ Lao – Hà Đông";
        const string nguyenXienName = "Cải tạo nhà phố Nguyễn Xiển – Thanh Xuân";
        const string transferTargetName = "Biệt thự nhà chú Công – khu San Hô, Vinhomes Ocean Park 2";

        async Task<ProjectBundle> LoadBundleAsync(string projectName)
        {
            var project = await context.Projects.SingleAsync(p => p.Name == projectName);
            var phases = await context.Phases
                .Where(p => p.ProjectId == project.ProjectId)
                .OrderBy(p => p.OrderIndex)
                .ToListAsync();
            var phaseIds = phases.Select(p => p.PhaseId).ToList();
            var tasks = await context.Tasks
                .Where(t => phaseIds.Contains(t.PhaseId))
                .OrderBy(t => t.OrderIndex)
                .ToListAsync();
            var members = await context.ProjectMembers
                .Include(member => member.User)
                .Where(member => member.ProjectId == project.ProjectId)
                .OrderByDescending(member => member.IsLeader)
                .ThenBy(member => member.ProjectMemberId)
                .ToListAsync();
            var leader = members.First(member => member.IsLeader).User;
            var engineers = members.Where(member => !member.IsLeader).Select(member => member.User).ToList();

            return new ProjectBundle(
                project,
                leader,
                engineers.ElementAtOrDefault(0) ?? leader,
                engineers.ElementAtOrDefault(1) ?? leader,
                phases,
                phases.ToDictionary(
                    phase => phase.PhaseId,
                    phase => tasks.Where(task => task.PhaseId == phase.PhaseId).ToList()));
        }

        var users = await context.Users.ToDictionaryAsync(user => user.Email, StringComparer.OrdinalIgnoreCase);
        var master = new MasterData(
            await context.Units.ToDictionaryAsync(unit => unit.UnitCode),
            await context.MaterialCategories.ToDictionaryAsync(category => category.CategoryName),
            await context.Suppliers.ToDictionaryAsync(supplier => supplier.SupplierName));
        var materials = await context.MaterialCatalogs.ToDictionaryAsync(material => material.Code);
        var moLao = await LoadBundleAsync(moLaoName);
        var nguyenXien = await LoadBundleAsync(nguyenXienName);
        var transferTarget = await LoadBundleAsync(transferTargetName);

        if (!await context.PurchaseOrders.AnyAsync(po => po.PONumber == "PO-NGUYEN-XIEN-202604-01"))
        {
            var bundles = new Dictionary<string, ProjectBundle>
            {
                [nguyenXienName] = nguyenXien,
                [transferTargetName] = transferTarget
            };
            await SeedCompletedProjectSurplusAsync(context, bundles, users, master, materials);
        }

        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];
        var technicalManager = users["tpkt@bpg.com"];

        await SeedNguyenXienDailyLogHistoryAsync(context, nguyenXien);
        await SeedNguyenXienProcurementHistoryAsync(
            context, nguyenXien, accountant, director, master, materials);

        // Nguyễn Xiển: real historical progress so the S-curve does not jump
        // straight from zero to 100% at task creation.
        var nguyenXienTaskIds = nguyenXien.TasksByPhase.Values.SelectMany(tasks => tasks)
            .Select(task => task.TaskId)
            .ToList();
        if (!await context.TaskProgressLogs.AnyAsync(log => nguyenXienTaskIds.Contains(log.TaskId)))
        {
            foreach (var task in nguyenXien.TasksByPhase.Values.SelectMany(tasks => tasks))
            {
                var duration = Math.Max(0, task.EndDate.DayNumber - task.StartDate.DayNumber);
                DateTime At(int percent, int hour) => DateTime.SpecifyKind(
                    task.StartDate.AddDays(duration * percent / 100).ToDateTime(new TimeOnly(hour, 0)),
                    DateTimeKind.Utc);
                var firstAt = At(30, 1);
                var secondAt = At(70, 2);
                var completedAt = DateTime.SpecifyKind(task.EndDate.ToDateTime(new TimeOnly(3, 0)), DateTimeKind.Utc);
                context.TaskProgressLogs.AddRange(
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId, OldProgress = 0, NewProgress = 30,
                        UpdateReason = "Hoàn thành chuẩn bị và khối lượng đầu kỳ.",
                        CreatedAt = firstAt, UpdatedAt = firstAt, CreatedBy = nguyenXien.EngineerA.UserId
                    },
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId, OldProgress = 30, NewProgress = 75,
                        UpdateReason = "Khối lượng chính đã thi công và được kiểm tra nội bộ.",
                        CreatedAt = secondAt, UpdatedAt = secondAt, CreatedBy = nguyenXien.Leader.UserId
                    },
                    new TaskProgressLog
                    {
                        TaskId = task.TaskId, OldProgress = 75, NewProgress = 100,
                        UpdateReason = "Hoàn thành, nghiệm thu và khóa khối lượng công việc.",
                        CreatedAt = completedAt, UpdatedAt = completedAt, CreatedBy = nguyenXien.Leader.UserId
                    });
            }
            await context.SaveChangesAsync();
        }

        var nguyenXienIssuance = await context.MaterialIssuances
            .SingleAsync(issuance => issuance.IssuanceNo == "PXK-NGUYEN-XIEN-20260425-01");
        var finishingLeafTask = FindLeafTask(nguyenXien, nguyenXien.Phases[2], "Lát gạch sàn khu khô");
        nguyenXienIssuance.TaskId = finishingLeafTask.TaskId;
        nguyenXienIssuance.Purpose =
            "Xuất gạch, keo dán gạch và sơn theo khối lượng thi công hoàn thiện đã được duyệt.";
        await context.SaveChangesAsync();
        if (!await context.MaterialReturns.AnyAsync(ret => ret.ReturnNo == "PTRA-NGUYEN-XIEN-20260502-01"))
        {
            var materialReturn = new MaterialReturn
            {
                ReturnNo = "PTRA-NGUYEN-XIEN-20260502-01",
                OriginalIssuanceId = nguyenXienIssuance.MaterialIssuanceId,
                Reason = "Hoàn lại gạch và keo còn nguyên sau khi chốt khối lượng hoàn thiện.",
                CreatedAt = new DateTime(2026, 5, 2, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = nguyenXien.Leader.UserId
            };
            context.MaterialReturns.Add(materialReturn);
            await context.SaveChangesAsync();
            await AddReturnLineAsync(context, materialReturn, nguyenXien.Project,
                materials["GACH-POR-600"], master.Units["M2"], 5m,
                nguyenXien.Leader.UserId, materialReturn.CreatedAt);
            await AddReturnLineAsync(context, materialReturn, nguyenXien.Project,
                materials["WEBER-ST250"], master.Units["BAO"], 2m,
                nguyenXien.Leader.UserId, materialReturn.CreatedAt);
        }

        var directPurchaseDate = new DateTime(2026, 5, 8, 2, 0, 0, DateTimeKind.Utc);
        var touchUpTask = FindLeafTask(nguyenXien, nguyenXien.Phases[3], "Dặm vá sơn");
        var directPurchase = await context.DirectPurchaseRequests.SingleOrDefaultAsync(dp =>
            dp.ProjectId == nguyenXien.Project.ProjectId && dp.PurchaseDate == directPurchaseDate);
        if (directPurchase == null)
        {
            var phase = nguyenXien.Phases[3];
            await SeedDirectPurchaseAsync(
                context, nguyenXien.Project, phase, touchUpTask, nguyenXien.EngineerA, accountant, director,
                materials["SON-NOI-18"], master.Units["THUNG"], 2m, 2_620_000m,
                directPurchaseDate);
            directPurchase = await context.DirectPurchaseRequests.SingleAsync(dp =>
                dp.ProjectId == nguyenXien.Project.ProjectId && dp.PurchaseDate == directPurchaseDate);
        }

        directPurchase.TaskId = touchUpTask.TaskId;
        directPurchase.Reason =
            "Mua bổ sung 2 thùng sơn đúng mã màu để dặm vá các vị trí va quệt sau lắp đặt thiết bị, tránh gián đoạn bàn giao.";
        await context.SaveChangesAsync();

        const string directPurchaseIssuanceNo = "PXK-NGUYEN-XIEN-20260509-DP";
        if (!await context.MaterialIssuances.AnyAsync(issuance => issuance.IssuanceNo == directPurchaseIssuanceNo))
        {
            var directPurchaseIssuance = new MaterialIssuance
            {
                IssuanceNo = directPurchaseIssuanceNo,
                TaskId = touchUpTask.TaskId,
                Purpose = "Xuất 2 thùng sơn mua bổ sung để dặm vá lỗi hoàn thiện trước nghiệm thu nội bộ.",
                CreatedAt = directPurchaseDate.AddDays(1),
                CreatedBy = nguyenXien.Leader.UserId
            };
            context.MaterialIssuances.Add(directPurchaseIssuance);
            await context.SaveChangesAsync();
            await AddIssuanceLineAsync(
                context, directPurchaseIssuance, nguyenXien.Project,
                materials["SON-NOI-18"], master.Units["THUNG"], 2m,
                nguyenXien.Leader.UserId, directPurchaseIssuance.CreatedAt);
        }

        var nguyenXienPoItems = await context.PurchaseOrderItems
            .Where(item => item.PurchaseOrder.ProjectId == nguyenXien.Project.ProjectId)
            .ToListAsync();
        foreach (var poItem in nguyenXienPoItems)
        {
            poItem.Notes =
                "Đơn giá đã được đối chiếu theo báo giá nhà cung cấp tại thời điểm lập đơn và chưa bao gồm biến động sau ngày đặt hàng.";
        }
        await context.SaveChangesAsync();

        // Chỉ dùng các loại sự cố mà luồng nghiệp vụ thực tế hỗ trợ. Mỗi sự cố lịch sử
        // của dự án đã hoàn thành phải được khắc phục, xác nhận và đóng trước ngày bàn giao.
        const string safetyIncidentMarker = "Kiểm tra giàn giáo khu vực mặt tiền sau mưa";
        const string waterproofIncidentMarker = "Phát hiện thấm cục bộ chân tường khu vệ sinh tầng 2";
        const string tileIncidentMarker = "Phản ánh chênh màu gạch giữa hai lô giao hàng cuối kỳ";

        var phase1 = nguyenXien.Phases[0];
        var phase2 = nguyenXien.Phases[1];
        var phase3 = nguyenXien.Phases[2];
        var safetyTask = FindLeafTask(nguyenXien, phase1, "Bố trí biển báo");
        var waterproofTask = FindLeafTask(nguyenXien, phase2, "Ngâm thử nước tối thiểu 48 giờ");
        var tileInspectionTask = FindLeafTask(nguyenXien, phase3, "Kiểm tra lô gạch");

        async Task<Incident> GetOrCreateIncidentAsync(string marker, Func<Incident> create)
        {
            var incident = await context.Incidents.FirstOrDefaultAsync(item =>
                item.ProjectId == nguyenXien.Project.ProjectId &&
                item.Description.StartsWith(marker));
            if (incident != null) return incident;

            incident = create();
            context.Incidents.Add(incident);
            await context.SaveChangesAsync();
            return incident;
        }

        var safetyIncident = await GetOrCreateIncidentAsync(safetyIncidentMarker, () => new Incident
        {
            ProjectId = nguyenXien.Project.ProjectId,
            ReportedBy = nguyenXien.EngineerA.UserId,
            CreatedBy = nguyenXien.EngineerA.UserId,
            Description = safetyIncidentMarker
        });
        safetyIncident.PhaseId = phase1.PhaseId;
        safetyIncident.TaskId = safetyTask.TaskId;
        safetyIncident.ReviewedBy = nguyenXien.Leader.UserId;
        safetyIncident.IncidentType = "Construction";
        safetyIncident.Description = $"{safetyIncidentMarker}; một vị trí neo giằng bị lỏng và đã được cô lập ngay.";
        safetyIncident.Status = IncidentStatus.Closed;
        safetyIncident.DamageDescription = "Không có thiệt hại về người, thiết bị hoặc vật tư.";
        safetyIncident.EstimatedMaterialLoss = 0;
        safetyIncident.EstimatedLaborDays = 0.5m;
        safetyIncident.EstimatedDelayDays = 0;
        safetyIncident.ProposedAction = "Siết lại neo giằng, bổ sung biển cảnh báo và kiểm tra chéo trước khi làm việc.";
        safetyIncident.HandlingInstruction = "Chỉ huy trưởng đã nghiệm thu lại điều kiện an toàn và đóng sự cố.";
        safetyIncident.IsEmergency = false;
        safetyIncident.CreatedAt = new DateTime(2026, 1, 25, 2, 0, 0, DateTimeKind.Utc);
        safetyIncident.UpdatedAt = new DateTime(2026, 1, 26, 2, 0, 0, DateTimeKind.Utc);
        safetyIncident.UpdatedBy = nguyenXien.Leader.UserId;

        var waterproofIncident = await GetOrCreateIncidentAsync(waterproofIncidentMarker, () => new Incident
        {
            ProjectId = nguyenXien.Project.ProjectId,
            ReportedBy = nguyenXien.Leader.UserId,
            CreatedBy = nguyenXien.Leader.UserId,
            Description = waterproofIncidentMarker
        });
        waterproofIncident.PhaseId = phase2.PhaseId;
        waterproofIncident.TaskId = waterproofTask.TaskId;
        waterproofIncident.ReviewedBy = technicalManager.UserId;
        waterproofIncident.IncidentType = "Construction";
        waterproofIncident.Description = $"{waterproofIncidentMarker} khi ngâm thử nước 48 giờ.";
        waterproofIncident.Status = IncidentStatus.Closed;
        waterproofIncident.DamageDescription = "Khoanh vùng và thi công lại 5 m² chống thấm; không ảnh hưởng kết cấu.";
        waterproofIncident.EstimatedMaterialLoss = 2_450_000m;
        waterproofIncident.EstimatedLaborDays = 2;
        waterproofIncident.EstimatedDelayDays = 1;
        waterproofIncident.ProposedAction = "Xử lý lại lớp chống thấm và ngâm thử đủ 48 giờ.";
        waterproofIncident.HandlingInstruction = "Kết quả thử lại đạt, biên bản khắc phục đã được xác nhận và sự cố đã đóng.";
        waterproofIncident.IsEmergency = false;
        waterproofIncident.CreatedAt = new DateTime(2026, 3, 8, 2, 0, 0, DateTimeKind.Utc);
        waterproofIncident.UpdatedAt = new DateTime(2026, 3, 11, 2, 0, 0, DateTimeKind.Utc);
        waterproofIncident.UpdatedBy = technicalManager.UserId;

        var tileIncident = await GetOrCreateIncidentAsync(tileIncidentMarker, () => new Incident
        {
            ProjectId = nguyenXien.Project.ProjectId,
            ReportedBy = nguyenXien.EngineerB.UserId,
            CreatedBy = nguyenXien.EngineerB.UserId,
            Description = tileIncidentMarker
        });
        tileIncident.PhaseId = phase3.PhaseId;
        tileIncident.TaskId = tileInspectionTask.TaskId;
        tileIncident.ReviewedBy = technicalManager.UserId;
        tileIncident.IncidentType = "InventoryDamage";
        tileIncident.Description = $"{tileIncidentMarker}; 6 m² chưa xuất dùng được tách riêng để kiểm tra.";
        tileIncident.Status = IncidentStatus.Closed;
        tileIncident.DamageDescription = "Không phát sinh hao hụt: nhà cung cấp đổi đủ 6 m² gạch đúng lô màu trước khi thi công.";
        tileIncident.EstimatedMaterialLoss = 0;
        tileIncident.EstimatedLaborDays = 0.5m;
        tileIncident.EstimatedDelayDays = 0;
        tileIncident.ProposedAction = "Cách ly lô chênh màu, đối chiếu mẫu duyệt và yêu cầu nhà cung cấp đổi hàng.";
        tileIncident.HandlingInstruction = "Đã nhận đủ hàng thay thế, kiểm tra đồng màu đạt và đóng sự cố.";
        tileIncident.IsEmergency = false;
        tileIncident.CreatedAt = new DateTime(2026, 3, 22, 2, 0, 0, DateTimeKind.Utc);
        tileIncident.UpdatedAt = new DateTime(2026, 3, 24, 2, 0, 0, DateTimeKind.Utc);
        tileIncident.UpdatedBy = technicalManager.UserId;
        await context.SaveChangesAsync();

        // AuditInterceptor luôn gán UpdatedAt = thời điểm chạy seed cho entity Modified.
        // Ghi lại mốc đóng lịch sử sau SaveChanges để dữ liệu demo không mang ngày đóng giả ở hiện tại.
        await context.Incidents
            .Where(incident => incident.IncidentId == safetyIncident.IncidentId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(incident => incident.UpdatedAt, new DateTime(2026, 1, 26, 2, 0, 0, DateTimeKind.Utc))
                .SetProperty(incident => incident.UpdatedBy, nguyenXien.Leader.UserId));
        await context.Incidents
            .Where(incident => incident.IncidentId == waterproofIncident.IncidentId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(incident => incident.UpdatedAt, new DateTime(2026, 3, 11, 2, 0, 0, DateTimeKind.Utc))
                .SetProperty(incident => incident.UpdatedBy, technicalManager.UserId));
        await context.Incidents
            .Where(incident => incident.IncidentId == tileIncident.IncidentId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(incident => incident.UpdatedAt, new DateTime(2026, 3, 24, 2, 0, 0, DateTimeKind.Utc))
                .SetProperty(incident => incident.UpdatedBy, technicalManager.UserId));

        await SeedNguyenXienReturnedSurplusAsync(
            context, nguyenXien, transferTarget, accountant, technicalManager, master, materials);
        await NormalizeNguyenXienCompletedProjectHistoryAsync(
            context, nguyenXien, transferTarget, materials);

        const string moLaoSurplusReason = "Vật tư còn sau bàn giao LK4B Mỗ Lao";
        if (!await context.SurplusRequests.AnyAsync(request =>
                request.ProjectId == moLao.Project.ProjectId &&
                request.Reason != null && request.Reason.StartsWith(moLaoSurplusReason)))
        {
            var surplus = new SurplusRequest
            {
                ProjectId = moLao.Project.ProjectId,
                Reason = $"{moLaoSurplusReason}; phân loại điều chuyển, trả nhà cung cấp, thanh lý và chờ xử lý.",
                Status = SurplusRequestStatus.Processing,
                CreatedAt = new DateTime(2025, 11, 27, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = moLao.Leader.UserId
            };
            context.SurplusRequests.Add(surplus);
            await context.SaveChangesAsync();

            async Task<SurplusRequestItem> AddSurplusItemAsync(
                string materialCode, string unitCode, decimal quantity, decimal processedQuantity, string status)
            {
                var material = materials[materialCode];
                var unit = master.Units[unitCode];
                var conversionRate = await GetConversionRateAsync(context, material, unit);
                var available = await context.CurrentInventories
                    .Where(inv => inv.ProjectId == moLao.Project.ProjectId &&
                                  inv.MaterialId == material.MaterialId &&
                                  inv.UnitId == material.BaseUnitId)
                    .Select(inv => inv.Quantity)
                    .SingleOrDefaultAsync();
                if (available < quantity / conversionRate)
                    throw new InvalidOperationException($"Không đủ tồn {materialCode} để tạo dữ liệu báo cáo Mỗ Lao.");

                var item = new SurplusRequestItem
                {
                    SurplusRequestId = surplus.SurplusRequestId,
                    MaterialId = material.MaterialId,
                    UnitId = unit.UnitId,
                    Quantity = quantity,
                    ProcessedQuantity = processedQuantity,
                    ConversionRate = conversionRate,
                    Status = status,
                    CloseReason = status == SurplusRequestItemStatus.Completed ? "Đã xử lý đủ số lượng." : null,
                    CreatedAt = surplus.CreatedAt,
                    CreatedBy = moLao.Leader.UserId
                };
                context.SurplusRequestItems.Add(item);
                await context.SaveChangesAsync();
                return item;
            }

            var tile = await AddSurplusItemAsync("GACH-POR-600", "M2", 10m, 10m, SurplusRequestItemStatus.Completed);
            var adhesive = await AddSurplusItemAsync("WEBER-ST250", "BAO", 3m, 3m, SurplusRequestItemStatus.Completed);
            var paint = await AddSurplusItemAsync("SON-NOI-18", "THUNG", 1m, 1m, SurplusRequestItemStatus.Completed);
            await AddSurplusItemAsync("XM-VICEM-PCB40", "BAO", 5m, 0m, SurplusRequestItemStatus.Pending);

            var transfer = new SurplusTransfer
            {
                SurplusRequestItemId = tile.SurplusRequestItemId,
                FromProjectId = moLao.Project.ProjectId,
                ToProjectId = transferTarget.Project.ProjectId,
                TransferQuantity = 10m,
                Status = SurplusTransferStatus.Received,
                ApprovedBy = technicalManager.UserId,
                ApprovedAt = new DateTime(2025, 11, 28, 2, 0, 0, DateTimeKind.Utc),
                DispatchedBy = moLao.Leader.UserId,
                DispatchedAt = new DateTime(2025, 11, 29, 2, 0, 0, DateTimeKind.Utc),
                ReceivedBy = transferTarget.Leader.UserId,
                ReceivedAt = new DateTime(2025, 11, 30, 2, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2025, 11, 28, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = moLao.Leader.UserId
            };
            context.SurplusTransfers.Add(transfer);
            await context.SaveChangesAsync();
            await ApplyStockAsync(context, moLao.Project, materials["GACH-POR-600"], -(10m / tile.ConversionRate),
                InventoryTransactionType.TransferOut, transfer.SurplusTransferId, EntityType.SurplusTransferDispatch,
                moLao.Leader.UserId, transfer.DispatchedAt!.Value);
            await ApplyStockAsync(context, transferTarget.Project, materials["GACH-POR-600"], 10m / tile.ConversionRate,
                InventoryTransactionType.TransferIn, transfer.SurplusTransferId, EntityType.SurplusTransferReceive,
                transferTarget.Leader.UserId, transfer.ReceivedAt!.Value);

            var supplierReturn = new SurplusReturnSupplier
            {
                SurplusRequestItemId = adhesive.SurplusRequestItemId,
                SupplierId = master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"].SupplierId,
                ReturnQuantity = 3m,
                RefundAmount = 630_000m,
                Note = "Nhà cung cấp nhận lại 3 bao keo còn nguyên.",
                CreatedAt = new DateTime(2025, 12, 1, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = moLao.Leader.UserId
            };
            context.SurplusReturnSuppliers.Add(supplierReturn);
            await context.SaveChangesAsync();
            await ApplyStockAsync(context, moLao.Project, materials["WEBER-ST250"], -(3m / adhesive.ConversionRate),
                InventoryTransactionType.ReturnToSupplier, supplierReturn.SurplusReturnSupplierId, EntityType.SurplusReturnSupplier,
                moLao.Leader.UserId, supplierReturn.CreatedAt);

            var liquidation = new SurplusLiquidation
            {
                SurplusRequestItemId = paint.SurplusRequestItemId,
                BuyerName = "Tổ hoàn thiện dân dụng Hà Đông",
                LiquidationQuantity = 1m,
                TotalAmount = 1_650_000m,
                CreatedAt = new DateTime(2025, 12, 2, 2, 0, 0, DateTimeKind.Utc),
                CreatedBy = accountant.UserId
            };
            context.SurplusLiquidations.Add(liquidation);
            await context.SaveChangesAsync();
            await ApplyStockAsync(context, moLao.Project, materials["SON-NOI-18"], -(1m / paint.ConversionRate),
                InventoryTransactionType.Liquidation, liquidation.SurplusLiquidationId, EntityType.SurplusLiquidation,
                accountant.UserId, liquidation.CreatedAt);
        }

        foreach (var bundle in new[] { moLao, nguyenXien })
        {
            var projectId = bundle.Project.ProjectId;
            var phaseIds = bundle.Phases.Select(phase => phase.PhaseId).ToList();
            var taskIds = bundle.TasksByPhase.Values.SelectMany(tasks => tasks).Select(task => task.TaskId).ToList();
            var issuanceIds = await context.MaterialIssuances
                .Where(issuance => taskIds.Contains(issuance.TaskId))
                .Select(issuance => issuance.MaterialIssuanceId)
                .ToListAsync();
            var purchaseOrderCount = await context.PurchaseOrders.CountAsync(po => po.ProjectId == projectId);
            var returnCount = await context.MaterialReturns.CountAsync(ret => issuanceIds.Contains(ret.OriginalIssuanceId));
            var incidentCount = await context.Incidents.CountAsync(incident => incident.ProjectId == projectId);
            var surplusCount = await context.SurplusRequests.CountAsync(request => request.ProjectId == projectId);
            var progressLogCount = await context.TaskProgressLogs.CountAsync(log => taskIds.Contains(log.TaskId));
            var dailyLogCount = await context.DailyLogs.CountAsync(log => taskIds.Contains(log.TaskId));
            var boqCount = await context.BOQItems.CountAsync(item => phaseIds.Contains(item.PhaseId));
            var materialRequestCount = await context.MaterialRequests.CountAsync(request => phaseIds.Contains(request.PhaseId));
            var hasFullCoverage = purchaseOrderCount > 0
                && issuanceIds.Count > 0
                && returnCount > 0
                && incidentCount >= 3
                && surplusCount > 0
                && progressLogCount > 0
                && dailyLogCount > 0
                && boqCount > 0;

            if (projectId == nguyenXien.Project.ProjectId)
            {
                var tasks = bundle.TasksByPhase.Values.SelectMany(items => items).ToList();
                var parentTaskIds = tasks
                    .Where(task => task.ParentTaskId.HasValue)
                    .Select(task => task.ParentTaskId!.Value)
                    .ToHashSet();
                var completedLeafIds = tasks
                    .Where(task => !parentTaskIds.Contains(task.TaskId))
                    .Where(task => task.ProgressPercent == 100 &&
                                   task.Status is TaskStatusConstants.Completed or TaskStatusConstants.Approved)
                    .Select(task => task.TaskId)
                    .ToList();
                var leafIdsWithDailyLog = await context.DailyLogs
                    .Where(log => completedLeafIds.Contains(log.TaskId))
                    .Select(log => log.TaskId)
                    .Distinct()
                    .CountAsync();
                var invalidTaskStatusCount = tasks.Count(task =>
                    task.Status != TaskStatusConstants.Approved ||
                    task.ProgressPercent != 100 ||
                    !task.IsLocked);
                var invalidPhaseStatusCount = bundle.Phases.Count(phase => phase.Status != PhaseStatus.Approved);
                var unfinishedMaterialRequestCount = await context.MaterialRequests.CountAsync(request =>
                    phaseIds.Contains(request.PhaseId) && request.Status != MaterialRequestStatus.Approved);
                var unfinishedPurchaseOrderCount = await context.PurchaseOrders.CountAsync(po =>
                    po.ProjectId == projectId &&
                    po.Status != PurchaseOrderStatus.FullyReceived &&
                    po.Status != PurchaseOrderStatus.Closed);
                var unapprovedReceiptCount = await context.GoodsReceipts
                    .Where(receipt => receipt.PurchaseOrder.ProjectId == projectId)
                    .CountAsync(receipt => receipt.Status != GoodsReceiptStatus.Approved);
                var nonZeroInventoryCount = await context.CurrentInventories.CountAsync(inventory =>
                    inventory.ProjectId == projectId && inventory.Quantity != 0);
                var nonClosedIncidentCount = await context.Incidents.CountAsync(incident =>
                    incident.ProjectId == projectId && incident.Status != IncidentStatus.Closed);
                var invalidIncidentTypeCount = await context.Incidents.CountAsync(incident =>
                    incident.ProjectId == projectId &&
                    incident.IncidentType != "Construction" &&
                    incident.IncidentType != "InventoryLoss" &&
                    incident.IncidentType != "InventoryDamage");
                var unfinishedSurplusRequestCount = await context.SurplusRequests.CountAsync(request =>
                    request.ProjectId == projectId && request.Status != SurplusRequestStatus.Processed);
                var unfinishedSurplusItemCount = await context.SurplusRequestItems.CountAsync(item =>
                    item.SurplusRequest.ProjectId == projectId &&
                    (item.Status != SurplusRequestItemStatus.Completed ||
                     item.ProcessedQuantity != item.Quantity));
                var surplusCreatedAfterProjectEndCount = context.SurplusRequests
                    .Where(request => request.ProjectId == projectId)
                    .AsEnumerable()
                    .Count(request => DateOnly.FromDateTime(request.CreatedAt) > bundle.Project.PlannedEnd);

                hasFullCoverage = hasFullCoverage
                    && completedLeafIds.Count > 0
                    && leafIdsWithDailyLog == completedLeafIds.Count
                    && invalidTaskStatusCount == 0
                    && invalidPhaseStatusCount == 0
                    && unfinishedMaterialRequestCount == 0
                    && unfinishedPurchaseOrderCount == 0
                    && unapprovedReceiptCount == 0
                    && nonZeroInventoryCount == 0
                    && nonClosedIncidentCount == 0
                    && invalidIncidentTypeCount == 0
                    && unfinishedSurplusRequestCount == 0
                    && unfinishedSurplusItemCount == 0
                    && surplusCreatedAfterProjectEndCount == 0;

                Console.WriteLine(
                    $"Nguyễn Xiển business invariants: DailyLog {leafIdsWithDailyLog}/{completedLeafIds.Count} việc lá; " +
                    $"Task sai trạng thái {invalidTaskStatusCount}; Phase sai trạng thái {invalidPhaseStatusCount}; " +
                    $"chứng từ chưa hoàn tất {unfinishedMaterialRequestCount + unfinishedPurchaseOrderCount + unapprovedReceiptCount}; " +
                    $"sự cố chưa đóng/khác loại hợp lệ {nonClosedIncidentCount}/{invalidIncidentTypeCount}; " +
                    $"vật tư thừa chưa xử lý/tạo sau hạn {unfinishedSurplusRequestCount + unfinishedSurplusItemCount}/{surplusCreatedAfterProjectEndCount}; " +
                    $"dòng tồn kho khác 0 {nonZeroInventoryCount}.");
            }
            if (!hasFullCoverage)
                throw new InvalidOperationException($"Dữ liệu báo cáo chưa đủ coverage cho dự án {bundle.Project.Name}.");

            Console.WriteLine(
                $"Report seed verified: {bundle.Project.Name} | BOQ {boqCount} | YCVT {materialRequestCount} | PO {purchaseOrderCount} | " +
                $"PXK {issuanceIds.Count} | Hoàn trả {returnCount} | Sự cố {incidentCount} | " +
                $"Vật tư thừa {surplusCount} | DailyLog {dailyLogCount} | Nhật ký tiến độ {progressLogCount}.");
        }
    }

    // -------------------------------------------------------------------------
    // COMPLETED PROJECT SURPLUS: transfer + supplier return + liquidation.
    // -------------------------------------------------------------------------
    private static async Task SeedCompletedProjectSurplusAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var source = projects["Cải tạo nhà phố Nguyễn Xiển – Thanh Xuân"];
        var target = projects["Biệt thự nhà chú Công – khu San Hô, Vinhomes Ocean Park 2"];
        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];
        var tpkt = users["tpkt@bpg.com"];

        // Create historical stock at completed project via a real PO/GR pair.
        var phase = source.Phases[2];
        var request = await CreateMaterialRequestAsync(context, phase, source.Leader, accountant, null,
            MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ,
            "Đợt cấp vật tư hoàn thiện cuối dự án.",
            "Đã đối chiếu định mức trước khi mua.", null,
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 60m, false, (string?)null),
                (materials["GACH-POR-600"], master.Units["M2"], 100m, false, (string?)null),
                (materials["SON-NOI-18"], master.Units["THUNG"], 12m, false, (string?)null)
            }, new DateTime(2026,4,1,2,0,0,DateTimeKind.Utc));
        var po = await CreatePurchaseOrderAsync(context, request, source.Project,
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"], accountant, director,
            PurchaseOrderStatus.FullyReceived, "PO-NGUYEN-XIEN-202604-01", new DateTime(2026,4,2,2,0,0,DateTimeKind.Utc),
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 60m, 220_000m),
                (materials["GACH-POR-600"], master.Units["M2"], 100m, 280_000m),
                (materials["SON-NOI-18"], master.Units["THUNG"], 12m, 2_550_000m)
            }, "Duyệt đợt vật tư hoàn thiện cuối.");
        await CreateGoodsReceiptAsync(context, po, source.Leader, GoodsReceiptStatus.Approved,
            "GR-NGUYEN-XIEN-202604-01", "Nhà cung cấp giao hàng", "BBGH-NX-202604-01",
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 60m),
                (materials["GACH-POR-600"], master.Units["M2"], 100m),
                (materials["SON-NOI-18"], master.Units["THUNG"], 12m)
            }, new DateTime(2026,4,5,2,0,0,DateTimeKind.Utc));

        // Most of the final batch is consumed on site; only the true remaining balance becomes surplus.
        var finishingTask = source.TasksByPhase[phase.PhaseId].First(t => t.ParentTaskId == null);
        var historicalIssuance = new MaterialIssuance
        {
            IssuanceNo = "PXK-NGUYEN-XIEN-20260425-01",
            TaskId = finishingTask.TaskId,
            Purpose = "Xuất vật tư hoàn thiện theo khối lượng thực tế trước khi chốt công trình.",
            CreatedAt = new DateTime(2026,4,25,2,0,0,DateTimeKind.Utc),
            CreatedBy = source.Leader.UserId
        };
        context.MaterialIssuances.Add(historicalIssuance);
        await context.SaveChangesAsync();
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["WEBER-ST250"], master.Units["BAO"], 55m, source.Leader.UserId, historicalIssuance.CreatedAt);
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["GACH-POR-600"], master.Units["M2"], 90m, source.Leader.UserId, historicalIssuance.CreatedAt);
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["SON-NOI-18"], master.Units["THUNG"], 11m, source.Leader.UserId, historicalIssuance.CreatedAt);

        var surplus = new SurplusRequest
        {
            ProjectId = source.Project.ProjectId,
            Reason = "Đối soát vật tư trước nghiệm thu bàn giao; toàn bộ phần dư được điều chuyển, trả NCC hoặc thanh lý trước khi đóng dự án.",
            Status = SurplusRequestStatus.Processed,
            CreatedAt = new DateTime(2026,5,15,2,0,0,DateTimeKind.Utc),
            CreatedBy = source.Leader.UserId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        async Task<SurplusRequestItem> AddItem(string matCode, string unitCode, decimal qty)
        {
            var mat = materials[matCode];
            var unit = master.Units[unitCode];
            var item = new SurplusRequestItem
            {
                SurplusRequestId = surplus.SurplusRequestId,
                MaterialId = mat.MaterialId,
                UnitId = unit.UnitId,
                Quantity = qty,
                ProcessedQuantity = qty,
                ConversionRate = await GetConversionRateAsync(context, mat, unit),
                Status = SurplusRequestItemStatus.Completed,
                CloseReason = "Đã xử lý đủ số lượng đề xuất.",
                CreatedAt = surplus.CreatedAt,
                CreatedBy = source.Leader.UserId
            };
            context.SurplusRequestItems.Add(item);
            await context.SaveChangesAsync();
            return item;
        }

        var tileItem = await AddItem("GACH-POR-600", "M2", 10m);
        var adhesiveItem = await AddItem("WEBER-ST250", "BAO", 5m);
        var paintItem = await AddItem("SON-NOI-18", "THUNG", 1m);

        var transfer = new SurplusTransfer
        {
            SurplusRequestItemId = tileItem.SurplusRequestItemId,
            FromProjectId = source.Project.ProjectId,
            ToProjectId = target.Project.ProjectId,
            TransferQuantity = 10m,
            Status = SurplusTransferStatus.Received,
            ApprovedBy = tpkt.UserId,
            ApprovedAt = new DateTime(2026,5,16,2,0,0,DateTimeKind.Utc),
            DispatchedBy = source.Leader.UserId,
            DispatchedAt = new DateTime(2026,5,17,2,0,0,DateTimeKind.Utc),
            ReceivedBy = target.Leader.UserId,
            ReceivedAt = new DateTime(2026,5,18,2,0,0,DateTimeKind.Utc),
            CreatedAt = surplus.CreatedAt,
            CreatedBy = source.Leader.UserId
        };
        context.SurplusTransfers.Add(transfer);
        await context.SaveChangesAsync();
        var tileRate = tileItem.ConversionRate;
        var tileBase = transfer.TransferQuantity / tileRate;
        await ApplyStockAsync(context, source.Project, materials["GACH-POR-600"], -tileBase,
            InventoryTransactionType.TransferOut, transfer.SurplusTransferId, EntityType.SurplusTransferDispatch,
            source.Leader.UserId, transfer.DispatchedAt!.Value);
        await ApplyStockAsync(context, target.Project, materials["GACH-POR-600"], tileBase,
            InventoryTransactionType.TransferIn, transfer.SurplusTransferId, EntityType.SurplusTransferReceive,
            target.Leader.UserId, transfer.ReceivedAt!.Value);

        var returnSupplier = new SurplusReturnSupplier
        {
            SurplusRequestItemId = adhesiveItem.SurplusRequestItemId,
            SupplierId = master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"].SupplierId,
            ReturnQuantity = 5m,
            RefundAmount = 1_050_000m,
            Note = "NCC nhận lại 5 bao keo còn nguyên, hoàn tiền theo thỏa thuận.",
            CreatedAt = new DateTime(2026,5,19,2,0,0,DateTimeKind.Utc),
            CreatedBy = source.Leader.UserId
        };
        context.SurplusReturnSuppliers.Add(returnSupplier);
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, source.Project, materials["WEBER-ST250"], -(5m / adhesiveItem.ConversionRate),
            InventoryTransactionType.ReturnToSupplier, returnSupplier.SurplusReturnSupplierId, EntityType.SurplusReturnSupplier,
            source.Leader.UserId, returnSupplier.CreatedAt);

        var liquidation = new SurplusLiquidation
        {
            SurplusRequestItemId = paintItem.SurplusRequestItemId,
            BuyerName = "Đội hoàn thiện dân dụng địa phương",
            LiquidationQuantity = 1m,
            TotalAmount = 1_600_000m,
            CreatedAt = new DateTime(2026,5,20,2,0,0,DateTimeKind.Utc),
            CreatedBy = accountant.UserId
        };
        context.SurplusLiquidations.Add(liquidation);
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, source.Project, materials["SON-NOI-18"], -(1m / paintItem.ConversionRate),
            InventoryTransactionType.Liquidation, liquidation.SurplusLiquidationId, EntityType.SurplusLiquidation,
            accountant.UserId, liquidation.CreatedAt);

        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.SurplusRequest,
            EntityId = surplus.SurplusRequestId,
            AttachmentType = AttachmentType.SurplusEvidence,
            FileName = "anh-minh-hoa-xu-ly-vat-tu-thua-nguyen-xien.jpg",
            FileUrl = SeedImageDelivery,
            ContentType = "image/jpeg",
            FileSizeBytes = 420_000,
            CreatedAt = surplus.CreatedAt,
            CreatedBy = source.Leader.UserId
        });
        await context.SaveChangesAsync();
    }

    // -------------------------------------------------------------------------
    // CHUẨN HÓA, COVERAGE VÀ INVARIANT CHO SEED YÊU CẦU VẬT TƯ
    // BOQ là đầu vào bất biến. Seeder chỉ tính lại trạng thái từ dữ liệu hiện có
    // và fail ngay khi một chứng từ không còn nằm trong chuỗi nghiệp vụ hợp lệ.
    // -------------------------------------------------------------------------
    private static async Task NormalizeAndValidateMaterialRequestSeedAsync(AppDbContext context)
    {
        var requests = await context.MaterialRequests
            .Include(request => request.Items)
            .OrderBy(request => request.CreatedAt)
            .ThenBy(request => request.RequestId)
            .ToListAsync();
        var boqByPhaseAndMaterial = await context.BOQItems
            .Where(item => !item.IsDeleted)
            .ToDictionaryAsync(item => (item.PhaseId, item.MaterialId));
        var usedByPhaseAndMaterial = new Dictionary<(long PhaseId, long MaterialId), decimal>();

        foreach (var request in requests)
        {
            if (request.Status is MaterialRequestStatus.Approved or MaterialRequestStatus.WaitingApproval)
                request.ProcurementDecision = MaterialRequestProcurementDecision.ExternalPurchase;

            if (request.Status == MaterialRequestStatus.Approved && request.ApprovedBy == null)
            {
                request.ApprovedBy = request.CheckedBy
                    ?? throw new InvalidOperationException(
                        $"Seed MR-{request.RequestId} đã duyệt nhưng không có người thẩm định/phê duyệt.");
            }

            var countsTowardBoq = request.Status != MaterialRequestStatus.Cancelled &&
                (request.Status != MaterialRequestStatus.Rejected ||
                 request.ProcurementDecision == MaterialRequestProcurementDecision.InternalTransfer);
            var reservations = new List<((long PhaseId, long MaterialId) Key, decimal Quantity)>();
            var anyOver = false;

            foreach (var item in request.Items)
            {
                var key = (request.PhaseId, item.MaterialId);
                if (!boqByPhaseAndMaterial.TryGetValue(key, out var boq))
                {
                    throw new InvalidOperationException(
                        $"Seed MR-{request.RequestId} chứa material {item.MaterialId} không thuộc BOQ của phase {request.PhaseId}.");
                }

                var itemRate = item.ConversionRate > 0 ? item.ConversionRate : 1m;
                var boqRate = boq.ConversionRate > 0 ? boq.ConversionRate : 1m;
                var quantityInBase = item.Quantity / itemRate;
                var limitInBase = boq.Quantity / boqRate;
                usedByPhaseAndMaterial.TryGetValue(key, out var usedBefore);
                var isOver = usedBefore + quantityInBase > limitInBase;

                item.IsOverBOQ = isOver;
                item.Explanation = isOver
                    ? item.Explanation ?? "Yêu cầu vượt quá hạn mức định mức BOQ của Phase."
                    : null;
                anyOver |= isOver;

                if (countsTowardBoq)
                    reservations.Add((key, quantityInBase));
            }

            request.BOQCheckStatus = anyOver ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
            foreach (var reservation in reservations)
            {
                usedByPhaseAndMaterial.TryGetValue(reservation.Key, out var current);
                usedByPhaseAndMaterial[reservation.Key] = current + reservation.Quantity;
            }
        }

        await context.SaveChangesAsync();

        foreach (var request in requests)
        {
            if (request.Items.Any(item => item.IsOverBOQ) !=
                (request.BOQCheckStatus == BOQCheckStatus.OverBOQ))
            {
                throw new InvalidOperationException(
                    $"Seed MR-{request.RequestId} lệch trạng thái BOQ giữa phiếu và dòng vật tư.");
            }

            if (request.Status == MaterialRequestStatus.WaitingApproval &&
                request.BOQCheckStatus != BOQCheckStatus.OverBOQ)
            {
                throw new InvalidOperationException(
                    $"Seed MR-{request.RequestId} chờ Giám đốc nhưng không vượt BOQ.");
            }

            if (request.Status is MaterialRequestStatus.Approved or MaterialRequestStatus.WaitingApproval &&
                request.ProcurementDecision != MaterialRequestProcurementDecision.ExternalPurchase)
            {
                throw new InvalidOperationException(
                    $"Seed MR-{request.RequestId} đi theo luồng mua ngoài nhưng thiếu phương án xử lý.");
            }

            if (request.Status == MaterialRequestStatus.Rejected &&
                !MaterialRequestProcurementDecision.IsValid(request.ProcurementDecision))
            {
                throw new InvalidOperationException(
                    $"Seed MR-{request.RequestId} đã xử lý nhưng thiếu phương án xử lý hợp lệ.");
            }
        }

        await ValidateMaterialRequestDocumentLinksAsync(context);
        await ValidateInventoryAndSurplusAsync(context);
        await ValidateMaterialRequestAssessmentCoverageAsync(context);
        await ValidateMaterialRequestStateCoverageAsync(context);
    }

    private static async Task ValidateMaterialRequestDocumentLinksAsync(AppDbContext context)
    {
        static decimal ToBase(decimal quantity, decimal rate) =>
            quantity / (rate > 0 ? rate : 1m);

        var purchaseOrders = await context.PurchaseOrders
            .Where(po => po.RequestId != null)
            .Include(po => po.Items)
            .Include(po => po.Request!)
                .ThenInclude(request => request.Items)
            .Include(po => po.Request!)
                .ThenInclude(request => request.Phase)
            .AsSplitQuery()
            .ToListAsync();

        foreach (var po in purchaseOrders)
        {
            var request = po.Request
                ?? throw new InvalidOperationException($"PO {po.PONumber} thiếu YCVT tham chiếu.");
            if (po.ProjectId != request.Phase.ProjectId)
            {
                throw new InvalidOperationException(
                    $"PO {po.PONumber} lệch dự án so với MR-{request.RequestId}.");
            }

            if (request.Status != MaterialRequestStatus.Approved ||
                request.ProcurementDecision != MaterialRequestProcurementDecision.ExternalPurchase)
            {
                throw new InvalidOperationException(
                    $"PO {po.PONumber} chỉ được liên kết YCVT đã duyệt theo phương án mua ngoài.");
            }

            var requestedByMaterial = request.Items
                .GroupBy(item => item.MaterialId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(item => ToBase(item.Quantity, item.ConversionRate)));
            foreach (var ordered in po.Items.GroupBy(item => item.MaterialId))
            {
                if (!requestedByMaterial.TryGetValue(ordered.Key, out var requestedBase))
                {
                    throw new InvalidOperationException(
                        $"PO {po.PONumber} có material {ordered.Key} không thuộc MR-{request.RequestId}.");
                }

                var orderedBase = ordered.Sum(item => ToBase(item.Quantity, item.ConversionRate));
                if (orderedBase > requestedBase)
                {
                    throw new InvalidOperationException(
                        $"PO {po.PONumber} đặt material {ordered.Key} vượt số lượng MR-{request.RequestId}.");
                }
            }
        }

        var receipts = await context.GoodsReceipts
            .Where(receipt => receipt.Status == GoodsReceiptStatus.Approved)
            .Include(receipt => receipt.Items)
            .Include(receipt => receipt.PurchaseOrder)
                .ThenInclude(po => po.Items)
            .AsSplitQuery()
            .ToListAsync();
        foreach (var poGroup in receipts.GroupBy(receipt => receipt.POId))
        {
            var po = poGroup.First().PurchaseOrder;
            var orderedByMaterial = po.Items
                .GroupBy(item => item.MaterialId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(item => ToBase(item.Quantity, item.ConversionRate)));
            foreach (var received in poGroup.SelectMany(receipt => receipt.Items).GroupBy(item => item.MaterialId))
            {
                if (!orderedByMaterial.TryGetValue(received.Key, out var orderedBase))
                {
                    throw new InvalidOperationException(
                        $"GR của PO {po.PONumber} có material {received.Key} không thuộc đơn hàng.");
                }

                var receivedBase = received.Sum(item => ToBase(item.Quantity, item.ConversionRate));
                if (receivedBase > orderedBase)
                {
                    throw new InvalidOperationException(
                        $"GR của PO {po.PONumber} nhận material {received.Key} vượt số lượng đã đặt.");
                }
            }
        }
    }

    private static async Task ValidateInventoryAndSurplusAsync(AppDbContext context)
    {
        var invalidSurplusProjects = await context.SurplusRequests
            .Where(request => request.Project.Status != ProjectStatus.InProgress)
            .Select(request => $"surplus {request.SurplusRequestId} / project {request.ProjectId} ({request.Project.Status})")
            .ToListAsync();
        if (invalidSurplusProjects.Count > 0)
        {
            throw new InvalidOperationException(
                $"Seed chỉ được tạo surplus cho dự án InProgress: {string.Join("; ", invalidSurplusProjects)}.");
        }

        var inventoryByKey = await context.CurrentInventories
            .ToDictionaryAsync(
                inventory => (inventory.ProjectId, inventory.MaterialId),
                inventory => new
                {
                    inventory.Quantity,
                    inventory.ReservedQuantity
                });
        var ledgerByKey = await context.InventoryTransactions
            .GroupBy(transaction => new { transaction.ProjectId, transaction.MaterialId })
            .Select(group => new
            {
                group.Key.ProjectId,
                group.Key.MaterialId,
                Quantity = group.Sum(transaction => transaction.QuantityChange)
            })
            .ToDictionaryAsync(
                entry => (entry.ProjectId, entry.MaterialId),
                entry => entry.Quantity);

        foreach (var inventory in inventoryByKey)
        {
            ledgerByKey.TryGetValue(inventory.Key, out var ledgerQuantity);
            if (inventory.Value.Quantity != ledgerQuantity)
            {
                throw new InvalidOperationException(
                    $"Tồn seed lệch ledger tại project {inventory.Key.ProjectId}, material {inventory.Key.MaterialId}: tồn {inventory.Value.Quantity}, ledger {ledgerQuantity}.");
            }
        }

        if (ledgerByKey.Keys.Except(inventoryByKey.Keys).Any())
            throw new InvalidOperationException("Ledger seed có vật tư không tồn tại trong CurrentInventory.");

        var activeSources = await context.SurplusRequestItems
            .Where(item =>
                item.SurplusRequest.Status == SurplusRequestStatus.Processing &&
                (item.Status == SurplusRequestItemStatus.Pending ||
                 item.Status == SurplusRequestItemStatus.Processing))
            .Include(item => item.SurplusRequest)
            .Include(item => item.Transfers)
            .ToListAsync();
        foreach (var source in activeSources)
        {
            inventoryByKey.TryGetValue(
                (source.SurplusRequest.ProjectId, source.MaterialId),
                out var inventory);
            var committed = source.Transfers
                .Where(transfer => transfer.Status != SurplusTransferStatus.Rejected &&
                    transfer.Status != SurplusTransferStatus.Received)
                .Sum(transfer => transfer.TransferQuantity);
            var sourceBase = Math.Max(0, source.Quantity - source.ProcessedQuantity - committed) /
                (source.ConversionRate > 0 ? source.ConversionRate : 1m);
            if (sourceBase <= 0 || inventory == null || sourceBase != inventory.Quantity ||
                inventory.ReservedQuantity != inventory.Quantity)
            {
                throw new InvalidOperationException(
                    $"Nguồn nội bộ seed không mô phỏng đúng lúc tạo surplus tại project {source.SurplusRequest.ProjectId}, material {source.MaterialId}: " +
                    $"nguồn {sourceBase}, tồn {inventory?.Quantity ?? 0}, tạm khóa {inventory?.ReservedQuantity ?? 0}.");
            }
        }

        var activeProjectIds = activeSources
            .Select(source => source.SurplusRequest.ProjectId)
            .Distinct()
            .ToHashSet();
        var activeSourceKeys = activeSources
            .Select(source => (source.SurplusRequest.ProjectId, source.MaterialId))
            .ToHashSet();
        var unlockedInventory = inventoryByKey
            .Where(entry =>
                activeProjectIds.Contains(entry.Key.ProjectId) &&
                entry.Value.Quantity > 0 &&
                !activeSourceKeys.Contains(entry.Key))
            .Select(entry => $"project {entry.Key.ProjectId}, material {entry.Key.MaterialId}")
            .ToList();
        if (unlockedInventory.Count > 0)
        {
            throw new InvalidOperationException(
                $"Surplus Processing không bao phủ toàn bộ tồn dương như runtime: {string.Join("; ", unlockedInventory)}.");
        }
    }

    private static async Task ValidateMaterialRequestAssessmentCoverageAsync(AppDbContext context)
    {
        var targetRequest = await context.MaterialRequests
            .Include(request => request.Items)
            .Include(request => request.Phase)
            .SingleOrDefaultAsync(request =>
                request.Status == MaterialRequestStatus.Pending &&
                request.Reason.StartsWith("Yêu cầu vật tư hoàn thiện đợt tiếp theo"))
            ?? throw new InvalidOperationException("Thiếu YCVT Pending mục tiêu để kiểm tra coverage thẩm định.");

        var materialIds = targetRequest.Items.Select(item => item.MaterialId).Distinct().ToList();
        if (materialIds.Count != 4)
            throw new InvalidOperationException($"YCVT demo cần đúng 4 vật tư, hiện có {materialIds.Count}.");

        var projectId = targetRequest.Phase.ProjectId;
        var inventoryIds = (await context.CurrentInventories
                .Where(inventory => inventory.ProjectId == projectId &&
                    materialIds.Contains(inventory.MaterialId) &&
                    inventory.Quantity > 0)
                .Select(inventory => inventory.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        var activeSupplyIds = (await context.PurchaseOrderItems
                .Where(item => item.PurchaseOrder.ProjectId == projectId &&
                    materialIds.Contains(item.MaterialId) &&
                    (item.PurchaseOrder.Status == PurchaseOrderStatus.Sent ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived))
                .Select(item => item.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        var internalSourceIds = (await context.SurplusRequestItems
                .Where(item => materialIds.Contains(item.MaterialId) &&
                    item.SurplusRequest.ProjectId != projectId &&
                    item.SurplusRequest.Project.Status == ProjectStatus.InProgress &&
                    item.SurplusRequest.Status == SurplusRequestStatus.Processing &&
                    (item.Status == SurplusRequestItemStatus.Pending ||
                     item.Status == SurplusRequestItemStatus.Processing))
                .Select(item => item.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        var priceIds = (await context.PurchaseOrderItems
                .Where(item => materialIds.Contains(item.MaterialId) &&
                    item.UnitPrice > 0 &&
                    (item.PurchaseOrder.Status == PurchaseOrderStatus.Sent ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.FullyReceived ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.Closed))
                .Select(item => item.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        decimal Ratio(HashSet<long> ids) => ids.Count / (decimal)materialIds.Count;
        var anyContext = materialIds.Count(materialId =>
            inventoryIds.Contains(materialId) ||
            activeSupplyIds.Contains(materialId) ||
            internalSourceIds.Contains(materialId));
        var twoContexts = materialIds.Count(materialId =>
            (inventoryIds.Contains(materialId) ? 1 : 0) +
            (activeSupplyIds.Contains(materialId) ? 1 : 0) +
            (internalSourceIds.Contains(materialId) ? 1 : 0) >= 2);

        var failures = new List<string>();
        if (Ratio(priceIds) < 0.90m) failures.Add($"giá {Ratio(priceIds):P0} < 90%");
        if (Ratio(inventoryIds) < 0.25m) failures.Add($"tồn dự án {Ratio(inventoryIds):P0} < 25%");
        if (Ratio(activeSupplyIds) < 0.25m) failures.Add($"đang cung ứng {Ratio(activeSupplyIds):P0} < 25%");
        if (Ratio(internalSourceIds) < 0.50m) failures.Add($"nguồn nội bộ {Ratio(internalSourceIds):P0} < 50%");
        if (anyContext / (decimal)materialIds.Count < 0.75m) failures.Add("dòng có ít nhất một cơ sở < 75%");
        if (twoContexts / (decimal)materialIds.Count < 0.50m) failures.Add("dòng có ít nhất hai cơ sở < 50%");

        if (failures.Count > 0)
        {
            throw new InvalidOperationException(
                $"Coverage thẩm định YCVT demo không đạt: {string.Join("; ", failures)}.");
        }

        var demoCodes = new[]
        {
            "XM-VICEM-PCB40",
            "BT-TUOI-M250",
            "THEP-HP-D16",
            "CAT-XAY-TO",
            "DA-1X2",
            "GACH-2LO-220"
        };
        var demoMaterials = await context.MaterialCatalogs
            .Where(material => demoCodes.Contains(material.Code))
            .ToDictionaryAsync(material => material.Code, material => material.MaterialId);
        if (demoMaterials.Count != demoCodes.Length)
            throw new InvalidOperationException("Thiếu vật tư trong bộ 6 mã demo coverage.");

        var requiredDemoIds = demoCodes
            .Where(code => code != "DA-1X2")
            .Select(code => demoMaterials[code])
            .ToHashSet();
        var demoInternalSourceIds = (await context.SurplusRequestItems
                .Where(item =>
                    requiredDemoIds.Contains(item.MaterialId) &&
                    item.SurplusRequest.Project.Status == ProjectStatus.InProgress &&
                    item.SurplusRequest.Status == SurplusRequestStatus.Processing &&
                    (item.Status == SurplusRequestItemStatus.Pending ||
                     item.Status == SurplusRequestItemStatus.Processing))
                .Select(item => item.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();
        var demoPriceIds = (await context.PurchaseOrderItems
                .Where(item =>
                    requiredDemoIds.Contains(item.MaterialId) &&
                    item.UnitPrice > 0 &&
                    (item.PurchaseOrder.Status == PurchaseOrderStatus.Sent ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.PartiallyReceived ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.FullyReceived ||
                     item.PurchaseOrder.Status == PurchaseOrderStatus.Closed))
                .Select(item => item.MaterialId)
                .Distinct()
                .ToListAsync())
            .ToHashSet();
        var missingInternalSources = requiredDemoIds.Except(demoInternalSourceIds).Count();
        var missingPrices = requiredDemoIds.Except(demoPriceIds).Count();
        if (missingInternalSources > 0 || missingPrices > 0)
        {
            throw new InvalidOperationException(
                $"Coverage 5/6 vật tư demo không đạt: thiếu nguồn nội bộ {missingInternalSources}, thiếu giá gần nhất {missingPrices}.");
        }
    }

    private static async Task ValidateMaterialRequestStateCoverageAsync(AppDbContext context)
    {
        var requests = await context.MaterialRequests
            .AsNoTracking()
            .Include(request => request.Phase)
            .ToListAsync();
        var requiredStatuses = new[]
        {
            MaterialRequestStatus.Pending,
            MaterialRequestStatus.WaitingApproval,
            MaterialRequestStatus.Approved,
            MaterialRequestStatus.Rejected,
            MaterialRequestStatus.Cancelled
        };
        var missingStatuses = requiredStatuses
            .Where(status => requests.All(request => request.Status != status))
            .ToList();
        var requiredRejectedDecisions = new[]
        {
            MaterialRequestProcurementDecision.InternalTransfer,
            MaterialRequestProcurementDecision.WaitSupply,
            MaterialRequestProcurementDecision.NeedMoreInfo,
            MaterialRequestProcurementDecision.NotApproved
        };
        var missingDecisions = requiredRejectedDecisions
            .Where(decision => requests.All(request =>
                request.Status != MaterialRequestStatus.Rejected ||
                request.ProcurementDecision != decision))
            .ToList();

        var hasPendingWithin = requests.Any(request =>
            request.Status == MaterialRequestStatus.Pending &&
            request.BOQCheckStatus == BOQCheckStatus.WithinBOQ);
        var hasPendingOver = requests.Any(request =>
            request.Status == MaterialRequestStatus.Pending &&
            request.BOQCheckStatus == BOQCheckStatus.OverBOQ);
        var hasApprovedWithin = requests.Any(request =>
            request.Status == MaterialRequestStatus.Approved &&
            request.BOQCheckStatus == BOQCheckStatus.WithinBOQ);
        var hasApprovedOver = requests.Any(request =>
            request.Status == MaterialRequestStatus.Approved &&
            request.BOQCheckStatus == BOQCheckStatus.OverBOQ);

        var failures = new List<string>();
        if (missingStatuses.Count > 0)
            failures.Add($"thiếu status {string.Join(", ", missingStatuses)}");
        if (missingDecisions.Count > 0)
            failures.Add($"thiếu phương án {string.Join(", ", missingDecisions)}");
        if (!hasPendingWithin) failures.Add("thiếu Pending trong BOQ");
        if (!hasPendingOver) failures.Add("thiếu Pending vượt BOQ");
        if (!hasApprovedWithin) failures.Add("thiếu Approved trong BOQ");
        if (!hasApprovedOver) failures.Add("thiếu Approved vượt BOQ");
        var hasDiverseProject = requests
            .GroupBy(request => request.Phase.ProjectId)
            .Any(projectRequests => requiredStatuses.All(status =>
                projectRequests.Any(request => request.Status == status)));
        if (!hasDiverseProject)
            failures.Add("không có dự án nào hiển thị đủ năm trạng thái YCVT runtime");

        if (failures.Count > 0)
        {
            throw new InvalidOperationException(
                $"Coverage trạng thái YCVT seed không đạt: {string.Join("; ", failures)}.");
        }
    }

    // -------------------------------------------------------------------------
    // NOTIFICATIONS
    // -------------------------------------------------------------------------
    private static async Task SeedNotificationsAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users)
    {
        var main = projects[MainProjectName].Project;
        var pendingMr = await context.MaterialRequests
            .Where(x => x.Status == MaterialRequestStatus.WaitingApproval)
            .OrderByDescending(x => x.CreatedAt)
            .FirstAsync();
        var pendingPo = await context.PurchaseOrders
            .Where(x => x.Status == PurchaseOrderStatus.PendingApproval)
            .OrderByDescending(x => x.OrderDate)
            .FirstAsync();
        var pendingAdjustment = await context.InventoryAdjustments
            .Where(x => x.Status == InventoryAdjustmentStatus.Pending)
            .OrderByDescending(x => x.CreatedAt)
            .FirstAsync();

        context.Notifications.AddRange(
            new Notification
            {
                UserId = users["giamdoc@bpg.com"].UserId,
                Title = "Yêu cầu vượt BOQ chờ phê duyệt",
                Content = $"Dự án {main.Name} có yêu cầu vật tư vượt BOQ đã được Kế toán rà soát và trình duyệt.",
                NotificationType = NotificationType.Procurement,
                ReferenceType = NotificationReferenceType.MaterialRequest,
                ReferenceId = pendingMr.RequestId,
                IsRead = false,
                CreatedAt = SeedUtc.AddHours(-3)
            },
            new Notification
            {
                UserId = users["giamdoc@bpg.com"].UserId,
                Title = "PO chờ Giám đốc duyệt",
                Content = $"Đơn mua hàng {pendingPo.PONumber} đã được Kế toán lập, chờ duyệt trước khi gửi nhà cung cấp.",
                NotificationType = NotificationType.Procurement,
                ReferenceType = NotificationReferenceType.PurchaseOrder,
                ReferenceId = pendingPo.POId,
                IsRead = false,
                CreatedAt = SeedUtc.AddHours(-2)
            },
            new Notification
            {
                UserId = users["tpkt@bpg.com"].UserId,
                Title = "Phiếu tăng tồn chờ duyệt",
                Content = "Phiếu điều chỉnh tăng tồn từ kết quả kiểm kê thực tế đang chờ xem xét.",
                NotificationType = NotificationType.System,
                ReferenceType = NotificationReferenceType.InventoryAdjustment,
                ReferenceId = pendingAdjustment.AdjustmentId,
                IsRead = false,
                CreatedAt = SeedUtc.AddHours(-1)
            }
        );
        await context.SaveChangesAsync();
    }

    // -------------------------------------------------------------------------
    // STOCK / CONVERSION HELPERS
    // -------------------------------------------------------------------------
    private static async Task<decimal> GetConversionRateAsync(
        AppDbContext context, MaterialCatalog material, Unit unit)
    {
        if (material.BaseUnitId == unit.UnitId) return 1m;
        var rate = await context.MaterialConversions
            .Where(x => x.MaterialId == material.MaterialId && x.AlternativeUnitId == unit.UnitId)
            .Select(x => (decimal?)x.ConversionRate)
            .FirstOrDefaultAsync();
        if (!rate.HasValue || rate.Value <= 0)
            throw new InvalidOperationException($"Thiếu conversion cho {material.Code} -> {unit.UnitCode}.");
        return rate.Value;
    }

    private static async Task ApplyStockAsync(
        AppDbContext context,
        Project project,
        MaterialCatalog material,
        decimal baseQuantityChange,
        byte transactionType,
        long referenceId,
        string referenceType,
        long actorId,
        DateTime at)
    {
        var inv = await context.CurrentInventories.FirstOrDefaultAsync(x =>
            x.ProjectId == project.ProjectId &&
            x.MaterialId == material.MaterialId &&
            x.UnitId == material.BaseUnitId);

        if (inv == null)
        {
            if (baseQuantityChange < 0)
                throw new InvalidOperationException($"Không thể giảm tồn {material.Code}: chưa có tồn đầu vào tại dự án {project.Name}.");

            inv = new CurrentInventory
            {
                ProjectId = project.ProjectId,
                MaterialId = material.MaterialId,
                UnitId = material.BaseUnitId,
                Quantity = 0,
                ReservedQuantity = 0,
                LastUpdated = at
            };
            context.CurrentInventories.Add(inv);
            await context.SaveChangesAsync();
        }

        var newBalance = inv.Quantity + baseQuantityChange;
        if (newBalance < 0)
            throw new InvalidOperationException($"Seed làm âm tồn {material.Code} tại {project.Name}: {inv.Quantity} + {baseQuantityChange}.");

        inv.Quantity = newBalance;
        if (inv.ReservedQuantity > inv.Quantity) inv.ReservedQuantity = inv.Quantity;
        inv.LastUpdated = at;
        await context.SaveChangesAsync();

        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProjectId = project.ProjectId,
            MaterialId = material.MaterialId,
            TransactionType = transactionType,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            QuantityChange = baseQuantityChange,
            BalanceAfter = inv.Quantity,
            CreatedBy = actorId,
            CreatedAt = at
        });
        await context.SaveChangesAsync();
    }
}
