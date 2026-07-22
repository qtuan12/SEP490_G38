using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        try
        {
            Console.WriteLine("Attempting to delete existing database to re-seed...");
            await context.Database.EnsureDeletedAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not delete database ({ex.Message}).");
        }

        await context.Database.MigrateAsync();
        if (await context.Units.AnyAsync() && await context.Projects.AnyAsync()) return;

        var users      = await SeedAuthAsync(context);
        var masterData = await SeedMasterDataAsync(context);
        var catalogs   = await SeedMaterialsAsync(context, masterData.Units, masterData.Categories);
        await SeedProjectsAndLifecyclesAsync(context, users, masterData.Units, catalogs, masterData.Suppliers);
        await SeedNotificationsAsync(context, users);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTH – Users & Roles
    // Roles: Admin | Director | TechnicalManager | SiteEngineer | Accountant
    // NOTE: "ProjectLeader" role does NOT exist.
    //       A site-engineer becomes a leader via IsLeader=true in ProjectMember.
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task<Dictionary<string, User>> SeedAuthAsync(AppDbContext context)
    {
        var result = new Dictionary<string, User>();
        if (await context.Users.AnyAsync())
        {
            foreach (var u in await context.Users.ToListAsync()) result[u.Email] = u;
            return result;
        }

        var seed = new List<(string Email, string HoTen, string Role, string DienThoai)>
        {
            ("admin@bpg.com",    "Nguyễn Văn Hải",        "Admin",            "0901 234 567"),
            ("giamdoc@bpg.com",  "Trần Quốc Hùng",         "Director",         "0912 345 678"),
            ("tpkt@bpg.com",     "Lê Minh Tuấn",           "TechnicalManager", "0923 456 789"),
            // All "leader" accounts are SiteEngineer; they become project leaders
            // via IsLeader=true in ProjectMember table.
            ("leader1@bpg.com",  "Phạm Văn Đức",           "SiteEngineer",     "0934 567 890"),
            ("leader2@bpg.com",  "Hoàng Thị Lan",          "SiteEngineer",     "0945 111 222"),
            ("leader3@bpg.com",  "Đinh Văn Cường",         "SiteEngineer",     "0945 333 444"),
            ("leader4@bpg.com",  "Nguyễn Trọng Tài",       "SiteEngineer",     "0945 555 666"),
            ("leader5@bpg.com",  "Lê Bá Tòng",             "SiteEngineer",     "0945 777 888"),
            ("leader6@bpg.com",  "Vũ Trọng Phụng",         "SiteEngineer",     "0945 888 999"),
            ("leader7@bpg.com",  "Ngô Tất Tố",             "SiteEngineer",     "0945 999 000"),
            ("leader8@bpg.com",  "Nam Cao",                "SiteEngineer",     "0946 111 222"),
            ("leader9@bpg.com",  "Thạch Lam",              "SiteEngineer",     "0946 222 333"),
            ("leader10@bpg.com", "Xuân Diệu",              "SiteEngineer",     "0946 333 444"),
            ("kysu1@bpg.com",    "Vũ Tiến Dũng",           "SiteEngineer",     "0956 222 333"),
            ("kysu2@bpg.com",    "Nguyễn Thị Thu Hà",      "SiteEngineer",     "0967 333 444"),
            ("kysu3@bpg.com",    "Trần Văn Mạnh",          "SiteEngineer",     "0978 444 555"),
            ("kysu4@bpg.com",    "Lê Hoàng Phong",         "SiteEngineer",     "0989 555 666"),
            ("kysu5@bpg.com",    "Đỗ Quốc Anh",            "SiteEngineer",     "0989 777 888"),
            ("kysu6@bpg.com",    "Bùi Hữu Nghĩa",          "SiteEngineer",     "0911 222 333"),
            ("kysu7@bpg.com",    "Tạ Duy Lâm",             "SiteEngineer",     "0922 333 444"),
            ("kysu8@bpg.com",    "Hồ Ngọc Hân",            "SiteEngineer",     "0933 444 555"),
            ("kysu9@bpg.com",    "Phan Đình Phùng",        "SiteEngineer",     "0944 555 666"),
            ("kysu10@bpg.com",   "Ngô Bảo Châu",           "SiteEngineer",     "0955 666 777"),
            ("kysu11@bpg.com",   "Tôn Thất Tùng",          "SiteEngineer",     "0955 777 888"),
            ("kysu12@bpg.com",   "Trần Hưng Đạo",          "SiteEngineer",     "0955 888 999"),
            ("kysu13@bpg.com",   "Nguyễn Huệ",             "SiteEngineer",     "0955 999 000"),
            ("kysu14@bpg.com",   "Lê Lợi",                 "SiteEngineer",     "0956 111 222"),
            ("kysu15@bpg.com",   "Phan Bội Châu",          "SiteEngineer",     "0956 222 333"),
            ("kysu16@bpg.com",   "Phan Chu Trinh",         "SiteEngineer",     "0956 333 444"),
            ("kysu17@bpg.com",   "Hoàng Diệu",             "SiteEngineer",     "0956 444 555"),
            ("kysu18@bpg.com",   "Nguyễn Tri Phương",      "SiteEngineer",     "0956 555 666"),
            ("kysu19@bpg.com",   "Lý Thường Kiệt",         "SiteEngineer",     "0956 666 777"),
            ("kysu20@bpg.com",   "Lý Thái Tổ",             "SiteEngineer",     "0956 777 888"),
            ("ketoan@bpg.com",   "Đỗ Thị Bích Ngọc",       "Accountant",       "0989 555 666"),
        };

        foreach (var s in seed)
        {
            var user = new User
            {
                FullName     = s.HoTen,
                Email        = s.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                PhoneNumber  = s.DienThoai,
                IsActive     = true,
                CreatedAt    = DateTime.UtcNow,
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            var role = await context.Roles.FirstOrDefaultAsync(r => r.RoleName == s.Role);
            if (role != null)
            {
                context.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, CreatedAt = DateTime.UtcNow });
                await context.SaveChangesAsync();
            }
            result[s.Email] = user;
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MASTER DATA
    // ─────────────────────────────────────────────────────────────────────────
    record MasterData(List<Unit> Units, List<MaterialCategory> Categories, List<Supplier> Suppliers);
    private static async Task<MasterData> SeedMasterDataAsync(AppDbContext context)
    {
        var units = await context.Units.ToListAsync();
        if (!units.Any())
        {
            units = new List<Unit>
            {
                new() { UnitCode = "BAO",   UnitName = "Bao (50kg)", IsDiscrete = true },
                new() { UnitCode = "KG",    UnitName = "Kilôgam", IsDiscrete = false },
                new() { UnitCode = "TAN",   UnitName = "Tấn", IsDiscrete = false },
                new() { UnitCode = "M3",    UnitName = "Mét khối", IsDiscrete = false },
                new() { UnitCode = "M2",    UnitName = "Mét vuông", IsDiscrete = false },
                new() { UnitCode = "MET",   UnitName = "Mét dài", IsDiscrete = false },
                new() { UnitCode = "CAI",   UnitName = "Cái", IsDiscrete = true },
                new() { UnitCode = "BO",    UnitName = "Bộ", IsDiscrete = true },
                new() { UnitCode = "CUON",  UnitName = "Cuộn", IsDiscrete = true },
                new() { UnitCode = "THUNG", UnitName = "Thùng", IsDiscrete = true },
            };
            context.Units.AddRange(units);
            await context.SaveChangesAsync();
        }

        var suppliers = await context.Suppliers.ToListAsync();
        if (!suppliers.Any())
        {
            suppliers = new List<Supplier>
            {
                new() { SupplierName = "Công ty TNHH VLXD Hoàng Gia",       ContactInfo = "028 3456 7890", Address = "123 Nguyễn Văn Cừ, Q.5, TP.HCM",               ServiceArea = "TP.HCM, Bình Dương",  Rating = 4.5m, EvaluationNote = "Giao hàng đúng hẹn, chất lượng ổn định",          CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty CP Xi Măng Hà Tiên",         ContactInfo = "028 2345 6789", Address = "45 Đinh Tiên Hoàng, Q.1, TP.HCM",               ServiceArea = "Toàn quốc",           Rating = 4.8m, EvaluationNote = "Nhà cung cấp xi măng uy tín hàng đầu Việt Nam",     CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty Thép Miền Nam Pomina",        ContactInfo = "0274 3728 000", Address = "KCN Sóng Thần, Bình Dương",                      ServiceArea = "Miền Nam",            Rating = 4.6m, EvaluationNote = "Thép cán nóng đạt chuẩn TCVN, giá cạnh tranh",     CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Cơ sở Cát Đá Xây Dựng Thiên Phú",   ContactInfo = "0251 3870 123", Address = "Quốc lộ 1A, Long Khánh, Đồng Nai",              ServiceArea = "Đồng Nai, TP.HCM",   Rating = 4.2m, EvaluationNote = "Cát sạch, đá đảm bảo độ cứng, giao hàng bằng xe tải lớn", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty CP Sơn Kova Việt Nam",        ContactInfo = "028 3844 4000", Address = "16/3A Bạch Đằng, P.2, Q. Tân Bình, TP.HCM",    ServiceArea = "Toàn quốc",           Rating = 4.7m, EvaluationNote = "Sản phẩm đa dạng, hỗ trợ kỹ thuật thi công tốt",   CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
            };
            context.Suppliers.AddRange(suppliers);
            await context.SaveChangesAsync();
        }

        var cats = await context.MaterialCategories.ToListAsync();
        if (!cats.Any())
        {
            cats = new List<MaterialCategory>
            {
                new() { CategoryName = "Xi măng",                   Description = "Các loại xi măng xây dựng",                           CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Sắt thép xây dựng",         Description = "Thép thanh vằn, thép cuộn, thép hình",                CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Cát đá vật liệu rời",       Description = "Cát vàng, cát trát, đá dăm 1x2, đá 0.5x1",           CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Gạch xây dựng",             Description = "Gạch ống, gạch thẻ, gạch block bê tông",             CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Sơn & vật liệu hoàn thiện", Description = "Sơn nội ngoại thất, bột bả, keo chà ron",            CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Thiết bị điện",             Description = "Dây cáp điện, CB, ổ cắm, đèn chiếu sáng",           CreatedAt = DateTime.UtcNow },
                new() { CategoryName = "Vật liệu cấp thoát nước",   Description = "Ống PVC, ống PPR, co, tê, van nước",                 CreatedAt = DateTime.UtcNow },
            };
            context.MaterialCategories.AddRange(cats);
            await context.SaveChangesAsync();
        }

        if (!await context.SystemConfigs.AnyAsync())
        {
            context.SystemConfigs.AddRange(
                new SystemConfig { ConfigKey = "NguongTonKhoThap", ConfigValue = "10", DataType = "number", DisplayName = "Ngưỡng tồn kho thấp", Description = "Số lượng tồn kho tối thiểu.", Unit = "đơn vị", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "HanHuyPhieuNgay", ConfigValue = "7", DataType = "number", DisplayName = "Hạn hủy phiếu nhập kho", Description = "Số ngày tối đa kể từ khi tạo phiếu nhập kho mà người dùng có thể hủy phiếu.", Unit = "ngày", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "DailyLogEditWindowHours", ConfigValue = "24", DataType = "number", DisplayName = "Giờ được sửa nhật ký thi công", Description = "Số giờ kể từ lúc tạo mà kỹ sư còn được phép chỉnh sửa nhật ký thi công.", Unit = "giờ", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyName", ConfigValue = "BPG CMS", DataType = "string", DisplayName = "Tên công ty", Description = "Tên công ty hiển thị trên sidebar và trang đăng nhập.", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyLogoUrl", ConfigValue = "/logo.png", DataType = "string", DisplayName = "Logo công ty", Description = "URL logo hiển thị trên sidebar và trang đăng nhập.", CreatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        return new MasterData(units, cats, suppliers);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MATERIAL CATALOG
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task<List<MaterialCatalog>> SeedMaterialsAsync(
        AppDbContext context, List<Unit> units, List<MaterialCategory> cats)
    {
        var catalogs = await context.MaterialCatalogs.ToListAsync();
        if (catalogs.Any()) return catalogs;

        Unit Bao(string code)             => units.First(u => u.UnitCode == code);
        MaterialCategory Cat(string name) => cats.First(c => c.CategoryName == name);

        catalogs = new List<MaterialCatalog>
        {
            new() { Code="VT-001", Name="Xi măng Hà Tiên PCB40",               Specification="Bao 50kg, TCVN 6260:2009, mác 400",                    CategoryId=Cat("Xi măng").CategoryId,                   BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-010", Name="Thép cuộn tròn trơn CB240-T D6",      Specification="Pomina, cuộn ~50kg, TCVN 1651-1:2018",                 CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-012", Name="Thép thanh vằn CB300-V D10",          Specification="Pomina, cây 11.7m, TCVN 1651-2:2018",                  CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-020", Name="Cát vàng xây dựng (cát sông Đồng Nai)", Specification="Sạch, mô đun độ lớn 2.5-3.0, không lẫn bùn sét",    CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            new() { Code="VT-022", Name="Đá dăm 1x2 (đá 4x6)",                Specification="Đá nghiền Đồng Nai, kích thước 10-20mm",                CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            new() { Code="VT-030", Name="Gạch ống 4 lỗ 8x8x19cm",             Specification="Mác 75, TCVN 1450:2009, xây tường 100",                CategoryId=Cat("Gạch xây dựng").CategoryId,             BaseUnitId=Bao("CAI").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-041", Name="Sơn nước nội thất Kova A910",         Specification="Thùng 18 lít, bóng mờ, kháng mốc, kháng khuẩn",       CategoryId=Cat("Sơn & vật liệu hoàn thiện").CategoryId, BaseUnitId=Bao("THUNG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-050", Name="Dây cáp điện đôi Trần Phú 2x1.5mm²", Specification="Cuộn 100m, vỏ PVC chịu nhiệt 70°C, chịu tải 13A",    CategoryId=Cat("Thiết bị điện").CategoryId,             BaseUnitId=Bao("CUON").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-060", Name="Ống nhựa PVC Tiền Phong Phi 90",     Specification="Cây 4m, áp lực PN10, tiêu chuẩn TCVN 6151",            CategoryId=Cat("Vật liệu cấp thoát nước").CategoryId,   BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
        };
        context.MaterialCatalogs.AddRange(catalogs);
        await context.SaveChangesAsync();

        if (!await context.MaterialConversions.AnyAsync())
        {
            var thepCuon = catalogs.First(c => c.Code == "VT-010");
            var thepVan  = catalogs.First(c => c.Code == "VT-012");
            var unitTan  = units.First(u => u.UnitCode == "TAN").UnitId;

            context.MaterialConversions.AddRange(
                new MaterialConversion { MaterialId = thepCuon.MaterialId, AlternativeUnitId = unitTan, ConversionRate = 0.001m, CreatedAt = DateTime.UtcNow },
                new MaterialConversion { MaterialId = thepVan.MaterialId,  AlternativeUnitId = unitTan, ConversionRate = 0.001m, CreatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        return catalogs;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROJECTS, PHASES, TASKS + FULL LIFECYCLE DATA
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedProjectsAndLifecyclesAsync(
        AppDbContext context,
        Dictionary<string, User> users,
        List<Unit> units,
        List<MaterialCatalog> catalogs,
        List<Supplier> suppliers)
    {
        var tpkt   = users["tpkt@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];
        var gd     = users["giamdoc@bpg.com"];

        var leaders = users.Values.Where(u => u.Email.StartsWith("leader")).ToArray();
        var kysus   = users.Values.Where(u => u.Email.StartsWith("kysu")).ToArray();

        var today  = DateOnly.FromDateTime(DateTime.UtcNow);
        var rnd    = new Random(123);
        var unitTan = units.First(u => u.UnitCode == "TAN").UnitId;

        // ProjectStatus: Draft | InProgress | Paused | Completed | Closed
        var dsDuAn = new[]
        {
            new { Ten="Bệnh viện Phương Đông",         TrangThai="Completed",  BatDau=today.AddDays(-300), KetThuc=today.AddDays(-10) },
            new { Ten="Khu nhà ở thương mại Hưng Phú", TrangThai="Completed",  BatDau=today.AddDays(-180), KetThuc=today.AddDays(-5)  },
            new { Ten="Nhà máy May mặc Thiên Long",    TrangThai="Completed",  BatDau=today.AddDays(-200), KetThuc=today.AddDays(-2)  },
            new { Ten="Chung cư cao tầng SkyView",     TrangThai="InProgress", BatDau=today.AddDays(-90),  KetThuc=today.AddDays(180) },
            new { Ten="Trường quốc tế Á Châu",         TrangThai="InProgress", BatDau=today.AddDays(-50),  KetThuc=today.AddDays(150) },
            new { Ten="TTTM Vincom Dĩ An",             TrangThai="InProgress", BatDau=today.AddDays(-30),  KetThuc=today.AddDays(240) },
            new { Ten="KDC Sài Gòn Mới",               TrangThai="InProgress", BatDau=today.AddDays(-10),  KetThuc=today.AddDays(200) },
            new { Ten="Trường tiểu học Lê Văn Tám",    TrangThai="Draft",      BatDau=today.AddDays(10),   KetThuc=today.AddDays(240) },
            new { Ten="Khách sạn Mường Thanh CT",      TrangThai="Draft",      BatDau=today.AddDays(30),   KetThuc=today.AddDays(300) },
            new { Ten="Cầu Vượt Ngã Tư Thủ Đức",       TrangThai="Draft",      BatDau=today.AddDays(45),   KetThuc=today.AddDays(400) },
        };

        for (int i = 0; i < dsDuAn.Length; i++)
        {
            var dp     = dsDuAn[i];
            var leader = leaders[i % leaders.Length];
            var ksA    = kysus[(i * 2)     % kysus.Length];
            var ksB    = kysus[(i * 2 + 1) % kysus.Length];

            var project = new Project
            {
                Name         = dp.Ten,
                Address      = "Việt Nam",
                PlannedStart = dp.BatDau,
                PlannedEnd   = dp.KetThuc,
                Status       = dp.TrangThai,   // ProjectStatus constant
                CreatedAt    = DateTime.UtcNow,
                CreatedBy    = tpkt.UserId
            };
            context.Projects.Add(project);
            await context.SaveChangesAsync();

            // leader is SiteEngineer with IsLeader=true
            context.ProjectMembers.AddRange(
                new ProjectMember { ProjectId=project.ProjectId, UserId=leader.UserId, IsLeader=true,  JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksA.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksB.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow }
            );
            await context.SaveChangesAsync();

            // ── Phase completion: Completed → all approved, InProgress → phase1 approved + phase2 in progress
            var phases = new[]
            {
                new { Ten="Móng",       ThuTu=1, Pct = dp.TrangThai is "Completed" or "InProgress" ? 100 : 0 },
                new { Ten="Khung",      ThuTu=2, Pct = dp.TrangThai == "Completed" ? 100 : (dp.TrangThai == "InProgress" ? 50 : 0) },
                new { Ten="Hoàn thiện", ThuTu=3, Pct = dp.TrangThai == "Completed" ? 100 : 0 },
            };

            foreach (var pd in phases)
            {
                bool isPhaseApproved = pd.Pct == 100;   // nghiệm thu
                bool isPhaseActive   = pd.Pct > 0 && !isPhaseApproved;

                // PhaseStatus: Draft | InProgress | Completed | Approved
                string phaseStatus = isPhaseApproved ? "Approved"
                                   : isPhaseActive   ? "InProgress"
                                   :                   "Draft";

                var phase = new Phase
                {
                    ProjectId  = project.ProjectId,
                    Name       = pd.Ten,
                    OrderIndex = pd.ThuTu,
                    Status     = phaseStatus,
                    StartDate  = dp.BatDau.AddDays((pd.ThuTu - 1) * 60),
                    EndDate    = dp.BatDau.AddDays(pd.ThuTu * 60),
                    CreatedAt  = DateTime.UtcNow
                };
                context.Phases.Add(phase);
                await context.SaveChangesAsync();

                // BOQ per phase
                foreach (var mat in catalogs)
                {
                    decimal qty      = 0;
                    decimal convRate = 1;
                    int finalUnit    = mat.BaseUnitId;

                    if      (mat.Name.Contains("Thép"))                               { qty = rnd.Next(10, 50);   finalUnit = unitTan; convRate = 0.001m; }
                    else if (mat.Name.Contains("Cát") || mat.Name.Contains("Đá"))     { qty = rnd.Next(100, 500); }
                    else if (mat.Name.Contains("Xi măng"))                             { qty = rnd.Next(200, 1000); }
                    else                                                                { qty = rnd.Next(50, 200); }

                    context.BOQItems.Add(new BOQItem
                    {
                        PhaseId = phase.PhaseId, MaterialId = mat.MaterialId,
                        UnitId = finalUnit, Quantity = qty, ConversionRate = convRate, CreatedAt = DateTime.UtcNow
                    });
                }
                await context.SaveChangesAsync();

                // PhaseAcceptance for Approved phases
                if (isPhaseApproved)
                {
                    context.PhaseAcceptances.Add(new PhaseAcceptance
                    {
                        PhaseId        = phase.PhaseId,
                        AcceptedBy     = tpkt.UserId,
                        AcceptanceDate = DateTime.UtcNow.AddDays(-5),
                        ReportContent  = $@"### 2. Thành phần trực tiếp nghiệm thu:
* **Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát):**
  - Ông/Bà: Lê Minh Tuấn  Chức vụ: Trưởng phòng Kỹ thuật
* **Đại diện Nhà thầu thi công:**
  - Ông/Bà: Nguyễn Văn A  Chức vụ: Trưởng dự án

### 3. Thời gian nghiệm thu:
* Bắt đầu: {DateTime.UtcNow.AddDays(-5):dd/MM/yyyy}
* Kết thúc: {DateTime.UtcNow.AddDays(-5):dd/MM/yyyy}
* Tại công trình: Việt Nam

### 4. Đánh giá công việc xây dựng đã thực hiện:
- **Tài liệu căn cứ nghiệm thu:**
  * Bản vẽ thiết kế thi công đã duyệt.
  * Nhật ký thi công công trình.
  * Các kết quả thí nghiệm, kiểm định chất lượng vật liệu (nếu có).

- **Đánh giá về chất lượng:** Các hạng mục thuộc giai đoạn **{phase.Name}** đã được thi công đạt yêu cầu kỹ thuật theo đúng hồ sơ thiết kế và các tiêu chuẩn hiện hành.
- **Đánh giá về khối lượng:** Hoàn thành toàn bộ khối lượng công việc theo đúng thiết kế của giai đoạn.
- **Ý kiến khác:** Không.

### 5. Kết luận:**
- Đồng ý nghiệm thu giai đoạn công việc xây dựng này.
- Cho phép chuyển sang triển khai công đoạn tiếp theo.",
                        IsCancelled    = false,
                        CreatedAt      = DateTime.UtcNow,
                        CreatedBy      = tpkt.UserId
                    });
                    await context.SaveChangesAsync();
                }

                // ── TASKS ────────────────────────────────────────────────────
                // TaskStatus: New | Assigned | InProgress | Completed | Approved | Obsolete
                var taskNames = new[] { "Nhiệm vụ 1", "Nhiệm vụ 2", "Nhiệm vụ 3" };
                var createdTasks = new List<ProjectTask>();

                int taskIdx = 0;
                foreach (var tName in taskNames)
                {
                    string taskStatus;
                    bool   isLocked = false;

                    if (isPhaseApproved)
                    {
                        taskStatus = "Approved";  // phase nghiệm thu → task bị khóa
                        isLocked   = true;
                    }
                    else if (isPhaseActive)
                    {
                        taskStatus = "InProgress";
                    }
                    else
                    {
                        taskStatus = "New";        // Draft phase → chưa giao
                    }

                    var tStartDate = phase.StartDate.Value;
                    var tEndDate = phase.EndDate.Value;
                    var tProgress = (byte)pd.Pct;

                    // Customize task dates and progress for active phases to seed warning data
                    if (isPhaseActive)
                    {
                        if (taskIdx == 0)
                        {
                            // Task 1: Overdue (Red warning)
                            tStartDate = today.AddDays(-20);
                            tEndDate = today.AddDays(-5);
                            tProgress = 40;
                        }
                        else if (taskIdx == 1)
                        {
                            // Task 2: Slow progress (Yellow warning)
                            tStartDate = today.AddDays(-10);
                            tEndDate = today.AddDays(10);
                            tProgress = 15; // expected ~50%, actual 15% -> Yellow
                        }
                    }

                    var task = new ProjectTask
                    {
                        PhaseId         = phase.PhaseId,
                        Name            = $"{pd.Ten} - {tName}",
                        OrderIndex      = 1,
                        StartDate       = tStartDate,
                        EndDate         = tEndDate,
                        Status          = taskStatus,
                        ProgressPercent = tProgress,
                        IsLocked        = isLocked,
                        CreatedAt       = DateTime.UtcNow,
                        CreatedBy       = tpkt.UserId
                    };
                    context.Tasks.Add(task);
                    await context.SaveChangesAsync();

                    // Assign engineer khi task đã/đang được thực hiện
                    if (tProgress > 0)
                    {
                        context.TaskAssignees.Add(new TaskAssignee { TaskId = task.TaskId, UserId = ksA.UserId, AssignedAt = DateTime.UtcNow });
                        await context.SaveChangesAsync();
                    }

                    createdTasks.Add(task);
                    taskIdx++;
                }

                // ── DAILY LOGS + TASK PROGRESS LOGS + COMMENTS ───────────────
                // Tạo nhật ký công trường cho các task có tiến độ (phase active hoặc approved)
                if (pd.Pct > 0)
                {
                    await SeedDailyLogsForPhaseAsync(context, createdTasks, pd.Pct, phase, ksA, leader, tpkt, gd, rnd);
                }

                // ── PROCUREMENT FLOW ─────────────────────────────────────────
                if (pd.Pct > 0)
                {
                    var (po, gr) = await SeedProcurementAsync(context, phase, project, leader, ketoan, gd, suppliers, catalogs, rnd);

                    // ── MATERIAL ISSUANCE – xuất dùng vật tư gắn vào task ────
                    // Chỉ xuất dùng cho task InProgress/Approved (có tiến độ)
                    var taskForIssuance = createdTasks.First();
                    await SeedMaterialIssuanceAsync(context, taskForIssuance, project, catalogs, units, rnd);

                    _ = (po, gr); // suppress unused warning
                }
            }

            // ── DIRECT PURCHASE (mua khẩn cấp) – chỉ cho InProgress projects ──
            // Áp dụng cho 2 trong 4 dự án InProgress để có đa dạng dữ liệu
            if (dp.TrangThai == "InProgress" && i % 2 == 0)
            {
                await SeedDirectPurchaseAsync(context, project, leader, ketoan, catalogs, units, rnd);
            }

            // ── INCIDENTS ────────────────────────────────────────────────────
            if (dp.TrangThai == "Completed" && rnd.Next(2) == 0)
            {
                var firstTask = await context.Tasks.FirstAsync(t => t.Phase.ProjectId == project.ProjectId);
                await SeedIncidentAsync(context, project, firstTask, ksA, leader, tpkt, gd, ketoan, catalogs, units, rnd);
            }

            // ── SURPLUS for Completed projects ───────────────────────────────
            if (dp.TrangThai == "Completed")
            {
                await SeedSurplusAsync(context, project, leader);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DAILY LOGS + TASK PROGRESS LOGS + COMMENTS
    // Mô phỏng nhật ký thực tế: nhiều ngày, tiến độ tăng dần, có comment từ TPKT/Giám đốc
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedDailyLogsForPhaseAsync(
        AppDbContext context,
        List<ProjectTask> tasks,
        int finalPct,
        Phase phase,
        User ksA, User leader, User tpkt, User gd,
        Random rnd)
    {
        // Tạo 3-5 bản ghi nhật ký theo chuỗi ngày, tiến độ tăng dần
        var logDates = finalPct == 100
            ? new[] { -20, -15, -10, -7, -5 }   // completed: 5 lần cập nhật
            : new[] { -12, -8,  -5,  -2 };       // in-progress: 4 lần

        // Mỗi bản ghi tăng % theo khoảng đều
        var progressSteps = Enumerable.Range(1, logDates.Length)
            .Select(step => (byte)Math.Min(finalPct, (finalPct / logDates.Length) * step))
            .ToArray();
        progressSteps[^1] = (byte)finalPct; // đảm bảo bước cuối = finalPct

        var descriptions = new[]
        {
            "Thi công theo đúng kế hoạch, thời tiết thuận lợi, không phát sinh vấn đề.",
            "Hoàn thành đổ bê tông đúng tiến độ, có kiểm tra bằng súng bê tông.",
            "Gặp mưa nhẹ buổi chiều nhưng không ảnh hưởng đến chất lượng thi công.",
            "Nhân công đủ, vật tư đã về đầy đủ, tiến hành thi công liên tục 2 ca.",
            "Hoàn tất giai đoạn này, chờ TPKT xuống nghiệm thu thực địa.",
        };

        var creatorOptions = new[] { ksA, leader }; // kỹ sư hoặc leader đều có thể ghi

        foreach (var task in tasks)
        {
            byte previousPct = 0;
            DailyLog? lastLog = null;

            for (int d = 0; d < logDates.Length; d++)
            {
                var creator  = creatorOptions[d % 2];
                var logDate  = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(logDates[d]));
                var newPct   = progressSteps[d];

                var log = new DailyLog
                {
                    TaskId             = task.TaskId,
                    LogDate            = logDate,
                    NewProgressPercent = newPct,
                    Description        = descriptions[d % descriptions.Length],
                    CreatedBy          = creator.UserId,
                    CreatedAt          = DateTime.UtcNow.AddDays(logDates[d])
                };
                context.DailyLogs.Add(log);
                await context.SaveChangesAsync();

                // TaskProgressLog – ghi lại lịch sử thay đổi % của task
                context.TaskProgressLogs.Add(new TaskProgressLog
                {
                    TaskId        = task.TaskId,
                    OldProgress   = previousPct,
                    NewProgress   = newPct,
                    UpdateReason  = $"Cập nhật tiến độ ngày {logDate:dd/MM/yyyy}",
                    UpdatedAt     = DateTime.UtcNow.AddDays(logDates[d])
                });
                await context.SaveChangesAsync();

                previousPct = newPct;
                lastLog = log;
            }

            // Comment từ TPKT hoặc Giám đốc vào nhật ký cuối cùng (giám sát từ xa)
            if (lastLog != null)
            {
                var commenter = rnd.Next(2) == 0 ? tpkt : gd;
                var commentTexts = new[]
                {
                    "Tiến độ ổn, tiếp tục duy trì chất lượng.",
                    "Cần chú ý kỹ phần coffa trước khi đổ bê tông.",
                    "Tốt, đảm bảo nghiệm thu đúng hạn.",
                    "Kiểm tra lại khoảng cách cốt thép theo bản vẽ A-03.",
                };

                context.Comments.Add(new Comment
                {
                    LogId     = lastLog.LogId,
                    AuthorId  = commenter.UserId,
                    Content   = commentTexts[rnd.Next(commentTexts.Length)],
                    CreatedAt = DateTime.UtcNow.AddDays(-1)
                });
                await context.SaveChangesAsync();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROCUREMENT FLOW: MaterialRequest → PO → GoodsReceipt
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task<(PurchaseOrder po, GoodsReceipt gr)> SeedProcurementAsync(
        AppDbContext context,
        Phase phase, Project project,
        User leader, User ketoan, User gd,
        List<Supplier> suppliers, List<MaterialCatalog> catalogs,
        Random rnd)
    {
        // MaterialRequestStatus: Draft | Pending | WaitingApproval | Approved | Rejected | Cancelled
        var mr = new MaterialRequest
        {
            PhaseId        = phase.PhaseId,
            Reason         = "Xin cấp vật tư thi công theo kế hoạch giai đoạn",
            Status         = "Approved",      // đã qua kế toán duyệt
            BOQCheckStatus = "WithinBOQ",     // BOQCheckStatus.WithinBOQ
            CheckedBy      = ketoan.UserId,
            ApprovedBy     = gd.UserId,
            AccountantNote = "Đã đối chiếu định mức – hợp lệ, tạo PO",
            CreatedAt      = DateTime.UtcNow.AddDays(-20),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr);
        await context.SaveChangesAsync();

        // PurchaseOrderStatus: Draft | Sent | PartiallyReceived | FullyReceived | Closed
        var po = new PurchaseOrder
        {
            RequestId            = mr.RequestId,
            SupplierId           = suppliers.First().SupplierId,
            PONumber             = $"PO-{rnd.Next(1000, 9999)}",
            OrderDate            = DateTime.UtcNow.AddDays(-19),
            ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-15)),
            Status               = "FullyReceived",   // PurchaseOrderStatus.FullyReceived
            TotalAmount          = 5_000_000,
            CreatedAt            = DateTime.UtcNow.AddDays(-19),
            CreatedBy            = ketoan.UserId
        };
        context.PurchaseOrders.Add(po);
        await context.SaveChangesAsync();

        // GoodsReceiptStatus: Draft | Approved
        var gr = new GoodsReceipt
        {
            POId          = po.POId,
            ReceiptNo     = $"GR-{rnd.Next(1000, 9999)}",
            DelivererInfo = "Tài xế NCC",
            DeliveryDocNo = $"DOC-{rnd.Next(100, 999)}",
            Status        = "Approved",    // GoodsReceiptStatus.Approved
            CreatedAt     = DateTime.UtcNow.AddDays(-15),
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(gr);
        await context.SaveChangesAsync();

        foreach (var mat in catalogs.Take(4))
        {
            decimal qty = mat.Name.Contains("Thép") ? 5000 : 100;

            context.MaterialRequestItems.Add(new MaterialRequestItem
            {
                RequestId      = mr.RequestId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                ConversionRate = 1,
                IsOverBOQ      = false
            });
            context.PurchaseOrderItems.Add(new PurchaseOrderItem
            {
                POId           = po.POId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                UnitPrice      = 10_000,
                LineTotal      = qty * 10_000,
                ConversionRate = 1
            });
            context.GoodsReceiptItems.Add(new GoodsReceiptItem
            {
                ReceiptId      = gr.ReceiptId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                ConversionRate = 1
            });

            // Cập nhật kho ảo
            var inv = await context.CurrentInventories.FirstOrDefaultAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == mat.MaterialId);

            if (inv == null)
            {
                inv = new CurrentInventory
                {
                    ProjectId        = project.ProjectId,
                    MaterialId       = mat.MaterialId,
                    UnitId           = mat.BaseUnitId,
                    Quantity         = qty,
                    ReservedQuantity = 0,
                    LastUpdated      = DateTime.UtcNow
                };
                context.CurrentInventories.Add(inv);
            }
            else
            {
                inv.Quantity   += qty;
                inv.LastUpdated = DateTime.UtcNow;
            }
        }
        await context.SaveChangesAsync();

        // Ghi thẻ kho (InventoryTransaction) cho phiếu nhập kho đầu tiên
        foreach (var mat in catalogs.Take(4))
        {
            decimal qty = mat.Name.Contains("Thép") ? 5000 : 100;
            var inv = await context.CurrentInventories.FirstAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == mat.MaterialId);
            
            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProjectId = project.ProjectId,
                MaterialId = mat.MaterialId,
                TransactionType = 1, // GoodsReceipt
                ReferenceId = gr.ReceiptId,
                QuantityChange = qty,
                BalanceAfter = inv.Quantity,
                CreatedBy = leader.UserId,
                CreatedAt = DateTime.UtcNow.AddDays(-15)
            });
        }
        await context.SaveChangesAsync();

        // Seed an additional PO with status 'Sent' (waiting for receipt) to test receiving goods
        var mr2 = new MaterialRequest
        {
            PhaseId        = phase.PhaseId,
            Reason         = "Xin cấp vật tư bổ sung phục vụ đổ bê tông dầm sàn",
            Status         = "Approved",
            BOQCheckStatus = "OverBOQ",
            CheckedBy      = ketoan.UserId,
            ApprovedBy     = gd.UserId,
            AccountantNote = "Vượt định mức. Đã giải trình hợp lệ và được Giám đốc duyệt.",
            CreatedAt      = DateTime.UtcNow.AddDays(-5),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr2);
        await context.SaveChangesAsync();

        var po2 = new PurchaseOrder
        {
            RequestId            = mr2.RequestId,
            SupplierId           = suppliers.Skip(1).FirstOrDefault()?.SupplierId ?? suppliers.First().SupplierId,
            PONumber             = $"PO-WAIT-{rnd.Next(1000, 9999)}",
            OrderDate            = DateTime.UtcNow.AddDays(-4),
            ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            Status               = "Sent",   // Đang chờ giao!
            TotalAmount          = 3_500_000,
            CreatedAt            = DateTime.UtcNow.AddDays(-4),
            CreatedBy            = ketoan.UserId
        };
        context.PurchaseOrders.Add(po2);
        await context.SaveChangesAsync();

        foreach (var mat in catalogs.Take(3))
        {
            decimal qty = mat.Name.Contains("Thép") ? 2000 : 100;
            bool isItemOver = mat.Name.Contains("Thép");
            context.MaterialRequestItems.Add(new MaterialRequestItem
            {
                RequestId      = mr2.RequestId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                ConversionRate = 1,
                IsOverBOQ      = isItemOver
            });
            context.PurchaseOrderItems.Add(new PurchaseOrderItem
            {
                POId           = po2.POId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                UnitPrice      = 10_000,
                LineTotal      = qty * 10_000,
                ConversionRate = 1
            });
        }
        await context.SaveChangesAsync();

        // Seed another PO with status 'PartiallyReceived' (partially received) to test remaining receipt validation
        var mr3 = new MaterialRequest
        {
            PhaseId        = phase.PhaseId,
            Reason         = "Xin cấp vật tư đợt 3 xây thô",
            Status         = "Approved",
            BOQCheckStatus = "WithinBOQ",
            CheckedBy      = ketoan.UserId,
            ApprovedBy     = gd.UserId,
            AccountantNote = "Hợp lệ, duyệt mua đợt 3",
            CreatedAt      = DateTime.UtcNow.AddDays(-10),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr3);
        await context.SaveChangesAsync();

        var po3 = new PurchaseOrder
        {
            RequestId            = mr3.RequestId,
            SupplierId           = suppliers.Skip(2).FirstOrDefault()?.SupplierId ?? suppliers.First().SupplierId,
            PONumber             = $"PO-PARTIAL-{rnd.Next(1000, 9999)}",
            OrderDate            = DateTime.UtcNow.AddDays(-9),
            ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            Status               = "PartiallyReceived",   // Nhận một phần!
            TotalAmount          = 8_000_000,
            CreatedAt            = DateTime.UtcNow.AddDays(-9),
            CreatedBy            = ketoan.UserId
        };
        context.PurchaseOrders.Add(po3);
        await context.SaveChangesAsync();

        // Create PO items
        var materialsForPO3 = catalogs.Take(2).ToList();
        var po3Items = new List<PurchaseOrderItem>();
        foreach (var mat in materialsForPO3)
        {
            decimal qty = mat.Name.Contains("Xi măng") ? 100 : 200;
            var poItem = new PurchaseOrderItem
            {
                POId           = po3.POId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                UnitPrice      = 15_000,
                LineTotal      = qty * 15_000,
                ConversionRate = 1
            };
            po3Items.Add(poItem);
            context.MaterialRequestItems.Add(new MaterialRequestItem
            {
                RequestId      = mr3.RequestId,
                MaterialId     = mat.MaterialId,
                UnitId         = mat.BaseUnitId,
                Quantity       = qty,
                ConversionRate = 1,
                IsOverBOQ      = false
            });
            context.PurchaseOrderItems.Add(poItem);
        }
        await context.SaveChangesAsync();

        // Create a Goods Receipt for PO 3 where some quantities are already received
        var gr3 = new GoodsReceipt
        {
            POId          = po3.POId,
            ReceiptNo     = $"GR-PARTIAL-{rnd.Next(1000, 9999)}",
            DelivererInfo = "Tài xế NCC Giao Đợt 1",
            DeliveryDocNo = $"DOC-PART-{rnd.Next(100, 999)}",
            Status        = "Approved",
            CreatedAt     = DateTime.UtcNow.AddDays(-5),
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(gr3);
        await context.SaveChangesAsync();

        foreach (var poItem in po3Items)
        {
            decimal receivedQty = poItem.Material.Name.Contains("Xi măng") ? 40 : 120;
            context.GoodsReceiptItems.Add(new GoodsReceiptItem
            {
                ReceiptId      = gr3.ReceiptId,
                MaterialId     = poItem.MaterialId,
                UnitId         = poItem.UnitId,
                Quantity       = receivedQty,
                ConversionRate = poItem.ConversionRate
            });

            // Update Current Inventory for project
            var inv = await context.CurrentInventories.FirstOrDefaultAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == poItem.MaterialId);
            
            decimal baseQty = receivedQty / (poItem.ConversionRate > 0 ? poItem.ConversionRate : 1);
            if (inv == null)
            {
                inv = new CurrentInventory
                {
                    ProjectId        = project.ProjectId,
                    MaterialId       = poItem.MaterialId,
                    UnitId           = poItem.Material.BaseUnitId,
                    Quantity         = baseQty,
                    ReservedQuantity = 0,
                    LastUpdated      = DateTime.UtcNow
                };
                context.CurrentInventories.Add(inv);
            }
            else
            {
                inv.Quantity   += baseQty;
                inv.LastUpdated = DateTime.UtcNow;
            }
        }
        await context.SaveChangesAsync();

        // Ghi thẻ kho (InventoryTransaction) cho phiếu nhập kho thứ hai (nhập một phần)
        foreach (var poItem in po3Items)
        {
            decimal receivedQty = poItem.Material.Name.Contains("Xi măng") ? 40 : 120;
            var inv = await context.CurrentInventories.FirstAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == poItem.MaterialId);
            
            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProjectId = project.ProjectId,
                MaterialId = poItem.MaterialId,
                TransactionType = 1, // GoodsReceipt
                ReferenceId = gr3.ReceiptId,
                QuantityChange = receivedQty,
                BalanceAfter = inv.Quantity,
                CreatedBy = leader.UserId,
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            });
        }
        await context.SaveChangesAsync();

        return (po, gr);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MATERIAL ISSUANCE – xuất kho gắn task
    // Mô phỏng leader xuất vật tư từ kho để dùng cho một task đang thi công
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedMaterialIssuanceAsync(
        AppDbContext context,
        ProjectTask task,
        Project project,
        List<MaterialCatalog> catalogs,
        List<Unit> units,
        Random rnd)
    {
        // Lấy 2 loại vật tư đầu tiên có trong kho để xuất dùng
        var matsToIssue = catalogs.Take(2).ToList();

        var issuance = new MaterialIssuance
        {
            TaskId    = task.TaskId,
            Purpose   = $"Xuất vật tư thi công task: {task.Name}",
            CreatedAt = DateTime.UtcNow.AddDays(-14),
            CreatedBy = task.CreatedBy    // leader hoặc kỹ sư
        };
        context.MaterialIssuances.Add(issuance);
        await context.SaveChangesAsync();

        foreach (var mat in matsToIssue)
        {
            decimal issueQty = mat.Name.Contains("Thép") ? 500 : 20; // 500kg thép hoặc 20 bao xi măng

            context.MaterialIssuanceItems.Add(new MaterialIssuanceItem
            {
                MaterialIssuanceId = issuance.MaterialIssuanceId,
                MaterialId         = mat.MaterialId,
                UnitId             = mat.BaseUnitId,
                Quantity           = issueQty,
                ConversionRate     = 1
            });

            // Trừ tồn kho ảo
            var inv = await context.CurrentInventories.FirstOrDefaultAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == mat.MaterialId);

            if (inv != null && inv.Quantity >= issueQty)
            {
                inv.Quantity   -= issueQty;
                inv.LastUpdated = DateTime.UtcNow;
            }
        }
        await context.SaveChangesAsync();

        // Ghi thẻ kho (InventoryTransaction) cho việc xuất kho thi công
        foreach (var mat in matsToIssue)
        {
            decimal issueQty = mat.Name.Contains("Thép") ? 500 : 20;
            var inv = await context.CurrentInventories.FirstOrDefaultAsync(
                ci => ci.ProjectId == project.ProjectId && ci.MaterialId == mat.MaterialId);
            
            if (inv != null)
            {
                context.InventoryTransactions.Add(new InventoryTransaction
                {
                    ProjectId = project.ProjectId,
                    MaterialId = mat.MaterialId,
                    TransactionType = 2, // Issuance (Xuất kho)
                    ReferenceId = issuance.MaterialIssuanceId,
                    QuantityChange = -issueQty,
                    BalanceAfter = inv.Quantity,
                    CreatedBy = task.CreatedBy,
                    CreatedAt = DateTime.UtcNow.AddDays(-14)
                });
            }
        }
        await context.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DIRECT PURCHASE – mua khẩn cấp tại công trường
    // Nghiệp vụ: Leader mua ngoài kèm ảnh hóa đơn, hệ thống auto sinh PO + nhập kho
    // DirectPurchaseStatus: Draft | Approved | Rejected
    // DirectPurchaseAuditStatus: PendingAudit | Audited | Rejected
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedDirectPurchaseAsync(
        AppDbContext context,
        Project project,
        User leader, User ketoan,
        List<MaterialCatalog> catalogs,
        List<Unit> units,
        Random rnd)
    {
        // Chọn 1 vật tư trong BOQ để mua khẩn cấp (xi măng – vật tư thường cần gấp)
        var matKhanCap = catalogs.First(c => c.Name.Contains("Xi măng"));

        decimal dpQty      = rnd.Next(10, 30);         // 10-30 bao xi măng
        decimal dpUnitPrice = 95_000;                   // 95,000 VNĐ/bao
        decimal dpTotal    = dpQty * dpUnitPrice;

        // DirectPurchaseRequest: Status=Approved (đã hệ thống duyệt – within BOQ)
        var dp = new DirectPurchaseRequest
        {
            ProjectId    = project.ProjectId,
            PhaseId      = (await context.Phases
                               .Where(p => p.ProjectId == project.ProjectId)
                               .FirstAsync()).PhaseId,
            RequestedBy  = leader.UserId,
            Reason       = "Thiếu xi măng khẩn cấp để đổ bê tông cột, không kịp đặt hàng qua quy trình thông thường",
            Status       = "Approved",         // DirectPurchaseStatus.Approved – within BOQ nên auto duyệt
            AuditStatus  = "Audited",          // DirectPurchaseAuditStatus.Audited – kế toán đã soát
            TotalAmount  = dpTotal,
            PurchaseDate = DateTime.UtcNow.AddDays(-7),
            AuditedBy    = ketoan.UserId,
            AuditedAt    = DateTime.UtcNow.AddDays(-6),
            AuditNote    = "Đã kiểm tra hóa đơn và đối chiếu BOQ – hợp lệ, phê duyệt giải ngân.",
            CreatedAt    = DateTime.UtcNow.AddDays(-7),
            CreatedBy    = leader.UserId
        };
        context.DirectPurchaseRequests.Add(dp);
        await context.SaveChangesAsync();

        context.DirectPurchaseItems.Add(new DirectPurchaseItem
        {
            DirectPurchaseId = dp.DirectPurchaseId,
            MaterialId       = matKhanCap.MaterialId,
            UnitId           = matKhanCap.BaseUnitId,
            Quantity         = dpQty,
            ConversionRate   = 1,
            UnitPrice        = dpUnitPrice,
            LineTotal        = dpTotal
        });
        await context.SaveChangesAsync();

        // Auto sinh MaterialRequest placeholder cho Direct Purchase PO
        // (RequestId là non-nullable, cần một MR để tham chiếu)
        var dpMR = new MaterialRequest
        {
            PhaseId        = dp.PhaseId,
            Reason         = "[Auto] Direct Purchase – " + dp.Reason,
            Status         = "Approved",
            BOQCheckStatus = "WithinBOQ",
            CheckedBy      = null,
            ApprovedBy     = null,
            AccountantNote = "Auto-generated từ Direct Purchase",
            CreatedAt      = DateTime.UtcNow.AddDays(-7),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(dpMR);
        await context.SaveChangesAsync();

        // Auto sinh PO từ mua khẩn cấp
        var autoPO = new PurchaseOrder
        {
            RequestId            = dpMR.RequestId,         // tham chiếu MR placeholder
            SupplierId           = null,                   // mua tại chỗ, không có NCC trong hệ thống
            PONumber             = $"DP-PO-{rnd.Next(100, 999)}",
            OrderDate            = DateTime.UtcNow.AddDays(-7),
            ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            Status               = "FullyReceived",        // nhận ngay tại chỗ
            TotalAmount          = dpTotal,
            CreatedAt            = DateTime.UtcNow.AddDays(-7),
            CreatedBy            = leader.UserId
        };
        context.PurchaseOrders.Add(autoPO);
        await context.SaveChangesAsync();

        // Cập nhật AutoPOId vào DirectPurchaseRequest
        dp.AutoPOId = autoPO.POId;

        // Auto sinh GoodsReceipt
        var autoGR = new GoodsReceipt
        {
            POId          = autoPO.POId,
            ReceiptNo     = $"DP-GR-{rnd.Next(100, 999)}",
            DelivererInfo = "Mua tại cửa hàng địa phương",
            DeliveryDocNo = $"INV-{rnd.Next(1000, 9999)}",
            Status        = "Approved",
            CreatedAt     = DateTime.UtcNow.AddDays(-7),
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(autoGR);
        await context.SaveChangesAsync();

        dp.AutoReceiptId = autoGR.ReceiptId;

        context.PurchaseOrderItems.Add(new PurchaseOrderItem
        {
            POId           = autoPO.POId,
            MaterialId     = matKhanCap.MaterialId,
            UnitId         = matKhanCap.BaseUnitId,
            Quantity       = dpQty,
            UnitPrice      = dpUnitPrice,
            LineTotal      = dpTotal,
            ConversionRate = 1
        });
        context.GoodsReceiptItems.Add(new GoodsReceiptItem
        {
            ReceiptId      = autoGR.ReceiptId,
            MaterialId     = matKhanCap.MaterialId,
            UnitId         = matKhanCap.BaseUnitId,
            Quantity       = dpQty,
            ConversionRate = 1
        });

        // Tăng tồn kho ảo ngay lập tức (auto khi mua khẩn cấp)
        var inv = await context.CurrentInventories.FirstOrDefaultAsync(
            ci => ci.ProjectId == project.ProjectId && ci.MaterialId == matKhanCap.MaterialId);

        if (inv == null)
        {
            context.CurrentInventories.Add(new CurrentInventory
            {
                ProjectId        = project.ProjectId,
                MaterialId       = matKhanCap.MaterialId,
                UnitId           = matKhanCap.BaseUnitId,
                Quantity         = dpQty,
                ReservedQuantity = 0,
                LastUpdated      = DateTime.UtcNow
            });
        }
        else
        {
            inv.Quantity   += dpQty;
            inv.LastUpdated = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INCIDENT + INVENTORY ADJUSTMENT
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedIncidentAsync(
        AppDbContext context,
        Project project, ProjectTask task,
        User ksA, User leader, User tpkt, User gd, User ketoan,
        List<MaterialCatalog> catalogs, List<Unit> units,
        Random rnd)
    {
        // IncidentStatus: Reported | WaitingReview | Resolved | Closed
        var incident = new Incident
        {
            ProjectId             = project.ProjectId,
            TaskId                = task.TaskId,
            ReportedBy            = ksA.UserId,      // SE tạo báo cáo sự cố
            ReviewedBy            = tpkt.UserId,     // TPKT thẩm định
            IncidentType          = "NgoaiLuc",      // IncidentType.NgoaiLuc
            Description           = "Mưa lớn bất ngờ gây ngập hố móng, toàn bộ xi măng trong kho bị ướt hỏng",
            Status                = "Resolved",      // IncidentStatus.Resolved
            DamageDescription     = "30 bao xi măng PCB40 bị ướt và đóng cứng, không thể sử dụng",
            EstimatedMaterialLoss = 30,
            EstimatedLaborDays    = 3,
            EstimatedDelayDays    = 3,
            ProposedAction        = "Tạo phiếu giảm tồn kho 30 bao xi măng hỏng, yêu cầu cấp thêm vật tư",
            CreatedAt             = DateTime.UtcNow.AddDays(-10),
            CreatedBy             = leader.UserId
        };
        context.Incidents.Add(incident);
        await context.SaveChangesAsync();

        // InventoryAdjustment (Decrease) do sự cố – Kế toán lập, Giám đốc duyệt
        // InventoryAdjustmentStatus: Draft | Pending | Approved | Rejected
        var adj = new InventoryAdjustment
        {
            ProjectId      = project.ProjectId,
            PhaseId        = task.PhaseId,
            AdjustmentType = "Decrease",    // InventoryAdjustmentType.Decrease
            Reason         = "Sự cố ngập nước – xi măng bị hỏng trong kho",
            Description    = "Giảm 30 bao xi măng PCB40 bị ướt do mưa ngập hố móng ngày " +
                             DateTime.UtcNow.AddDays(-10).ToString("dd/MM/yyyy"),
            Status         = "Approved",    // đã được Giám đốc phê duyệt
            ApprovedBy     = gd.UserId,
            ApprovedAt     = DateTime.UtcNow.AddDays(-9),
            CreatedAt      = DateTime.UtcNow.AddDays(-9),
            CreatedBy      = ketoan.UserId  // Kế toán lập dựa trên Incident Report
        };
        context.InventoryAdjustments.Add(adj);
        await context.SaveChangesAsync();

        // AdjustmentItem – chi tiết vật tư bị điều chỉnh
        var matXiMang = catalogs.First(c => c.Name.Contains("Xi măng"));
        context.AdjustmentItems.Add(new AdjustmentItem
        {
            AdjustmentId   = adj.AdjustmentId,
            MaterialId     = matXiMang.MaterialId,
            UnitId         = matXiMang.BaseUnitId,
            Quantity       = 30,
            ConversionRate = 1
        });

        // Trừ tồn kho
        var inv = await context.CurrentInventories.FirstOrDefaultAsync(
            ci => ci.ProjectId == project.ProjectId && ci.MaterialId == matXiMang.MaterialId);

        if (inv != null && inv.Quantity >= 30)
        {
            inv.Quantity   -= 30;
            inv.LastUpdated = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SURPLUS REQUEST for Completed projects
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedSurplusAsync(AppDbContext context, Project project, User leader)
    {
        var invItems = await context.CurrentInventories
            .Where(c => c.ProjectId == project.ProjectId && c.Quantity > 0)
            .ToListAsync();

        if (!invItems.Any()) return;

        // SurplusRequestStatus: Draft | Processing | Processed
        var surplus = new SurplusRequest
        {
            ProjectId = project.ProjectId,
            Reason    = "Kết thúc dự án – vật tư dư thừa cần xử lý theo quy trình",
            Status    = "Processed",    // SurplusRequestStatus.Processed
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            CreatedBy = leader.UserId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        foreach (var inv in invItems)
        {
            // SurplusRequestItemStatus: Pending | Processing | Completed | Cancelled
            context.SurplusRequestItems.Add(new SurplusRequestItem
            {
                SurplusRequestId = surplus.SurplusRequestId,
                MaterialId       = inv.MaterialId,
                UnitId           = inv.UnitId,
                Quantity         = inv.Quantity,
                ConversionRate   = 1,
                Status           = "Completed"   // SurplusRequestItemStatus.Completed
            });
            inv.Quantity    = 0;
            inv.LastUpdated = DateTime.UtcNow;
        }
        await context.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedNotificationsAsync(AppDbContext context, Dictionary<string, User> users)
    {
        var gd     = users["giamdoc@bpg.com"];
        var tpkt   = users["tpkt@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];

        context.Notifications.AddRange(
            new Notification
            {
                UserId    = gd.UserId,
                Title     = "Chào mừng",
                Content   = "Chào mừng Giám đốc đến với hệ thống BPG CMS.",
                IsRead    = false,
                CreatedAt = DateTime.UtcNow
            },
            new Notification
            {
                UserId    = tpkt.UserId,
                Title     = "Nhắc nhở nghiệm thu",
                Content   = "Phase Móng – Dự án Chung cư SkyView đã đạt 100%, sẵn sàng nghiệm thu.",
                IsRead    = false,
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new Notification
            {
                UserId    = ketoan.UserId,
                Title     = "Yêu cầu vật tư mới",
                Content   = "Có yêu cầu vật tư mới từ dự án Trường quốc tế Á Châu đang chờ kiểm tra.",
                IsRead    = false,
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            }
        );
        await context.SaveChangesAsync();
    }
}
