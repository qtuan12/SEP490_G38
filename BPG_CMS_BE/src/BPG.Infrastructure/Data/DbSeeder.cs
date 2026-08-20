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
                && await context.Units.AnyAsync(u => u.UnitCode == "VIEN" && u.UnitName == "Viên");

            if (hasCurrentSeed)
                return;

            throw new InvalidOperationException(
                "Database đang chứa seed cũ. Hãy drop/reset database rồi chạy migration + seed lại để tránh trộn dữ liệu demo cũ và mới.");
        }

        var users = await SeedAuthAsync(context);
        var adminId = users["admin@bpg.com"].UserId;

        var master = await SeedMasterDataAsync(context, adminId);
        var materials = await SeedMaterialsAsync(context, master, adminId);
        var projects = await SeedProjectsWbsAndBoqAsync(context, users, master, materials);

        await SeedMainDemoLifecycleAsync(context, projects, users, master, materials);
        await SeedSecondaryInventorySnapshotsAsync(context, projects, users, master, materials);
        await SeedCompletedProjectSurplusAsync(context, projects, users, master, materials);
        await SeedNotificationsAsync(context, projects, users);
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
            new() { UnitCode = "KG",     UnitName = "Kilôgam",   IsDiscrete = false },
            new() { UnitCode = "TAN",    UnitName = "Tấn",       IsDiscrete = false },
            new() { UnitCode = "BAO",    UnitName = "Bao",       IsDiscrete = true  },
            new() { UnitCode = "M3",     UnitName = "Mét khối",  IsDiscrete = false },
            new() { UnitCode = "M2",     UnitName = "Mét vuông", IsDiscrete = false },
            new() { UnitCode = "MET",    UnitName = "Mét",       IsDiscrete = false },
            new() { UnitCode = "LIT",    UnitName = "Lít",       IsDiscrete = false },
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
            new() { CategoryName = "Bê tông thương phẩm", Description = "Bê tông tươi theo cấp độ bền/mác, quản lý khối lượng theo mét khối." },
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
            new() { SupplierName = "Xi măng VICEM Bỉm Sơn", ContactInfo = "Bộ phận kinh doanh miền Bắc", Address = "Bỉm Sơn, Thanh Hóa", ServiceArea = "Hà Nội và miền Bắc", Rating = 4.7m, EvaluationNote = "Cấp xi măng bao và lô xi măng khối lượng lớn; chứng từ lô hàng rõ ràng.", CollaborationStatus = "Active" },
            new() { SupplierName = "Thép Hòa Phát - khu vực miền Bắc", ContactInfo = "Bộ phận kinh doanh thép xây dựng", Address = "Hưng Yên", ServiceArea = "Hà Nội, Hưng Yên và lân cận", Rating = 4.8m, EvaluationNote = "Thép cuộn và thép thanh vằn nhiều đường kính; giao theo bó/cây và đối chiếu khối lượng.", CollaborationStatus = "Active" },
            new() { SupplierName = "Đơn vị bê tông thương phẩm Hưng Yên", ContactInfo = "Điều phối trạm trộn - xe bồn", Address = "Văn Giang, Hưng Yên", ServiceArea = "Văn Giang và khu vực phía Đông Hà Nội", Rating = 4.6m, EvaluationNote = "Điều phối bê tông M100-M350 theo mét khối, có phiếu giao từng xe.", CollaborationStatus = "Active" },
            new() { SupplierName = "Đại lý VLXD Minh Phát Hà Đông", ContactInfo = "Kho vật liệu xây dựng", Address = "Hà Đông, Hà Nội", ServiceArea = "Hà Đông, Thanh Xuân, Nam Từ Liêm", Rating = 4.4m, EvaluationNote = "Cát, đá, gạch, xi măng và vật tư phụ; phù hợp giao nhiều đợt.", CollaborationStatus = "Active" },
            new() { SupplierName = "Saint-Gobain Việt Nam - Weber", ContactInfo = "Kênh phân phối vật liệu hoàn thiện", Address = "Hà Nội", ServiceArea = "Toàn quốc", Rating = 4.6m, EvaluationNote = "Keo dán gạch và vật liệu hoàn thiện có tài liệu kỹ thuật.", CollaborationStatus = "Active" },
            new() { SupplierName = "Sika Việt Nam", ContactInfo = "Kênh phân phối dự án", Address = "Hà Nội", ServiceArea = "Toàn quốc", Rating = 4.7m, EvaluationNote = "Vật liệu chống thấm và sửa chữa bê tông.", CollaborationStatus = "Active" },
            new() { SupplierName = "Nhà phân phối sơn Dulux Hà Nội", ContactInfo = "Kênh dự án", Address = "Hà Nội", ServiceArea = "Hà Nội và Hưng Yên", Rating = 4.5m, EvaluationNote = "Bột bả, sơn lót, sơn nội thất và ngoại thất theo thùng.", CollaborationStatus = "Active" },
            new() { SupplierName = "Đại lý điện nước An Phát", ContactInfo = "Kho điện nước", Address = "Hà Đông, Hà Nội", ServiceArea = "Hà Nội", Rating = 4.3m, EvaluationNote = "Dây điện, ống luồn, hộp âm, PVC/PPR và phụ kiện giao nhanh.", CollaborationStatus = "Active" },
            new() { SupplierName = "Kho thạch cao và phụ kiện hoàn thiện Hà Nội", ContactInfo = "Bộ phận bán hàng công trình", Address = "Nam Từ Liêm, Hà Nội", ServiceArea = "Hà Nội và Hưng Yên", Rating = 4.4m, EvaluationNote = "Tấm thạch cao, khung xương, vít và vật tư trần.", CollaborationStatus = "Active" }
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
            new() { ConfigKey = SystemConfigKeys.CompanyName, ConfigValue = "Công ty TNHH Đầu tư và Xây dựng Bùi Phú Gia", DataType = "string", DisplayName = "Tên công ty", Description = "Tên doanh nghiệp hiển thị trên hệ thống." },
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
            M("CADIVI-CV1.5", "Dây điện CV 1.5 mm²", "Quản lý theo mét; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV2.5", "Dây điện CV 2.5 mm²", "Quản lý theo mét; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV4", "Dây điện CV 4 mm²", "Quản lý theo mét; cuộn thương mại 100 m.", "Điện & phụ kiện", "MET"),
            M("CADIVI-CV6", "Dây điện CV 6 mm²", "Dây cấp nguồn nhánh; quản lý theo mét.", "Điện & phụ kiện", "MET"),
            M("ONG-LUON-D20", "Ống luồn dây điện cứng D20", "Cây thương mại 4 m; tồn gốc theo mét.", "Điện & phụ kiện", "MET"),
            M("ONG-LUON-D25", "Ống luồn dây điện cứng D25", "Cây thương mại 4 m; tồn gốc theo mét.", "Điện & phụ kiện", "MET"),
            M("MANG-SONG-D20", "Măng sông nối ống điện D20", "Phụ kiện nối hai đoạn ống luồn D20.", "Điện & phụ kiện", "CAI"),
            M("MANG-SONG-D25", "Măng sông nối ống điện D25", "Phụ kiện nối hai đoạn ống luồn D25.", "Điện & phụ kiện", "CAI"),
            M("DE-AM-DON", "Đế âm tường đơn", "Đế âm lắp công tắc/ổ cắm đơn.", "Điện & phụ kiện", "CAI"),
            M("DE-AM-DOI", "Đế âm tường đôi", "Đế âm lắp cụm thiết bị đôi.", "Điện & phụ kiện", "CAI"),
            M("MCB-1P-20A", "Aptomat MCB 1P 20A", "Thiết bị bảo vệ mạch nhánh.", "Điện & phụ kiện", "CAI"),
            M("O-CAM-DOI", "Ổ cắm đôi âm tường", "Ổ cắm hoàn thiện lắp âm.", "Điện & phụ kiện", "CAI"),
            M("CONG-TAC-1", "Công tắc 1 chiều", "Công tắc hoàn thiện lắp âm.", "Điện & phụ kiện", "CAI"),

            // ===== CẤP THOÁT NƯỚC =====
            M("PVC-D60", "Ống PVC D60", "Ống thoát; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PVC-D90", "Ống PVC D90", "Ống thoát; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PVC-D114", "Ống PVC D114", "Ống thoát phân/bồn cầu; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
            M("CO-PVC-D90", "Co PVC 90 độ D90", "Phụ kiện đổi hướng tuyến thoát D90.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("TE-PVC-D90", "Tê PVC D90", "Phụ kiện chia/đấu nối tuyến thoát D90.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("CO-PVC-D114", "Co PVC 90 độ D114", "Phụ kiện đổi hướng tuyến thoát D114.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("TE-PVC-D114", "Tê PVC D114", "Phụ kiện đấu nối tuyến thoát D114.", "Cấp thoát nước & phụ kiện", "CAI"),
            M("KEO-PVC-500", "Keo dán ống PVC 500 ml", "Chai keo dán ống và phụ kiện PVC.", "Cấp thoát nước & phụ kiện", "CHAI"),
            M("PPR-D20", "Ống PPR D20", "Ống cấp nước; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PPR-D25", "Ống PPR D25", "Ống cấp nước; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
            M("PPR-D32", "Ống PPR D32", "Ống cấp nước trục; cây 4 m, tồn gốc theo mét.", "Cấp thoát nước & phụ kiện", "MET"),
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

        // Hiệu chỉnh BOQ riêng cho kịch bản bảo vệ:
        // 158 m² planned - 140 m² already approved = 18 m² remaining.
        // A later 32 m² request is therefore a genuine 14 m² over-BOQ exception.
        var demoTileBoq = await context.BOQItems.FirstAsync(x =>
            x.PhaseId == phase.PhaseId && x.MaterialId == materials["GACH-POR-600"].MaterialId);
        demoTileBoq.Quantity = 158m;
        await context.SaveChangesAsync();

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
                (materials["GACH-POR-600"], master.Units["M2"], 140m, false, (string?)null),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m, false, (string?)null),
                (materials["CADIVI-CV2.5"], master.Units["CUON"], 4m, false, (string?)null)
            }, SeedUtc.AddDays(-18));

        var po1 = await CreatePurchaseOrderAsync(context, request1, project,
            master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"], accountant, director,
            PurchaseOrderStatus.FullyReceived, "PO-DEMO-DAO-DUA-001", SeedUtc.AddDays(-16),
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 45m, 225_000m),
                (materials["GACH-POR-600"], master.Units["M2"], 140m, 285_000m),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m, 2_650_000m),
                (materials["CADIVI-CV2.5"], master.Units["CUON"], 4m, 1_150_000m)
            }, "Đã phê duyệt đơn giá và điều kiện giao vật tư theo tiến độ hoàn thiện.");

        await CreateGoodsReceiptAsync(context, po1, leader, GoodsReceiptStatus.Approved,
            "GR-DEMO-DAO-DUA-001", "Xe giao hàng NCC – biển số demo 29C-123.45", "BBGH-0826-001",
            new[]
            {
                (materials["WEBER-ST250"], master.Units["BAO"], 45m),
                (materials["GACH-POR-600"], master.Units["M2"], 140m),
                (materials["SON-NOI-18"], master.Units["THUNG"], 10m),
                (materials["CADIVI-CV2.5"], master.Units["CUON"], 4m)
            }, SeedUtc.AddDays(-13));

        // 2) Yêu cầu vượt BOQ đang chờ Giám đốc; Kế toán đã kiểm tra và ghi rõ căn cứ trình duyệt.
        await CreateMaterialRequestAsync(context, phase, leader, accountant, null,
            MaterialRequestStatus.WaitingApproval, BOQCheckStatus.OverBOQ,
            "Bổ sung gạch porcelain do thay đổi bố trí khu sinh hoạt chung và tăng tỷ lệ dự phòng cắt hao.",
            "BOQ còn 18 m²; hiện trường cần thêm 32 m². Tồn khả dụng tại Đảo Dừa 3 không đủ cho phần phát sinh. Dự án San Hô có tồn nhưng đang dùng cho hạng mục cùng loại, chưa phù hợp điều chuyển. Đề nghị Giám đốc chấp thuận ngoại lệ 14 m² vượt định mức.",
            null,
            new[]
            {
                (materials["GACH-POR-600"], master.Units["M2"], 32m, true, (string?)"Vượt 14 m² so với phần định mức còn lại do thay đổi phạm vi hoàn thiện.")
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
            "Cấp vật tư chống thấm để hoàn thiện các khu vực ướt còn lại.",
            "Đã kiểm tra BOQ và lịch thi công; cần giao trước khi test ngâm nước.",
            null,
            new[] { (materials["SIKA-TOP-107"], master.Units["BO"], 8m, false, (string?)null) }, SeedUtc.AddDays(-7));
        await CreatePurchaseOrderAsync(context, request3, project,
            master.Suppliers["Sika Việt Nam"], accountant, director,
            PurchaseOrderStatus.Sent, "PO-DEMO-DAO-DUA-003", SeedUtc.AddDays(-6),
            new[] { (materials["SIKA-TOP-107"], master.Units["BO"], 8m, 1_650_000m) },
            "Duyệt PO chống thấm; giao thẳng công trình Đảo Dừa 3.");

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
            CreatedBy = creator.UserId
        });
        task.ProgressPercent = newProgress;
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
            ApprovedBy = approver?.UserId,
            AccountantNote = accountantNote,
            ApprovalNote = approvalNote,
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
    // TỒN KHO MẪU Ở CÁC DỰ ÁN KHÁC
    // These intentionally create varied current inventory across projects so the
    // Material Request review screen has meaningful "other project stock" context.
    // -------------------------------------------------------------------------
    private static async Task SeedSecondaryInventorySnapshotsAsync(
        AppDbContext context,
        Dictionary<string, ProjectBundle> projects,
        Dictionary<string, User> users,
        MasterData master,
        Dictionary<string, MaterialCatalog> materials)
    {
        var accountant = users["ketoan@bpg.com"];
        var director = users["giamdoc@bpg.com"];

        var snapshots = new[]
        {
            ("Biệt thự nhà chú Công – khu San Hô, Vinhomes Ocean Park 2", "GACH-POR-600", "M2", 110m, 285_000m),
            ("Cải tạo chung cư Trần Thủ Độ", "WEBER-ST250", "BAO", 24m, 225_000m),
            ("Biệt thự song lập An Khánh – Hoài Đức", "SIKA-TOP-107", "BO", 12m, 1_650_000m),
            ("Cải tạo nhà liền kề Vạn Phúc – Hà Đông", "SON-NOI-18", "THUNG", 12m, 2_650_000m)
        };

        var seq = 10;
        foreach (var s in snapshots)
        {
            var b = projects[s.Item1];
            var phase = b.Phases.First(p => p.Status == PhaseStatus.InProgress);
            var request = await CreateMaterialRequestAsync(context, phase, b.Leader, accountant, null,
                MaterialRequestStatus.Approved, BOQCheckStatus.WithinBOQ,
                "Cấp vật tư theo kế hoạch thi công đang triển khai.",
                "Đã đối chiếu BOQ và tồn hiện tại; đề nghị mua bổ sung đúng tiến độ.",
                null,
                new[] { (materials[s.Item2], master.Units[s.Item3], s.Item4, false, (string?)null) },
                SeedUtc.AddDays(-20 - seq));

            var po = await CreatePurchaseOrderAsync(context, request, b.Project,
                master.Suppliers["Đại lý VLXD Minh Phát Hà Đông"], accountant, director,
                PurchaseOrderStatus.FullyReceived, $"PO-SNAP-{seq:D3}", SeedUtc.AddDays(-18 - seq),
                new[] { (materials[s.Item2], master.Units[s.Item3], s.Item4, s.Item5) },
                "Duyệt PO phục vụ tiến độ dự án.");

            await CreateGoodsReceiptAsync(context, po, b.Leader, GoodsReceiptStatus.Approved,
                $"GR-SNAP-{seq:D3}", "Nhà cung cấp giao tại công trường", $"BBGH-SNAP-{seq:D3}",
                new[] { (materials[s.Item2], master.Units[s.Item3], s.Item4) }, SeedUtc.AddDays(-15 - seq));
            seq++;
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
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["WEBER-ST250"], master.Units["BAO"], 50m, source.Leader.UserId, historicalIssuance.CreatedAt);
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["GACH-POR-600"], master.Units["M2"], 70m, source.Leader.UserId, historicalIssuance.CreatedAt);
        await AddIssuanceLineAsync(context, historicalIssuance, source.Project, materials["SON-NOI-18"], master.Units["THUNG"], 10m, source.Leader.UserId, historicalIssuance.CreatedAt);

        var surplus = new SurplusRequest
        {
            ProjectId = source.Project.ProjectId,
            Reason = "Tổng hợp vật tư còn thừa sau khi hoàn thành dự án; ưu tiên điều chuyển nội bộ trước, phần còn lại trả NCC/thanh lý.",
            Status = SurplusRequestStatus.Processed,
            CreatedAt = new DateTime(2026,6,2,2,0,0,DateTimeKind.Utc),
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

        var tileItem = await AddItem("GACH-POR-600", "M2", 30m);
        var adhesiveItem = await AddItem("WEBER-ST250", "BAO", 10m);
        var paintItem = await AddItem("SON-NOI-18", "THUNG", 2m);

        var transfer = new SurplusTransfer
        {
            SurplusRequestItemId = tileItem.SurplusRequestItemId,
            FromProjectId = source.Project.ProjectId,
            ToProjectId = target.Project.ProjectId,
            TransferQuantity = 30m,
            Status = SurplusTransferStatus.Received,
            ApprovedBy = tpkt.UserId,
            ApprovedAt = new DateTime(2026,6,18,2,0,0,DateTimeKind.Utc),
            DispatchedBy = source.Leader.UserId,
            DispatchedAt = new DateTime(2026,6,19,2,0,0,DateTimeKind.Utc),
            ReceivedBy = target.Leader.UserId,
            ReceivedAt = new DateTime(2026,6,20,2,0,0,DateTimeKind.Utc),
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
            ReturnQuantity = 10m,
            RefundAmount = 2_100_000m,
            Note = "NCC nhận lại 10 bao keo còn nguyên, hoàn tiền theo thỏa thuận.",
            CreatedAt = new DateTime(2026,6,21,2,0,0,DateTimeKind.Utc),
            CreatedBy = source.Leader.UserId
        };
        context.SurplusReturnSuppliers.Add(returnSupplier);
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, source.Project, materials["WEBER-ST250"], -(10m / adhesiveItem.ConversionRate),
            InventoryTransactionType.ReturnToSupplier, returnSupplier.SurplusReturnSupplierId, EntityType.SurplusReturnSupplier,
            source.Leader.UserId, returnSupplier.CreatedAt);

        var liquidation = new SurplusLiquidation
        {
            SurplusRequestItemId = paintItem.SurplusRequestItemId,
            BuyerName = "Đội hoàn thiện dân dụng địa phương",
            LiquidationQuantity = 2m,
            TotalAmount = 3_200_000m,
            CreatedAt = new DateTime(2026,6,22,2,0,0,DateTimeKind.Utc),
            CreatedBy = accountant.UserId
        };
        context.SurplusLiquidations.Add(liquidation);
        await context.SaveChangesAsync();
        await ApplyStockAsync(context, source.Project, materials["SON-NOI-18"], -(2m / paintItem.ConversionRate),
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
