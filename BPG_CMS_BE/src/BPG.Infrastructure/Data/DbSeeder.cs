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
        await context.Database.MigrateAsync();
        if (await context.Units.AnyAsync() && await context.Projects.AnyAsync()) return;

        var users      = await SeedAuthAsync(context);
        var masterData = await SeedMasterDataAsync(context);
        var catalogs   = await SeedMaterialsAsync(context, masterData.Units, masterData.Categories);
        await SeedProjectsAndLifecyclesAsync(context, users, masterData.Units, catalogs, masterData.Suppliers);
        await SeedNotificationsAsync(context, users);
    }

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
            ("leader1@bpg.com",  "Phạm Văn Đức",           "ProjectLeader",    "0934 567 890"),
            ("leader2@bpg.com",  "Hoàng Thị Lan",          "ProjectLeader",    "0945 111 222"),
            ("leader3@bpg.com",  "Đinh Văn Cường",         "ProjectLeader",    "0945 333 444"),
            ("leader4@bpg.com",  "Nguyễn Trọng Tài",       "ProjectLeader",    "0945 555 666"),
            ("leader5@bpg.com",  "Lê Bá Tòng",             "ProjectLeader",    "0945 777 888"),
            ("leader6@bpg.com",  "Vũ Trọng Phụng",         "ProjectLeader",    "0945 888 999"),
            ("leader7@bpg.com",  "Ngô Tất Tố",             "ProjectLeader",    "0945 999 000"),
            ("leader8@bpg.com",  "Nam Cao",                "ProjectLeader",    "0946 111 222"),
            ("leader9@bpg.com",  "Thạch Lam",              "ProjectLeader",    "0946 222 333"),
            ("leader10@bpg.com", "Xuân Diệu",              "ProjectLeader",    "0946 333 444"),
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

    record MasterData(List<Unit> Units, List<MaterialCategory> Categories, List<Supplier> Suppliers);
    private static async Task<MasterData> SeedMasterDataAsync(AppDbContext context)
    {
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
                new SystemConfig { ConfigKey = "NguongTonKhoThap",    ConfigValue = "10",  DataType = "decimal", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "HanHuyPhieuNgay",     ConfigValue = "7",   DataType = "int",     CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "PhanTramTreKyVong",    ConfigValue = "15",  DataType = "decimal", CreatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        return new MasterData(units, cats, suppliers);
    }

    private static async Task<List<MaterialCatalog>> SeedMaterialsAsync(AppDbContext context, List<Unit> units, List<MaterialCategory> cats)
    {
        var catalogs = await context.MaterialCatalogs.ToListAsync();
        if (catalogs.Any()) return catalogs;

        Unit Bao(string code)   => units.First(u => u.UnitCode == code);
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
            var thepVan = catalogs.First(c => c.Code == "VT-012");
            var unitTan = units.First(u => u.UnitCode == "TAN").UnitId;

            context.MaterialConversions.AddRange(
                new MaterialConversion { MaterialId = thepCuon.MaterialId, AlternativeUnitId = unitTan, ConversionRate = 0.001m, CreatedAt = DateTime.UtcNow },
                new MaterialConversion { MaterialId = thepVan.MaterialId, AlternativeUnitId = unitTan, ConversionRate = 0.001m, CreatedAt = DateTime.UtcNow }
            );
            await context.SaveChangesAsync();
        }

        return catalogs;
    }

    private static async Task SeedProjectsAndLifecyclesAsync(AppDbContext context, Dictionary<string, User> users, List<Unit> units, List<MaterialCatalog> catalogs, List<Supplier> suppliers)
    {
        var tpkt   = users["tpkt@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];
        var gd     = users["giamdoc@bpg.com"];
        var leaders = users.Values.Where(u => u.Email.StartsWith("leader")).ToArray();
        var kysus   = users.Values.Where(u => u.Email.StartsWith("kysu")).ToArray();
        
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rnd = new Random(123);
        var unitTan = units.First(u => u.UnitCode == "TAN").UnitId;
        var unitKg = units.First(u => u.UnitCode == "KG").UnitId;

        var dsDuAn = new[]
        {
            new { Ten="Bệnh viện Phương Đông",         TrangThai="Completed",  BatDau=today.AddDays(-300), KetThuc=today.AddDays(-10) },
            new { Ten="Khu nhà ở thương mại Hưng Phú", TrangThai="Completed",  BatDau=today.AddDays(-180), KetThuc=today.AddDays(-5) },
            new { Ten="Nhà máy May mặc Thiên Long",    TrangThai="Completed",  BatDau=today.AddDays(-200), KetThuc=today.AddDays(-2) },
            new { Ten="Chung cư cao tầng SkyView",     TrangThai="InProgress", BatDau=today.AddDays(-90),  KetThuc=today.AddDays(180) },
            new { Ten="Trường quốc tế Á Châu",         TrangThai="InProgress", BatDau=today.AddDays(-50),  KetThuc=today.AddDays(150) },
            new { Ten="TTTM Vincom Dĩ An",             TrangThai="InProgress", BatDau=today.AddDays(-30),  KetThuc=today.AddDays(240) },
            new { Ten="KDC Sài Gòn Mới",               TrangThai="InProgress", BatDau=today.AddDays(-10),  KetThuc=today.AddDays(200) },
            new { Ten="Trường tiểu học Lê Văn Tám",    TrangThai="Planning",   BatDau=today.AddDays(10),   KetThuc=today.AddDays(240) },
            new { Ten="Khách sạn Mường Thanh CT",      TrangThai="Planning",   BatDau=today.AddDays(30),   KetThuc=today.AddDays(300) },
            new { Ten="Cầu Vượt Ngã Tư Thủ Đức",       TrangThai="Planning",   BatDau=today.AddDays(45),   KetThuc=today.AddDays(400) },
        };

        for (int i = 0; i < dsDuAn.Length; i++)
        {
            var dp = dsDuAn[i];
            var leader = leaders[i % leaders.Length];
            var ksA = kysus[(i * 2) % kysus.Length];
            var ksB = kysus[(i * 2 + 1) % kysus.Length];

            var project = new Project
            {
                Name         = dp.Ten,
                Address      = "Việt Nam",
                PlannedStart = dp.BatDau,
                PlannedEnd   = dp.KetThuc,
                Status       = dp.TrangThai,
                CreatedAt    = DateTime.UtcNow,
                CreatedBy    = tpkt.UserId
            };
            context.Projects.Add(project);
            await context.SaveChangesAsync();

            context.ProjectMembers.AddRange(
                new ProjectMember { ProjectId=project.ProjectId, UserId=leader.UserId, IsLeader=true,  JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksA.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksB.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow }
            );
            await context.SaveChangesAsync();

            // Phases & Tasks
            var phases = new[] {
                new { Ten="Móng", ThuTu=1, Pct=(dp.TrangThai=="Completed"||dp.TrangThai=="InProgress"?100:(dp.TrangThai=="Planning"?0:0)) },
                new { Ten="Khung", ThuTu=2, Pct=(dp.TrangThai=="Completed"?100:(dp.TrangThai=="InProgress"?50:0)) },
                new { Ten="Hoàn thiện", ThuTu=3, Pct=(dp.TrangThai=="Completed"?100:0) }
            };

            foreach (var pd in phases)
            {
                var phaseStatus = pd.Pct == 100 ? "Completed" : (pd.Pct > 0 ? "InProgress" : "Draft");
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

                // BOQ for phase
                foreach (var mat in catalogs)
                {
                    decimal qty = 0;
                    decimal convRate = 1;
                    int finalUnit = mat.BaseUnitId;

                    if (mat.Name.Contains("Thép")) { qty = rnd.Next(10, 50); finalUnit = unitTan; convRate = 0.001m; } // BOQ Tấn, Base Kg
                    else if (mat.Name.Contains("Cát") || mat.Name.Contains("Đá")) { qty = rnd.Next(100, 500); }
                    else if (mat.Name.Contains("Xi măng")) { qty = rnd.Next(200, 1000); }
                    else { qty = rnd.Next(50, 200); }

                    context.BOQItems.Add(new BOQItem { PhaseId=phase.PhaseId, MaterialId=mat.MaterialId, UnitId=finalUnit, Quantity=qty, ConversionRate=convRate, CreatedAt=DateTime.UtcNow });
                }
                await context.SaveChangesAsync();

                if (phaseStatus == "Completed")
                {
                    context.PhaseAcceptances.Add(new PhaseAcceptance { PhaseId=phase.PhaseId, AcceptedBy=tpkt.UserId, AcceptanceDate=DateTime.UtcNow.AddDays(-5), ReportContent="Đạt yêu cầu", IsCancelled=false, CreatedAt=DateTime.UtcNow, CreatedBy=tpkt.UserId });
                }

                // Tasks
                var taskNames = new[] { "Nhiệm vụ 1", "Nhiệm vụ 2", "Nhiệm vụ 3" };
                foreach (var tName in taskNames)
                {
                    var task = new ProjectTask
                    {
                        PhaseId = phase.PhaseId, Name = $"{pd.Ten} - {tName}", OrderIndex = 1, StartDate = phase.StartDate.Value, EndDate = phase.EndDate.Value,
                        Status = pd.Pct == 100 ? "Completed" : (pd.Pct > 0 ? "InProgress" : "New"), ProgressPercent = (byte)pd.Pct, IsLocked = pd.Pct == 100,
                        CreatedAt = DateTime.UtcNow, CreatedBy = tpkt.UserId
                    };
                    context.Tasks.Add(task);
                    await context.SaveChangesAsync();
                    context.TaskAssignees.Add(new TaskAssignee { TaskId=task.TaskId, UserId=ksA.UserId, AssignedAt=DateTime.UtcNow });
                    await context.SaveChangesAsync();
                }

                // Procurement flow if InProgress or Completed
                if (pd.Pct > 0)
                {
                    var mr = new MaterialRequest
                    {
                        PhaseId = phase.PhaseId, Reason = "Xin cấp vật tư", Status = "Approved", BOQCheckStatus = "WithinBOQ",
                        CheckedBy = ketoan.UserId, ApprovedBy = gd.UserId, AccountantNote = "Hợp lệ", CreatedAt = DateTime.UtcNow.AddDays(-20), CreatedBy = leader.UserId
                    };
                    context.MaterialRequests.Add(mr);
                    await context.SaveChangesAsync();

                    var po = new PurchaseOrder
                    {
                        RequestId = mr.RequestId, SupplierId = suppliers.First().SupplierId, PONumber = $"PO-{rnd.Next(1000,9999)}",
                        OrderDate = DateTime.UtcNow.AddDays(-19), ExpectedDeliveryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-15)), Status = "FullyReceived",
                        TotalAmount = 5000000, CreatedAt = DateTime.UtcNow.AddDays(-19), CreatedBy = ketoan.UserId
                    };
                    context.PurchaseOrders.Add(po);
                    await context.SaveChangesAsync();

                    var gr = new GoodsReceipt
                    {
                        POId = po.POId, ReceiptNo = $"GR-{rnd.Next(1000,9999)}", DelivererInfo = "Test", DeliveryDocNo = "DOC-123",
                        Status = "Approved", CreatedAt = DateTime.UtcNow.AddDays(-15), CreatedBy = leader.UserId
                    };
                    context.GoodsReceipts.Add(gr);
                    await context.SaveChangesAsync();

                    foreach (var mat in catalogs.Take(4))
                    {
                        decimal qty = mat.Name.Contains("Thép") ? 5000 : 100; // 5000kg = 5 Tấn
                        context.MaterialRequestItems.Add(new MaterialRequestItem { RequestId=mr.RequestId, MaterialId=mat.MaterialId, UnitId=mat.BaseUnitId, Quantity=qty, ConversionRate=1, IsOverBOQ=false });
                        context.PurchaseOrderItems.Add(new PurchaseOrderItem { POId=po.POId, MaterialId=mat.MaterialId, UnitId=mat.BaseUnitId, Quantity=qty, UnitPrice=10000, LineTotal=qty*10000, ConversionRate=1 });
                        context.GoodsReceiptItems.Add(new GoodsReceiptItem { ReceiptId=gr.ReceiptId, MaterialId=mat.MaterialId, UnitId=mat.BaseUnitId, Quantity=qty, ConversionRate=1 });
                        
                        var inv = await context.CurrentInventories.FirstOrDefaultAsync(ci => ci.ProjectId == project.ProjectId && ci.MaterialId == mat.MaterialId);
                        if (inv == null) {
                            inv = new CurrentInventory { ProjectId=project.ProjectId, MaterialId=mat.MaterialId, UnitId=mat.BaseUnitId, Quantity=qty, ReservedQuantity=0, LastUpdated=DateTime.UtcNow };
                            context.CurrentInventories.Add(inv);
                        } else {
                            inv.Quantity += qty; inv.LastUpdated = DateTime.UtcNow;
                        }
                    }
                    await context.SaveChangesAsync();
                }
            }

            // Incidents for Completed Projects
            if (dp.TrangThai == "Completed" && rnd.Next(2) == 0)
            {
                var task = await context.Tasks.FirstAsync(t => t.Phase.ProjectId == project.ProjectId);
                var incident = new Incident
                {
                    ProjectId = project.ProjectId, TaskId = task.TaskId, ReportedBy = ksA.UserId, ReviewedBy = tpkt.UserId,
                    IncidentType = "NgoaiLuc", Description = "Mưa ngập hố móng", Status = "Resolved", DamageDescription = "Hỏng 5m3 bê tông",
                    EstimatedMaterialLoss = 5, EstimatedLaborDays = 2, EstimatedDelayDays = 2, ProposedAction = "Làm lại",
                    CreatedAt = DateTime.UtcNow.AddDays(-10), CreatedBy = leader.UserId
                };
                context.Incidents.Add(incident);
                await context.SaveChangesAsync();

                var adj = new InventoryAdjustment
                {
                    ProjectId = project.ProjectId, AdjustmentType = "Decrease", Reason = "Thiệt hại do sự cố", Description = "Giảm do ngập nước",
                    Status = "Approved", ApprovedBy = gd.UserId, ApprovedAt = DateTime.UtcNow.AddDays(-9), CreatedAt = DateTime.UtcNow.AddDays(-9), CreatedBy = ketoan.UserId
                };
                context.InventoryAdjustments.Add(adj);
                await context.SaveChangesAsync();
            }

            // Surplus Material for Completed Projects
            if (dp.TrangThai == "Completed")
            {
                var invItems = await context.CurrentInventories.Where(c => c.ProjectId == project.ProjectId && c.Quantity > 0).ToListAsync();
                if (invItems.Any())
                {
                    var surplus = new SurplusRequest
                    {
                        ProjectId = project.ProjectId, Reason = "Kết thúc dự án dư vật tư", Status = "Processed",
                        CreatedAt = DateTime.UtcNow.AddDays(-2), CreatedBy = leader.UserId
                    };
                    context.SurplusRequests.Add(surplus);
                    await context.SaveChangesAsync();

                    foreach (var inv in invItems)
                    {
                        var qty = inv.Quantity;
                        context.SurplusRequestItems.Add(new SurplusRequestItem { SurplusRequestId=surplus.SurplusRequestId, MaterialId=inv.MaterialId, UnitId=inv.UnitId, Quantity=qty, ConversionRate=1, Status="Completed" });
                        inv.Quantity = 0; // Trả hết
                        inv.LastUpdated = DateTime.UtcNow;
                    }
                    await context.SaveChangesAsync();
                }
            }
        }
    }

    private static async Task SeedNotificationsAsync(AppDbContext context, Dictionary<string, User> users)
    {
        // Simple notification seed
        var gd = users["giamdoc@bpg.com"];
        context.Notifications.Add(new Notification { UserId=gd.UserId, Title="Chào mừng", Content="Chào mừng giám đốc", IsRead=false, CreatedAt=DateTime.UtcNow });
        await context.SaveChangesAsync();
    }
}
