using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        await context.Database.MigrateAsync();

        if (await context.Units.AnyAsync() && await context.Projects.AnyAsync())
            return;

        var users      = await SeedAuthAsync(context);
        var masterData = await SeedMasterDataAsync(context);
        var catalogs   = await SeedMaterialsAsync(context, masterData.Units, masterData.Categories);
        var projects   = await SeedProjectsAsync(context, users, masterData.Units, catalogs);
        await SeedProcurementAsync(context, projects, catalogs, masterData.Suppliers, users);
        await SeedIssuancesAsync(context, projects, catalogs, users);
        await SeedIncidentsAndAdjustmentsAsync(context, projects, catalogs, users);
        await SeedSurplusAsync(context, projects, catalogs, users);
        await SeedNotificationsAsync(context, users);
    }

    // ====================================================================
    // 1. USERS & ROLES
    // ====================================================================
    private static async Task<Dictionary<string, User>> SeedAuthAsync(AppDbContext context)
    {
        var result = new Dictionary<string, User>();
        if (await context.Users.AnyAsync())
        {
            var all = await context.Users.ToListAsync();
            foreach (var u in all) result[u.Email] = u;
            return result;
        }

        var seed = new List<(string Email, string HoTen, string Role, string DienThoai)>
        {
            ("admin@bpg.com",    "Nguyễn Văn Hải",        "Admin",            "0901 234 567"),
            ("giamdoc@bpg.com",  "Trần Quốc Hùng",         "Director",         "0912 345 678"),
            ("tpkt@bpg.com",     "Lê Minh Tuấn",           "TechnicalManager", "0923 456 789"),
            ("leader1@bpg.com",  "Phạm Văn Đức",           "ProjectLeader",    "0934 567 890"),
            ("leader2@bpg.com",  "Hoàng Thị Lan",          "ProjectLeader",    "0945 111 222"),
            ("leader3@bpg.com",  "Đinh Văn Cường",         "ProjectLeader",    "0945 333 444"),
            ("leader4@bpg.com",  "Nguyễn Trọng Tài",       "ProjectLeader",    "0945 555 666"),
            ("leader5@bpg.com",  "Lê Bá Tòng",             "ProjectLeader",    "0945 777 888"),
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

    // ====================================================================
    // 2. MASTER DATA: Đơn vị, NCC, Danh mục, Cấu hình
    // ====================================================================
    record MasterData(List<Unit> Units, List<MaterialCategory> Categories, List<Supplier> Suppliers);

    private static async Task<MasterData> SeedMasterDataAsync(AppDbContext context)
    {
        // Đơn vị tính
        var units = await context.Units.ToListAsync();
        if (!units.Any())
        {
            units = new List<Unit>
            {
                new() { UnitCode = "BAO",   UnitName = "Bao (50kg)" },
                new() { UnitCode = "KG",    UnitName = "Kilôgam" },
                new() { UnitCode = "TAN",   UnitName = "Tấn" },
                new() { UnitCode = "M3",    UnitName = "Mét khối" },
                new() { UnitCode = "M2",    UnitName = "Mét vuông" },
                new() { UnitCode = "MET",   UnitName = "Mét dài" },
                new() { UnitCode = "CAI",   UnitName = "Cái" },
                new() { UnitCode = "BO",    UnitName = "Bộ" },
                new() { UnitCode = "CUON",  UnitName = "Cuộn" },
                new() { UnitCode = "THUNG", UnitName = "Thùng" },
            };
            context.Units.AddRange(units);
            await context.SaveChangesAsync();
        }

        // Nhà cung cấp
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

        // Danh mục vật tư
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

        // Cấu hình hệ thống
        if (!await context.SystemConfigs.AnyAsync())
        {
            context.SystemConfigs.AddRange(
                new SystemConfig { ConfigKey = "NguongTonKhoThap",    ConfigValue = "10",  DataType = "decimal", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "HanHuyPhieuNgay",     ConfigValue = "7",   DataType = "int",     CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "PhanTramTreKyVong",    ConfigValue = "15",  DataType = "decimal", CreatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        return new MasterData(units, cats, suppliers);
    }

    // ====================================================================
    // 3. DANH MỤC VẬT TƯ (23 loại)
    // ====================================================================
    private static async Task<List<MaterialCatalog>> SeedMaterialsAsync(AppDbContext context, List<Unit> units, List<MaterialCategory> cats)
    {
        var catalogs = await context.MaterialCatalogs.ToListAsync();
        if (catalogs.Any()) return catalogs;

        Unit Bao(string code)   => units.First(u => u.UnitCode == code);
        MaterialCategory Cat(string name) => cats.First(c => c.CategoryName == name);

        catalogs = new List<MaterialCatalog>
        {
            // Xi măng
            new() { Code="VT-001", Name="Xi măng Hà Tiên PCB40",               Specification="Bao 50kg, TCVN 6260:2009, mác 400",                    CategoryId=Cat("Xi măng").CategoryId,                   BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-002", Name="Xi măng Hà Tiên PCB50",               Specification="Bao 50kg, cường độ cao, dùng kết cấu chịu lực",        CategoryId=Cat("Xi măng").CategoryId,                   BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-003", Name="Xi măng trắng Hải Phòng",             Specification="Bao 25kg, dùng trang trí hoàn thiện",                  CategoryId=Cat("Xi măng").CategoryId,                   BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            // Sắt thép
            new() { Code="VT-010", Name="Thép cuộn tròn trơn CB240-T D6",      Specification="Pomina, cuộn ~50kg, TCVN 1651-1:2018",                 CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("TAN").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-011", Name="Thép cuộn vằn CB300-V D8",            Specification="Pomina, cuộn ~50kg, TCVN 1651-2:2018",                 CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("TAN").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-012", Name="Thép thanh vằn CB300-V D10",          Specification="Pomina, cây 11.7m, TCVN 1651-2:2018",                  CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("TAN").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-013", Name="Thép thanh vằn CB300-V D12",          Specification="Pomina, cây 11.7m, TCVN 1651-2:2018",                  CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("TAN").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-014", Name="Thép hộp vuông 40x40x1.5mm",          Specification="Cây 6m, mạ kẽm nhúng nóng, dùng khung cửa",            CategoryId=Cat("Sắt thép xây dựng").CategoryId,         BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
            // Cát đá
            new() { Code="VT-020", Name="Cát vàng xây dựng (cát sông Đồng Nai)", Specification="Sạch, mô đun độ lớn 2.5-3.0, không lẫn bùn sét",    CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            new() { Code="VT-021", Name="Cát mịn trát tường",                  Specification="Mô đun độ lớn <1.5, đảm bảo TCVN 7570",               CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            new() { Code="VT-022", Name="Đá dăm 1x2 (đá 4x6)",                Specification="Đá nghiền Đồng Nai, kích thước 10-20mm",                CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            new() { Code="VT-023", Name="Đá dăm 0.5x1 (đá 2x4)",              Specification="Đá nghiền, kích thước 5-10mm, dùng bê tông mác cao",    CategoryId=Cat("Cát đá vật liệu rời").CategoryId,       BaseUnitId=Bao("M3").UnitId,  CreatedAt=DateTime.UtcNow },
            // Gạch
            new() { Code="VT-030", Name="Gạch ống 4 lỗ 8x8x19cm",             Specification="Mác 75, TCVN 1450:2009, xây tường 100",                CategoryId=Cat("Gạch xây dựng").CategoryId,             BaseUnitId=Bao("CAI").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-031", Name="Gạch thẻ đặc 4x8x19cm",              Specification="Mác 100, TCVN 1450:2009, xây tường bao",                CategoryId=Cat("Gạch xây dựng").CategoryId,             BaseUnitId=Bao("CAI").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-032", Name="Gạch block bê tông 10x20x40cm",       Specification="Mác 100, dùng tường móng, tường bao ngoài",             CategoryId=Cat("Gạch xây dựng").CategoryId,             BaseUnitId=Bao("CAI").UnitId, CreatedAt=DateTime.UtcNow },
            // Sơn & hoàn thiện
            new() { Code="VT-040", Name="Sơn lót kháng kiềm Kova KP",         Specification="Thùng 18 lít, phủ 90-100m²/thùng",                     CategoryId=Cat("Sơn & vật liệu hoàn thiện").CategoryId, BaseUnitId=Bao("THUNG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-041", Name="Sơn nước nội thất Kova A910",         Specification="Thùng 18 lít, bóng mờ, kháng mốc, kháng khuẩn",       CategoryId=Cat("Sơn & vật liệu hoàn thiện").CategoryId, BaseUnitId=Bao("THUNG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-042", Name="Bột bả tường nội thất Bảo Thạch",    Specification="Bao 20kg, chống ẩm, phẳng mịn",                        CategoryId=Cat("Sơn & vật liệu hoàn thiện").CategoryId, BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            // Điện
            new() { Code="VT-050", Name="Dây cáp điện đôi Trần Phú 2x1.5mm²", Specification="Cuộn 100m, vỏ PVC chịu nhiệt 70°C, chịu tải 13A",    CategoryId=Cat("Thiết bị điện").CategoryId,             BaseUnitId=Bao("CUON").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-051", Name="Dây cáp điện đôi Trần Phú 2x2.5mm²", Specification="Cuộn 100m, chịu tải 16A, ổ cắm & điều hòa",           CategoryId=Cat("Thiết bị điện").CategoryId,             BaseUnitId=Bao("CUON").UnitId, CreatedAt=DateTime.UtcNow },
            // Nước
            new() { Code="VT-060", Name="Ống nhựa PVC Tiền Phong Phi 90",     Specification="Cây 4m, áp lực PN10, tiêu chuẩn TCVN 6151",            CategoryId=Cat("Vật liệu cấp thoát nước").CategoryId,   BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-061", Name="Ống nhựa PVC Tiền Phong Phi 50",     Specification="Cây 4m, thoát nước sàn, ban công",                     CategoryId=Cat("Vật liệu cấp thoát nước").CategoryId,   BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="VT-062", Name="Ống nước PPR Dekko Phi 21",           Specification="Cây 4m, dùng cho đường nước nóng/lạnh âm tường",       CategoryId=Cat("Vật liệu cấp thoát nước").CategoryId,   BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
        };

        context.MaterialCatalogs.AddRange(catalogs);
        await context.SaveChangesAsync();
        return catalogs;
    }

    // ====================================================================
    // 4. DỰ ÁN, PHASE, TASK, BOQ, NHẬT KÝ, NGHIỆM THU
    // ====================================================================
    private static async Task<List<Project>> SeedProjectsAsync(AppDbContext context, Dictionary<string, User> users, List<Unit> units, List<MaterialCatalog> catalogs)
    {
        var projects = await context.Projects.ToListAsync();
        if (projects.Any()) return projects;

        var tpkt   = users["tpkt@bpg.com"];
        var ld1    = users["leader1@bpg.com"];
        var ld2    = users["leader2@bpg.com"];
        var ld3    = users["leader3@bpg.com"];
        var ld4    = users["leader4@bpg.com"];
        var ld5    = users["leader5@bpg.com"];
        var ks1    = users["kysu1@bpg.com"];
        var ks2    = users["kysu2@bpg.com"];
        var ks3    = users["kysu3@bpg.com"];
        var ks4    = users["kysu4@bpg.com"];
        var ks5    = users["kysu5@bpg.com"];
        var ks6    = users["kysu6@bpg.com"];
        var ks7    = users["kysu7@bpg.com"];
        var ks8    = users["kysu8@bpg.com"];
        var ks9    = users["kysu9@bpg.com"];
        var ks10   = users["kysu10@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var dsDuAn = new[]
        {
            new { Ten="Khu nhà ở thương mại Hưng Phú – Giai đoạn 1",       DiaChi="Đường Hưng Phú, P.9, Q.8, TP.HCM",                     BatDau=today.AddDays(-180), KetThuc=today.AddDays(90),  TrangThai="InProgress", Leader=ld1, KsA=ks1, KsB=ks2 },
            new { Ten="Chung cư cao tầng SkyView Bình Dương",               DiaChi="Đại lộ Bình Dương, TX. Thuận An, Bình Dương",           BatDau=today.AddDays(-90),  KetThuc=today.AddDays(180), TrangThai="InProgress", Leader=ld2, KsA=ks3, KsB=ks4 },
            new { Ten="Trường tiểu học Lê Văn Tám – TP. Biên Hòa",         DiaChi="Khu phố 5, P. Tân Hiệp, TP. Biên Hòa, Đồng Nai",      BatDau=today.AddDays(-30),  KetThuc=today.AddDays(240), TrangThai="Planning",   Leader=ld3, KsA=ks5, KsB=ks6 },
            new { Ten="Bệnh viện Đa khoa Phương Đông – Tây Ninh",          DiaChi="Quốc lộ 22B, P. Ninh Sơn, TP. Tây Ninh",               BatDau=today.AddDays(-300), KetThuc=today.AddDays(-10), TrangThai="Completed",  Leader=ld4, KsA=ks7, KsB=ks8 },
            new { Ten="Nhà máy May mặc Thiên Long – KCN Long Hậu",         DiaChi="Lô C-2, KCN Long Hậu, H. Cần Giuộc, Long An",          BatDau=today.AddDays(-10),  KetThuc=today.AddDays(330), TrangThai="Planning",   Leader=ld5, KsA=ks9, KsB=ks10 },
        };

        foreach (var dp in dsDuAn)
        {
            var project = new Project
            {
                Name         = dp.Ten,
                Address      = dp.DiaChi,
                PlannedStart = dp.BatDau,
                PlannedEnd   = dp.KetThuc,
                Status       = dp.TrangThai,
                CreatedAt    = DateTime.UtcNow,
                CreatedBy    = tpkt.UserId
            };
            context.Projects.Add(project);
            await context.SaveChangesAsync();
            projects.Add(project);

            // Thành viên
            context.ProjectMembers.AddRange(
                new ProjectMember { ProjectId=project.ProjectId, UserId=dp.Leader.UserId, IsLeader=true,  JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=dp.KsA.UserId,       IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=dp.KsB.UserId,       IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow }
            );
            await context.SaveChangesAsync();

            // Phases
            var phaseDefs = GetPhaseDefs(dp.TrangThai);
            foreach (var pd in phaseDefs)
            {
                var phase = new Phase
                {
                    ProjectId  = project.ProjectId,
                    Name       = pd.Ten,
                    OrderIndex = pd.ThuTu,
                    Status     = pd.TrangThai,
                    StartDate  = dp.BatDau.AddDays((pd.ThuTu - 1) * 60),
                    EndDate    = dp.BatDau.AddDays(pd.ThuTu * 60),
                    CreatedAt  = DateTime.UtcNow
                };
                context.Phases.Add(phase);
                await context.SaveChangesAsync();

                // BOQ
                var boqMats = catalogs.Take(6).ToList();
                int boqQty = 200;
                foreach (var mat in boqMats)
                {
                    context.BOQItems.Add(new BOQItem
                    {
                        PhaseId        = phase.PhaseId,
                        MaterialId     = mat.MaterialId,
                        UnitId         = mat.BaseUnitId,
                        Quantity       = boqQty,
                        ConversionRate = 1,
                        CreatedAt      = DateTime.UtcNow
                    });
                    boqQty += 100;
                }
                await context.SaveChangesAsync();

                // Nghiệm thu Phase (nếu hoàn thành)
                if (pd.TrangThai == "Completed")
                {
                    var acceptance = new PhaseAcceptance
                    {
                        PhaseId        = phase.PhaseId,
                        AcceptedBy     = tpkt.UserId,
                        AcceptanceDate = DateTime.UtcNow.AddDays(-5),
                        ReportContent  = $"Biên bản nghiệm thu {pd.Ten}: Tất cả các hạng mục thuộc giai đoạn đã hoàn thành đạt 100%, chất lượng thi công đảm bảo theo thiết kế và tiêu chuẩn TCXD hiện hành. Đề nghị chuyển sang giai đoạn tiếp theo.",
                        IsCancelled    = false,
                        CreatedAt      = DateTime.UtcNow,
                        CreatedBy      = tpkt.UserId
                    };
                    context.PhaseAcceptances.Add(acceptance);
                    await context.SaveChangesAsync();
                }

                // Tasks
                var taskDefs = GetTaskDefs(pd.ThuTu, pd.TrangThai);
                int idx = 1;
                foreach (var td in taskDefs)
                {
                    var status   = td.TrangThai;
                    var progress = td.TienDo;

                    var task = new ProjectTask
                    {
                        PhaseId         = phase.PhaseId,
                        Name            = td.Ten,
                        Description     = $"Hạng mục: {td.Ten}. Thi công theo bản vẽ số {phase.PhaseId:D3}-TC-{idx:D2}.",
                        OrderIndex      = idx,
                        StartDate       = phase.StartDate!.Value.AddDays((idx - 1) * 12),
                        EndDate         = phase.StartDate!.Value.AddDays(idx * 12),
                        Status          = status,
                        ProgressPercent = progress,
                        IsLocked        = pd.TrangThai == "Completed",
                        CreatedAt       = DateTime.UtcNow,
                        CreatedBy       = tpkt.UserId
                    };
                    context.Tasks.Add(task);
                    await context.SaveChangesAsync();

                    // Gán kỹ sư
                    context.TaskAssignees.Add(new TaskAssignee { TaskId=task.TaskId, UserId=idx%2==0 ? dp.KsA.UserId : dp.KsB.UserId, AssignedAt=DateTime.UtcNow });
                    await context.SaveChangesAsync();

                    // TaskProgressLog
                    if (progress > 0)
                    {
                        context.TaskProgressLogs.Add(new TaskProgressLog { TaskId=task.TaskId, OldProgress=0,         NewProgress=(byte)(progress/2), UpdateReason="Bắt đầu triển khai thi công" });
                        context.TaskProgressLogs.Add(new TaskProgressLog { TaskId=task.TaskId, OldProgress=(byte)(progress/2), NewProgress=progress,   UpdateReason="Hoàn thành đợt thi công tiếp theo, đạt tiến độ kế hoạch" });
                    }

                    // Nhật ký thi công
                    if (progress > 0)
                    {
                        var log1 = new DailyLog
                        {
                            TaskId             = task.TaskId,
                            LogDate            = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
                            NewProgressPercent = (byte)(progress / 2),
                            Description        = $"Ngày 1 thi công hạng mục [{td.Ten}]: Tổ thợ 10 người bắt đầu triển khai. Thời tiết nắng ráo, thuận lợi. Đã hoàn thành {progress/2}% khối lượng.",
                            CreatedBy          = dp.KsA.UserId,
                            CreatedAt          = DateTime.UtcNow.AddDays(-7)
                        };
                        context.DailyLogs.Add(log1);
                        await context.SaveChangesAsync();

                        var log2 = new DailyLog
                        {
                            TaskId             = task.TaskId,
                            LogDate            = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)),
                            NewProgressPercent = progress,
                            Description        = $"Ngày tiếp theo [{td.Ten}]: Hoàn thành {progress}% khối lượng. Vật tư đầy đủ, không phát sinh sự cố. Chất lượng nghiệm thu sơ bộ đạt yêu cầu.",
                            CreatedBy          = dp.KsB.UserId,
                            CreatedAt          = DateTime.UtcNow.AddDays(-3)
                        };
                        context.DailyLogs.Add(log2);
                        await context.SaveChangesAsync();

                        // Bình luận của Leader vào nhật ký
                        context.Comments.Add(new Comment
                        {
                            LogId     = log2.LogId,
                            AuthorId  = dp.Leader.UserId,
                            Content   = "Tiến độ ổn, anh em chú ý an toàn lao động, đặc biệt khi làm việc trên cao. Nhắc thợ đội nón bảo hộ đầy đủ.",
                            CreatedAt = DateTime.UtcNow.AddDays(-2)
                        });
                        await context.SaveChangesAsync();
                    }
                    idx++;
                }
            }
        }
        return projects;
    }

    static (string Ten, int ThuTu, string TrangThai)[] GetPhaseDefs(string projectStatus) => new[]
    {
        (Ten: "Giai đoạn 1: Chuẩn bị mặt bằng & Ép cọc",            ThuTu: 1, TrangThai: projectStatus is "InProgress" or "Completed" ? "Completed" : "Draft"),
        (Ten: "Giai đoạn 2: Thi công phần thô (Móng – Khung – Sàn)", ThuTu: 2, TrangThai: projectStatus == "InProgress" ? "InProgress" : (projectStatus == "Completed" ? "Completed" : "Draft")),
        (Ten: "Giai đoạn 3: Hoàn thiện nội thất & Bàn giao",         ThuTu: 3, TrangThai: projectStatus == "Completed" ? "Completed" : "Draft"),
    };

    static (string Ten, string TrangThai, byte TienDo)[] GetTaskDefs(int phase, string phaseStatus) => phase switch
    {
        1 => new[]
        {
            ("Khảo sát địa chất & lập biện pháp thi công",              phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Phá dỡ công trình cũ & vận chuyển phế thải ra khỏi công trường", phaseStatus=="Completed"?"Completed":"New",  phaseStatus=="Completed"?(byte)100:(byte)0),
            ("San lấp & lu lèn mặt bằng theo cao độ thiết kế",          phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Định vị tim cọc, ép cọc bê tông đúc sẵn",                 phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Đào đất hố móng theo đúng cao độ & mặt bằng thiết kế",    phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
        },
        2 => new[]
        {
            ("Thi công đài cọc & giằng móng (coffa – thép – đổ BT)",    phaseStatus=="Completed"?"Completed":(phaseStatus=="InProgress"?"InProgress":"New"),  phaseStatus=="Completed"?(byte)100:(phaseStatus=="InProgress"?(byte)70:(byte)0)),
            ("Xây tường bao, tường ngăn tầng 1",                        phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Thi công sàn tầng 2 (lắp thép – đổ bê tông M250)",        phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Thi công cột – dầm – vách BTCT tầng 2 đến tầng mái",      phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Xây tường bao các tầng, đặt cửa sổ chờ sẵn",             phaseStatus=="Completed"?"Completed":"New",         phaseStatus=="Completed"?(byte)100:(byte)0),
        },
        _ => new[]
        {
            ("Trát tường trong và ngoài (vữa xi măng cát 1:4)",          phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Ốp lát gạch ceramic nền & tường nhà vệ sinh",             phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Lắp đặt hệ thống điện hoàn thiện, đi âm tường",          phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Lắp đặt hệ thống cấp thoát nước, thiết bị vệ sinh",       phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Sơn lót kháng kiềm & sơn phủ nội ngoại thất 2 lớp",      phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Lắp cửa đi, cửa sổ nhôm kính, lan can inox",             phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
            ("Tổng vệ sinh & nghiệm thu bàn giao công trình",           phaseStatus=="Completed"?"Completed":"New", phaseStatus=="Completed"?(byte)100:(byte)0),
        }
    };

    // ====================================================================
    // 5. MUA HÀNG & NHẬP KHO (3 dự án đầu)
    // ====================================================================
    private static async Task SeedProcurementAsync(AppDbContext context, List<Project> projects, List<MaterialCatalog> catalogs, List<Supplier> suppliers, Dictionary<string, User> users)
    {
        if (await context.PurchaseOrders.AnyAsync()) return;

        var ketoan = users["ketoan@bpg.com"];
        var gd     = users["giamdoc@bpg.com"];
        var rnd    = new Random(99);

        foreach (var project in projects.Take(3))
        {
            var projectLeaderId = await context.ProjectMembers
                .Where(m => m.ProjectId == project.ProjectId && m.IsLeader)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync();

            if (projectLeaderId == 0) continue;
            var phase = await context.Phases.FirstOrDefaultAsync(p => p.ProjectId == project.ProjectId);
            if (phase == null) continue;

            var selectedMats = catalogs.Skip(rnd.Next(0, 5)).Take(4).ToList();

            // Yêu cầu vật tư
            var mr = new MaterialRequest
            {
                PhaseId        = phase.PhaseId,
                Reason         = $"Xin cấp vật tư đợt 1 thi công giai đoạn 1 – Dự án {project.Name.Split('–')[0].Trim()}",
                Status         = "Approved",
                BOQCheckStatus = "WithinBOQ",
                CheckedBy      = ketoan.UserId,
                ApprovedBy     = gd.UserId,
                AccountantNote = "Đã đối chiếu BOQ, số lượng xin cấp nằm trong định mức, đề nghị duyệt mua.",
                CreatedAt      = DateTime.UtcNow.AddDays(-25),
                CreatedBy      = projectLeaderId
            };
            context.MaterialRequests.Add(mr);
            await context.SaveChangesAsync();

            var reqItems = new List<MaterialRequestItem>();
            foreach (var mat in selectedMats)
            {
                var ri = new MaterialRequestItem { RequestId=mr.RequestId, MaterialId=mat.MaterialId, UnitId=mat.BaseUnitId, Quantity=rnd.Next(80,400), ConversionRate=1, IsOverBOQ=false };
                context.MaterialRequestItems.Add(ri);
                reqItems.Add(ri);
            }
            await context.SaveChangesAsync();

            // Purchase Order
            var sup = suppliers[rnd.Next(suppliers.Count)];
            var po  = new PurchaseOrder
            {
                RequestId            = mr.RequestId,
                SupplierId           = sup.SupplierId,
                PONumber             = $"PO-{DateTime.UtcNow.Year}-{project.ProjectId:D2}{rnd.Next(100,999)}",
                OrderDate            = DateTime.UtcNow.AddDays(-22),
                ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-12)),
                Status               = "FullyReceived",
                TotalAmount          = 0,
                CreatedAt            = DateTime.UtcNow.AddDays(-22),
                CreatedBy            = ketoan.UserId
            };
            context.PurchaseOrders.Add(po);
            await context.SaveChangesAsync();

            decimal total = 0;
            var poItems = new List<PurchaseOrderItem>();
            foreach (var ri in reqItems)
            {
                var price = rnd.Next(80_000, 900_000);
                var line  = ri.Quantity * price;
                total += line;
                poItems.Add(new PurchaseOrderItem { POId=po.POId, MaterialId=ri.MaterialId, UnitId=ri.UnitId, Quantity=ri.Quantity, UnitPrice=price, LineTotal=line, ConversionRate=1 });
            }
            context.PurchaseOrderItems.AddRange(poItems);
            po.TotalAmount = total;
            await context.SaveChangesAsync();

            // Goods Receipt (Phiếu nhập kho)
            var gr = new GoodsReceipt
            {
                POId          = po.POId,
                ReceiptNo     = $"NK-{DateTime.UtcNow.Year}-{project.ProjectId:D2}{rnd.Next(100,999)}",
                DelivererInfo = sup.SupplierName,
                DeliveryDocNo = $"GH-{rnd.Next(10000, 99999)}",
                Status        = "Approved",
                CreatedAt     = DateTime.UtcNow.AddDays(-12),
                CreatedBy     = projectLeaderId
            };
            context.GoodsReceipts.Add(gr);
            await context.SaveChangesAsync();

            foreach (var pi in poItems)
            {
                context.GoodsReceiptItems.Add(new GoodsReceiptItem { ReceiptId=gr.ReceiptId, MaterialId=pi.MaterialId, UnitId=pi.UnitId, Quantity=pi.Quantity, ConversionRate=1 });

                // Tồn kho ảo
                var inv = await context.CurrentInventories.FirstOrDefaultAsync(ci => ci.ProjectId==project.ProjectId && ci.MaterialId==pi.MaterialId);
                if (inv != null) { inv.Quantity += pi.Quantity; inv.LastUpdated = DateTime.UtcNow; }
                else context.CurrentInventories.Add(new CurrentInventory { ProjectId=project.ProjectId, MaterialId=pi.MaterialId, UnitId=pi.UnitId, Quantity=pi.Quantity, ReservedQuantity=0, LastUpdated=DateTime.UtcNow });

                // Inventory Transaction ledger
                context.InventoryTransactions.Add(new InventoryTransaction { ProjectId=project.ProjectId, MaterialId=pi.MaterialId, TransactionType=1, ReferenceId=gr.ReceiptId, QuantityChange=pi.Quantity, BalanceAfter=pi.Quantity, CreatedBy=projectLeaderId, CreatedAt=DateTime.UtcNow.AddDays(-12) });
            }
            await context.SaveChangesAsync();
        }
    }

    // ====================================================================
    // 6. PHIẾU XUẤT KHO (Material Issuance)
    // ====================================================================
    private static async Task SeedIssuancesAsync(AppDbContext context, List<Project> projects, List<MaterialCatalog> catalogs, Dictionary<string, User> users)
    {
        if (await context.MaterialIssuances.AnyAsync()) return;

        foreach (var project in projects.Take(2))
        {
            var projectLeaderId = await context.ProjectMembers
                .Where(m => m.ProjectId == project.ProjectId && m.IsLeader)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync();

            if (projectLeaderId == 0) continue;
            var task = await context.Tasks.FirstOrDefaultAsync(t => t.Phase.ProjectId == project.ProjectId && t.Status == "InProgress");
            if (task == null)
                task = await context.Tasks.FirstOrDefaultAsync(t => t.Phase.ProjectId == project.ProjectId);
            if (task == null) continue;

            var inv = await context.CurrentInventories.Where(ci => ci.ProjectId == project.ProjectId && ci.Quantity > 0).Take(3).ToListAsync();
            if (!inv.Any()) continue;

            var issuance = new MaterialIssuance
            {
                TaskId    = task.TaskId,
                Purpose   = $"Xuất vật tư phục vụ thi công hạng mục [{task.Name}] – đợt triển khai ngày {DateTime.UtcNow.AddDays(-5):dd/MM/yyyy}",
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                CreatedBy = projectLeaderId
            };
            context.MaterialIssuances.Add(issuance);
            await context.SaveChangesAsync();

            foreach (var i in inv)
            {
                var xuat = Math.Min(i.Quantity * 0.3m, i.Quantity);
                context.MaterialIssuanceItems.Add(new MaterialIssuanceItem { MaterialIssuanceId=issuance.MaterialIssuanceId, MaterialId=i.MaterialId, UnitId=i.UnitId, Quantity=xuat, ConversionRate=1 });
                i.Quantity -= xuat;
                i.LastUpdated = DateTime.UtcNow;

                context.InventoryTransactions.Add(new InventoryTransaction { ProjectId=project.ProjectId, MaterialId=i.MaterialId, TransactionType=2, ReferenceId=issuance.MaterialIssuanceId, QuantityChange=-xuat, BalanceAfter=i.Quantity, CreatedBy=projectLeaderId, CreatedAt=DateTime.UtcNow.AddDays(-5) });
            }
            await context.SaveChangesAsync();
        }
    }

    // ====================================================================
    // 7. SỰ CỐ & PHIẾU ĐIỀU CHỈNH TỒN KHO
    // ====================================================================
    private static async Task SeedIncidentsAndAdjustmentsAsync(AppDbContext context, List<Project> projects, List<MaterialCatalog> catalogs, Dictionary<string, User> users)
    {
        if (await context.Incidents.AnyAsync()) return;

        var tpkt   = users["tpkt@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];
        var gd     = users["giamdoc@bpg.com"];

        var project = projects.FirstOrDefault(p => p.Status == "InProgress");
        if (project == null) return;

        var task = await context.Tasks.FirstOrDefaultAsync(t => t.Phase.ProjectId == project.ProjectId && t.Status == "InProgress");
        if (task == null) return;

        var projectLeaderId = await context.ProjectMembers.Where(m => m.ProjectId == project.ProjectId && m.IsLeader).Select(m => m.UserId).FirstOrDefaultAsync();
        var siteEngineerId = await context.ProjectMembers.Where(m => m.ProjectId == project.ProjectId && !m.IsLeader).Select(m => m.UserId).FirstOrDefaultAsync();

        // Sự cố thi công
        var incident = new Incident
        {
            ProjectId             = project.ProjectId,
            TaskId                = task.TaskId,
            ReportedBy            = siteEngineerId,
            ReviewedBy            = tpkt.UserId,
            IncidentType          = "NgoaiLuc",
            Description           = "Trong quá trình đào đất, gặp túi nước ngầm không có trong bản đồ địa chất. Nước tràn vào hố móng, ảnh hưởng đến tiến độ đổ bê tông lót.",
            Status                = "Resolved",
            DamageDescription     = "Hố móng khu vực trục B-C bị ngập, phải bơm nước mất 2 ngày. Phần bê tông lót đã đổ (~5m²) bị ảnh hưởng chất lượng, cần đục bỏ đổ lại.",
            EstimatedMaterialLoss = 2.5m,
            EstimatedLaborDays    = 3,
            EstimatedDelayDays    = 4,
            ProposedAction        = "Hút nước, gia cố taluy hố đào, đổ lại bê tông lót. Đề xuất tạo Rework Task để theo dõi riêng.",
            CreatedAt             = DateTime.UtcNow.AddDays(-10),
            CreatedBy             = projectLeaderId
        };
        context.Incidents.Add(incident);
        await context.SaveChangesAsync();

        // Phiếu điều chỉnh TĂNG tồn (Leader tạo – Auto duyệt)
        var invItem = await context.CurrentInventories.FirstOrDefaultAsync(ci => ci.ProjectId == project.ProjectId);
        if (invItem != null)
        {
            var adjTang = new InventoryAdjustment
            {
                ProjectId   = project.ProjectId,
                AdjustmentType = "Increase",
                Reason      = "Thu hồi vật tư thừa từ công nhân",
                Description = "Thu hồi 15 bao xi măng PCB40 còn nguyên kiện tổ thợ trả lại sau khi hoàn thành task đổ bê tông cột trục A, do tính toán lại hao hụt thực tế ít hơn định mức.",
                Status      = "Approved",
                ApprovedBy  = null,
                ApprovedAt  = DateTime.UtcNow.AddDays(-8),
                CreatedAt   = DateTime.UtcNow.AddDays(-8),
                CreatedBy   = projectLeaderId
            };
            context.InventoryAdjustments.Add(adjTang);
            await context.SaveChangesAsync();

            context.AdjustmentItems.Add(new AdjustmentItem { AdjustmentId=adjTang.AdjustmentId, MaterialId=invItem.MaterialId, UnitId=invItem.UnitId, Quantity=15, ConversionRate=1 });
            invItem.Quantity += 15;
            invItem.LastUpdated = DateTime.UtcNow;
            await context.SaveChangesAsync();

            // Phiếu điều chỉnh GIẢM tồn (Kế toán tạo – Giám đốc duyệt)
            var adjGiam = new InventoryAdjustment
            {
                ProjectId      = project.ProjectId,
                IncidentId     = incident.IncidentId,
                AdjustmentType = "Decrease",
                Reason         = "Hao hụt vật tư do sự cố ngập nước hố móng",
                Description    = "Căn cứ biên bản sự cố ngập hố móng ngày " + DateTime.UtcNow.AddDays(-10).ToString("dd/MM/yyyy") + ", xi măng bị ướt không còn sử dụng được. Đề nghị giảm tồn 20 bao xi măng PCB40.",
                Status         = "Approved",
                ApprovedBy     = gd.UserId,
                ApprovedAt     = DateTime.UtcNow.AddDays(-6),
                CreatedAt      = DateTime.UtcNow.AddDays(-7),
                CreatedBy      = ketoan.UserId
            };
            context.InventoryAdjustments.Add(adjGiam);
            await context.SaveChangesAsync();

            var giamQty = Math.Min(20m, invItem.Quantity);
            context.AdjustmentItems.Add(new AdjustmentItem { AdjustmentId=adjGiam.AdjustmentId, MaterialId=invItem.MaterialId, UnitId=invItem.UnitId, Quantity=giamQty, ConversionRate=1 });
            invItem.Quantity -= giamQty;
            invItem.LastUpdated = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }
    }

    // ====================================================================
    // 8. VẬT TƯ THỪA (Surplus)
    // ====================================================================
    private static async Task SeedSurplusAsync(AppDbContext context, List<Project> projects, List<MaterialCatalog> catalogs, Dictionary<string, User> users)
    {
        if (await context.SurplusRequests.AnyAsync()) return;

        var ketoan = users["ketoan@bpg.com"];
        var tpkt   = users["tpkt@bpg.com"];

        // Lấy dự án đã hoàn thành
        var doneProject = projects.FirstOrDefault(p => p.Status == "Completed");
        if (doneProject == null) return;

        var projectLeaderId = await context.ProjectMembers.Where(m => m.ProjectId == doneProject.ProjectId && m.IsLeader).Select(m => m.UserId).FirstOrDefaultAsync();

        var doneInv = await context.CurrentInventories.Where(ci => ci.ProjectId == doneProject.ProjectId && ci.Quantity > 0).Take(2).ToListAsync();
        if (!doneInv.Any()) return;

        var surplus = new SurplusRequest
        {
            ProjectId = doneProject.ProjectId,
            Reason    = $"Vật tư thừa sau khi hoàn thành dự án {doneProject.Name.Split('–')[0].Trim()}. Đề xuất xử lý trả NCC và thanh lý theo quy định.",
            Status    = "Processing",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            CreatedBy = projectLeaderId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        int stt = 0;
        foreach (var inv in doneInv)
        {
            var item = new SurplusRequestItem
            {
                SurplusRequestId  = surplus.SurplusRequestId,
                MaterialId        = inv.MaterialId,
                UnitId            = inv.UnitId,
                Quantity          = inv.Quantity,
                ProcessedQuantity = 0,
                ConversionRate    = 1,
                Status            = "Pending",
                CreatedAt         = DateTime.UtcNow.AddDays(-3)
            };
            context.SurplusRequestItems.Add(item);
            await context.SaveChangesAsync();

            if (stt == 0)
            {
                // Trả NCC
                context.SurplusReturnSuppliers.Add(new SurplusReturnSupplier
                {
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    SupplierId           = null,
                    ReturnQuantity       = inv.Quantity,
                    RefundAmount         = inv.Quantity * 85_000m,
                    Note                 = "NCC đồng ý thu hồi lại hàng nguyên kiện, hoàn tiền 85.000đ/đơn vị. Kế toán liên hệ NCC để lấy xe thu gom.",
                    CreatedAt            = DateTime.UtcNow.AddDays(-2)
                });
            }
            else
            {
                // Thanh lý
                context.SurplusLiquidations.Add(new SurplusLiquidation
                {
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    BuyerName            = "Cơ sở Ve chai Thanh Bình",
                    LiquidationQuantity  = inv.Quantity,
                    TotalAmount          = inv.Quantity * 5_000m,
                    CreatedAt            = DateTime.UtcNow.AddDays(-1)
                });
            }
            stt++;
        }
        await context.SaveChangesAsync();
    }

    // ====================================================================
    // 9. THÔNG BÁO HỆ THỐNG
    // ====================================================================
    private static async Task SeedNotificationsAsync(AppDbContext context, Dictionary<string, User> users)
    {
        if (await context.Notifications.AnyAsync()) return;

        var gd     = users["giamdoc@bpg.com"];
        var tpkt   = users["tpkt@bpg.com"];
        var ld1    = users["leader1@bpg.com"];
        var ks1    = users["kysu1@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];

        var dsThongBao = new List<Notification>
        {
            new() { UserId=gd.UserId,     Title="Yêu cầu vật tư vượt định mức chờ duyệt",       Content="Dự án Chung cư SkyView có 1 phiếu yêu cầu vật tư vượt BOQ đang chờ Giám đốc phê duyệt. Vui lòng kiểm tra và ra quyết định.",                          NotificationType="MaterialRequest", IsRead=false, CreatedAt=DateTime.UtcNow.AddDays(-1) },
            new() { UserId=tpkt.UserId,   Title="Sự cố thi công mới cần xử lý",                  Content="Kỹ sư Vũ Tiến Dũng vừa tạo báo cáo sự cố tại dự án Khu nhà ở Hưng Phú. Vui lòng xem xét và ra quyết định xử lý.",                                    NotificationType="Incident",        IsRead=false, CreatedAt=DateTime.UtcNow.AddDays(-1) },
            new() { UserId=tpkt.UserId,   Title="Task thi công sắp trễ hạn",                      Content="Task [Thi công đài cọc & giằng móng] thuộc dự án Khu nhà ở Hưng Phú đang có nguy cơ trễ hạn. Tiến độ hiện tại 70%, kỳ vọng 85%. Đề nghị đôn đốc.", NotificationType="TaskDeadline",    IsRead=true,  CreatedAt=DateTime.UtcNow.AddDays(-2) },
            new() { UserId=ld1.UserId,    Title="Phiếu yêu cầu vật tư đã được duyệt",            Content="Phiếu yêu cầu vật tư đợt 1 của dự án Khu nhà ở Hưng Phú đã được Kế toán phê duyệt. Đơn đặt hàng sẽ được tạo trong hôm nay.",                         NotificationType="MaterialRequest", IsRead=true,  CreatedAt=DateTime.UtcNow.AddDays(-3) },
            new() { UserId=ks1.UserId,    Title="Nhật ký thi công cần cập nhật",                  Content="Hôm nay bạn chưa cập nhật nhật ký thi công cho Task [Thi công đài cọc & giằng móng]. Vui lòng cập nhật tiến độ trước 17h.",                           NotificationType="DailyLog",        IsRead=false, CreatedAt=DateTime.UtcNow },
            new() { UserId=ketoan.UserId, Title="Có 2 yêu cầu vật tư chờ kiểm tra",              Content="Hiện có 2 phiếu yêu cầu vật tư từ các dự án đang chờ Kế toán kiểm tra và xử lý. Vui lòng vào hệ thống xem xét.",                                     NotificationType="MaterialRequest", IsRead=false, CreatedAt=DateTime.UtcNow },
            new() { UserId=gd.UserId,     Title="Giai đoạn 1 dự án Bệnh viện Phương Đông đã nghiệm thu", Content="Trưởng phòng Kỹ thuật Lê Minh Tuấn vừa ký nghiệm thu Giai đoạn 1 dự án Bệnh viện Đa khoa Phương Đông. Mời Giám đốc xem biên bản.", NotificationType="PhaseAcceptance", IsRead=true,  CreatedAt=DateTime.UtcNow.AddDays(-5) },
            new() { UserId=tpkt.UserId,   Title="Phiếu giảm tồn kho đã được Giám đốc duyệt",     Content="Phiếu điều chỉnh giảm tồn 20 bao xi măng PCB40 tại dự án Khu nhà ở Hưng Phú đã được Giám đốc Trần Quốc Hùng phê duyệt.",                            NotificationType="InventoryAdj",    IsRead=true,  CreatedAt=DateTime.UtcNow.AddDays(-6) },
        };

        context.Notifications.AddRange(dsThongBao);
        await context.SaveChangesAsync();
    }
}
