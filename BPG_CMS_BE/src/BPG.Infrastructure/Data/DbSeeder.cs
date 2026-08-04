using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // MigrateAsync() tạo DB nếu chưa có, áp dụng migration còn thiếu.
        // KHÔNG dùng EnsureDeletedAsync() — lệnh đó để lại file .ldf mồ côi trên
        // ổ đĩa SQL Server, khiến CREATE DATABASE bị lỗi Error 5170 khi chạy lại.
        await context.Database.MigrateAsync();
        if (await context.Units.AnyAsync() && await context.Projects.AnyAsync()) return;

        var users      = await SeedAuthAsync(context);
        var adminId = users["admin@bpg.com"].UserId;
        var masterData = await SeedMasterDataAsync(context, adminId);
        var catalogs   = await SeedMaterialsAsync(context, masterData.Units, masterData.Categories, adminId);
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
            ("admin@bpg.com",    "Quản trị hệ thống BPG",      "Admin",            "0901 234 567"),
            ("giamdoc@bpg.com",  "Bùi Khắc Phú",             "Director",         "0339 353 469"),
            ("tpkt@bpg.com",     "Nguyễn Minh Đức",          "TechnicalManager", "0912 024 688"),
            // Leader là SiteEngineer, quyền chỉ huy trưởng dự án được xác định bằng ProjectMember.IsLeader = true.
            ("leader1@bpg.com",  "Trần Văn Hoàng",           "SiteEngineer",     "0936 425 118"),
            ("leader2@bpg.com",  "Phạm Đức Long",            "SiteEngineer",     "0983 710 246"),
            ("leader3@bpg.com",  "Đỗ Quốc Huy",              "SiteEngineer",     "0974 832 015"),
            ("leader4@bpg.com",  "Lê Tuấn Anh",              "SiteEngineer",     "0962 445 790"),
            ("leader5@bpg.com",  "Vũ Mạnh Cường",            "SiteEngineer",     "0328 684 571"),
            ("leader6@bpg.com",  "Ngô Thành Trung",          "SiteEngineer",     "0357 904 236"),
            ("leader7@bpg.com",  "Hoàng Anh Tuấn",           "SiteEngineer",     "0378 412 609"),
            ("leader8@bpg.com",  "Bùi Đức Thắng",            "SiteEngineer",     "0392 604 185"),
            ("leader9@bpg.com",  "Mai Xuân Bắc",             "SiteEngineer",     "0703 284 516"),
            ("leader10@bpg.com", "Đặng Văn Nam",             "SiteEngineer",     "0835 209 641"),
            ("kysu1@bpg.com",    "Nguyễn Thành Đạt",         "SiteEngineer",     "0941 275 639"),
            ("kysu2@bpg.com",    "Trần Quang Hưng",          "SiteEngineer",     "0906 842 137"),
            ("kysu3@bpg.com",    "Phạm Minh Khang",          "SiteEngineer",     "0886 214 593"),
            ("kysu4@bpg.com",    "Lê Gia Bảo",               "SiteEngineer",     "0868 520 947"),
            ("kysu5@bpg.com",    "Đỗ Hải Nam",               "SiteEngineer",     "0794 118 306"),
            ("kysu6@bpg.com",    "Vũ Nhật Minh",             "SiteEngineer",     "0782 905 344"),
            ("kysu7@bpg.com",    "Hoàng Duy Phúc",           "SiteEngineer",     "0776 431 820"),
            ("kysu8@bpg.com",    "Ngô Việt Anh",             "SiteEngineer",     "0769 550 218"),
            ("kysu9@bpg.com",    "Đặng Hữu Lâm",             "SiteEngineer",     "0852 906 734"),
            ("kysu10@bpg.com",   "Bùi Thanh Tùng",           "SiteEngineer",     "0848 117 462"),
            ("kysu11@bpg.com",   "Mai Đức Duy",              "SiteEngineer",     "0819 602 775"),
            ("kysu12@bpg.com",   "Tạ Quang Vinh",            "SiteEngineer",     "0827 430 915"),
            ("kysu13@bpg.com",   "Chu Văn Kiên",             "SiteEngineer",     "0346 809 217"),
            ("kysu14@bpg.com",   "Phan Anh Khoa",            "SiteEngineer",     "0365 718 409"),
            ("kysu15@bpg.com",   "Hồ Đức Việt",              "SiteEngineer",     "0384 560 172"),
            ("kysu16@bpg.com",   "Trịnh Minh Sơn",           "SiteEngineer",     "0568 920 441"),
            ("kysu17@bpg.com",   "Cao Xuân Trường",          "SiteEngineer",     "0587 314 206"),
            ("kysu18@bpg.com",   "Lương Đức Hải",            "SiteEngineer",     "0593 827 640"),
            ("kysu19@bpg.com",   "Nguyễn Hữu Dũng",          "SiteEngineer",     "0928 104 536"),
            ("kysu20@bpg.com",   "Trần Đức Thành",           "SiteEngineer",     "0917 642 803"),
            ("ketoan@bpg.com",   "Nguyễn Thị Thanh Huyền",   "Accountant",       "0986 775 204"),
            // Tài khoản đã nghỉ việc — bị vô hiệu hóa ngay sau khi tạo (xem bên dưới).
            // Dùng để kiểm thử luồng đăng nhập của tài khoản bị khóa.
            ("nghiviec@bpg.com", "Phạm Thị Ngọc Mai",        "SiteEngineer",     "0975 318 240"),
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
                context.UserRoles.Add(new BPG.Domain.Entities.UserRole { UserId = user.UserId, RoleId = role.RoleId, CreatedAt = DateTime.UtcNow });
                await context.SaveChangesAsync();
            }
            result[s.Email] = user;
        }

        // Vô hiệu hóa tài khoản đã nghỉ việc để có sẵn dữ liệu cho luồng đăng nhập bị từ chối.
        if (result.TryGetValue("nghiviec@bpg.com", out var inactiveUser))
        {
            inactiveUser.IsActive = false;
            await context.SaveChangesAsync();
        }

        var adminId = result["admin@bpg.com"].UserId;
        foreach (var user in await context.Users.ToListAsync())
            user.CreatedBy ??= adminId;
        foreach (var userRole in await context.UserRoles.ToListAsync())
            userRole.CreatedBy ??= adminId;
        foreach (var role in await context.Roles.ToListAsync())
        {
            role.CreatedAt = role.CreatedAt == default ? DateTime.UtcNow : role.CreatedAt;
            role.CreatedBy ??= adminId;
        }
        await context.SaveChangesAsync();
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MASTER DATA
    // ─────────────────────────────────────────────────────────────────────────
    record MasterData(List<Unit> Units, List<MaterialCategory> Categories, List<Supplier> Suppliers);
    private static async Task<MasterData> SeedMasterDataAsync(AppDbContext context, long adminId)
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
            units.ForEach(x =>
            {
                x.CreatedAt = DateTime.UtcNow;
                x.CreatedBy = adminId;
            });
            context.Units.AddRange(units);
            await context.SaveChangesAsync();
        }

        var suppliers = await context.Suppliers.ToListAsync();
        if (!suppliers.Any())
        {
            suppliers = new List<Supplier>
            {
                new() { SupplierName = "Công ty CP Xi măng Vicem Hà Tiên",       ContactInfo = "028 3821 6211", Address = "360 Bến Chương Dương, Phường Cầu Ông Lãnh, TP.HCM", ServiceArea = "Toàn quốc", Rating = 4.8m, EvaluationNote = "Xi măng PCB40/PC40, phù hợp cấp cho móng, thân và hoàn thiện", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Tập đoàn Hòa Phát - Thép xây dựng",     ContactInfo = "024 6284 8666", Address = "66 Nguyễn Du, Hai Bà Trưng, Hà Nội", ServiceArea = "Hà Nội, miền Bắc", Rating = 4.9m, EvaluationNote = "Thép CB300-V/CB400-V, chứng chỉ chất lượng theo lô", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty CP Thép Pomina",               ContactInfo = "0274 3710 558", Address = "KCN Sóng Thần 2, Dĩ An, Bình Dương", ServiceArea = "Miền Nam", Rating = 4.6m, EvaluationNote = "Bổ sung thép gấp cho công trường phía Nam", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty CP Nhựa Bình Minh",            ContactInfo = "028 3969 0973", Address = "240 Hậu Giang, Phường 9, Quận 6, TP.HCM", ServiceArea = "Toàn quốc", Rating = 4.7m, EvaluationNote = "Ống PVC/PPR, phụ kiện cấp thoát nước", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Công ty TNHH Akzo Nobel Việt Nam - Dulux", ContactInfo = "028 3836 1616", Address = "Tầng 12, Sonatus Building, 15 Lê Thánh Tôn, Quận 1, TP.HCM", ServiceArea = "Toàn quốc", Rating = 4.7m, EvaluationNote = "Sơn hoàn thiện nội ngoại thất, có hỗ trợ tư vấn kỹ thuật", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Đại lý VLXD Hà Đông",                  ContactInfo = "024 3352 1188", Address = "Đường Tố Hữu, Phường Mộ Lao, Hà Đông, Hà Nội", ServiceArea = "Hà Đông, Thanh Xuân, Nam Từ Liêm", Rating = 4.3m, EvaluationNote = "Cát, đá, gạch tuynel giao theo chuyến xe ben", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
                new() { SupplierName = "Đại lý thiết bị điện nước Minh Long",  ContactInfo = "024 3200 6899", Address = "Nguyễn Trãi, Thanh Xuân, Hà Nội", ServiceArea = "Hà Nội", Rating = 4.4m, EvaluationNote = "Cadivi, ống nước, thiết bị điện dân dụng", CollaborationStatus = "Active", CreatedAt = DateTime.UtcNow },
            };
            suppliers.ForEach(x => x.CreatedBy = adminId);
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
            cats.ForEach(x => x.CreatedBy = adminId);
            context.MaterialCategories.AddRange(cats);
            await context.SaveChangesAsync();
        }

        // Một số cấu hình đã được migration chèn sẵn với giá trị mặc định cũ. Nếu chỉ kiểm tra
        // "bảng có dòng nào chưa" thì toàn bộ khối này bị bỏ qua, các key mới không bao giờ được
        // tạo và tên công ty vẫn là giá trị mặc định. Vì vậy duyệt theo từng key: thiếu thì thêm,
        // đã có thì ghi đè lại giá trị và phần mô tả cho khớp bộ dữ liệu mẫu.
        {
            var desiredConfigs = new List<SystemConfig>
            {
                new SystemConfig { ConfigKey = "NguongTonKhoThap", ConfigValue = "10", DataType = "number", DisplayName = "Ngưỡng tồn kho thấp", Description = "Số lượng tồn kho tối thiểu.", Unit = "đơn vị", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "HanHuyPhieuNgay", ConfigValue = "7", DataType = "number", DisplayName = "Hạn hủy phiếu nhập kho", Description = "Số ngày tối đa kể từ khi tạo phiếu nhập kho mà người dùng có thể hủy phiếu.", Unit = "ngày", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "DailyLogEditWindowHours", ConfigValue = "24", DataType = "number", DisplayName = "Giờ được sửa nhật ký thi công", Description = "Số giờ kể từ lúc tạo mà kỹ sư còn được phép chỉnh sửa nhật ký thi công.", Unit = "giờ", CreatedAt = DateTime.UtcNow },
                // Tham số kiểu phần trăm — backend chặn giá trị vượt quá 100 cho kiểu này.
                new SystemConfig { ConfigKey = "ExpectedDelayPercent", ConfigValue = "10", DataType = "percentage", DisplayName = "Ngưỡng cảnh báo trễ tiến độ", Description = "Phần trăm trễ tiến độ tối đa trước khi hệ thống cảnh báo.", Unit = "%", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyName", ConfigValue = "CÔNG TY TNHH ĐẦU TƯ VÀ XÂY DỰNG BÙI PHÚ GIA", DataType = "string", DisplayName = "Tên công ty", Description = "Tên pháp lý lấy từ nguồn mã số thuế công khai.", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyLogoUrl", ConfigValue = "https://graph.facebook.com/phungatuvaco/picture?type=large", DataType = "string", DisplayName = "Logo công ty", Description = "Ảnh đại diện Fanpage công khai dùng cho demo; có thể thay bằng logo nội bộ.", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyTaxCode", ConfigValue = "0108326945", DataType = "string", DisplayName = "Mã số thuế", Description = "Mã số thuế doanh nghiệp.", CreatedAt = DateTime.UtcNow },
                new SystemConfig { ConfigKey = "CompanyAddress", ConfigValue = "Tầng 4, LK 4B-(7) khu tái định cư đô thị Mỗ Lao, Phường Mộ Lao, Quận Hà Đông, Thành phố Hà Nội, Việt Nam", DataType = "string", DisplayName = "Địa chỉ trụ sở", Description = "Địa chỉ theo nguồn mã số thuế công khai.", CreatedAt = DateTime.UtcNow }
            };

            var existingConfigs = await context.SystemConfigs.ToDictionaryAsync(c => c.ConfigKey);
            foreach (var wanted in desiredConfigs)
            {
                if (existingConfigs.TryGetValue(wanted.ConfigKey, out var current))
                {
                    current.ConfigValue = wanted.ConfigValue;
                    current.DataType    = wanted.DataType;
                    current.DisplayName = wanted.DisplayName;
                    current.Description = wanted.Description;
                    current.Unit        = wanted.Unit;
                    current.UpdatedAt   = null;   // giữ cột "Cập nhật lúc" trống như cấu hình chưa từng sửa
                }
                else
                {
                    wanted.CreatedBy = adminId;
                    context.SystemConfigs.Add(wanted);
                }
            }
            await context.SaveChangesAsync();
        }

        foreach (var config in await context.SystemConfigs.ToListAsync())
            config.CreatedBy ??= adminId;
        await context.SaveChangesAsync();

        return new MasterData(units, cats, suppliers);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MATERIAL CATALOG
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task<List<MaterialCatalog>> SeedMaterialsAsync(
        AppDbContext context, List<Unit> units, List<MaterialCategory> cats, long adminId)
    {
        var catalogs = await context.MaterialCatalogs.ToListAsync();
        if (catalogs.Any()) return catalogs;

        Unit Bao(string code)             => units.First(u => u.UnitCode == code);
        MaterialCategory Cat(string name) => cats.First(c => c.CategoryName == name);

        catalogs = new List<MaterialCatalog>
        {
            new() { Code="XM-HT-PC40", Name="Xi măng Hà Tiên PC40", Specification="Bao 50kg, dùng cho bê tông móng/dầm/sàn; kiểm tra CO/CQ theo lô", CategoryId=Cat("Xi măng").CategoryId, BaseUnitId=Bao("BAO").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="THEP-HP-D10", Name="Thép thanh vằn Hòa Phát D10 CB300-V", Specification="Cây 11,7m; đường kính danh nghĩa 10mm; nghiệm thu theo bó/cây", CategoryId=Cat("Sắt thép xây dựng").CategoryId, BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="THEP-HP-D12", Name="Thép thanh vằn Hòa Phát D12 CB300-V", Specification="Cây 11,7m; dùng thép dầm/sàn/móng; cân ký thực tế khi nhập", CategoryId=Cat("Sắt thép xây dựng").CategoryId, BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="THEP-HP-D16", Name="Thép thanh vằn Hòa Phát D16 CB400-V", Specification="Cây 11,7m; dùng thép chủ cột/dầm; kiểm đường kính và tem bó", CategoryId=Cat("Sắt thép xây dựng").CategoryId, BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="THEP-HP-D20", Name="Thép thanh vằn Hòa Phát D20 CB400-V", Specification="Cây 11,7m; thép chủ móng/dầm chính; quy đổi tấn khi mua", CategoryId=Cat("Sắt thép xây dựng").CategoryId, BaseUnitId=Bao("KG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="CAT-VANG-TN", Name="Cát vàng Tây Ninh làm bê tông", Specification="Cát sạch, hạt trung đến thô, dùng trộn bê tông móng/dầm/sàn", CategoryId=Cat("Cát đá vật liệu rời").CategoryId, BaseUnitId=Bao("M3").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="CAT-MIN-TRAT", Name="Cát mịn trát tường", Specification="Cát sàng, ít tạp chất hữu cơ, dùng vữa xây tô", CategoryId=Cat("Cát đá vật liệu rời").CategoryId, BaseUnitId=Bao("M3").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="DA-12-DN", Name="Đá 1x2 Đồng Nai", Specification="Đá nghiền kích thước 10-20mm, dùng bê tông thương phẩm/trộn tại công trường", CategoryId=Cat("Cát đá vật liệu rời").CategoryId, BaseUnitId=Bao("M3").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="GACH-TUYNEL-8x8x18", Name="Gạch ống 8x8x18 Tuynel", Specification="Gạch đất sét nung 4 lỗ, xây tường 100/200; nghiệm thu theo thiên", CategoryId=Cat("Gạch xây dựng").CategoryId, BaseUnitId=Bao("CAI").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="SON-DULUX-W18", Name="Sơn nước Dulux Weathershield", Specification="Thùng 18L, sơn ngoại thất, thi công 2 lớp sau bả và sơn lót", CategoryId=Cat("Sơn & vật liệu hoàn thiện").CategoryId, BaseUnitId=Bao("THUNG").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="CADIVI-2.5", Name="Dây cáp điện Cadivi 2.5mm", Specification="Cuộn 100m, lõi đồng, dùng ổ cắm/chiếu sáng dân dụng", CategoryId=Cat("Thiết bị điện").CategoryId, BaseUnitId=Bao("CUON").UnitId, CreatedAt=DateTime.UtcNow },
            new() { Code="PVC-BM-D90", Name="Ống nước nhựa PVC Bình Minh D90", Specification="Ống PVC D90, dùng thoát nước trục đứng/sân thượng, tính theo mét dài", CategoryId=Cat("Vật liệu cấp thoát nước").CategoryId, BaseUnitId=Bao("MET").UnitId, CreatedAt=DateTime.UtcNow },
        };
        catalogs.ForEach(x => x.CreatedBy = adminId);
        context.MaterialCatalogs.AddRange(catalogs);
        await context.SaveChangesAsync();

        if (!await context.MaterialConversions.AnyAsync())
        {
            var unitTan  = units.First(u => u.UnitCode == "TAN").UnitId;
            context.MaterialConversions.AddRange(
                catalogs.Where(c => c.Code.StartsWith("THEP-HP-")).Select(c =>
                    new MaterialConversion { MaterialId = c.MaterialId, AlternativeUnitId = unitTan, ConversionRate = 0.001m, CreatedAt = DateTime.UtcNow, CreatedBy = adminId })
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
            new { Ten="Nhà ở liền kề LK4B Mỗ Lao - Hà Đông", DiaChi="LK 4B-(7), Khu tái định cư đô thị Mỗ Lao, Phường Mộ Lao, Quận Hà Đông, Hà Nội", TrangThai="Completed",  BatDau=new DateOnly(2025, 3, 10), KetThuc=new DateOnly(2025, 10, 25) },
            new { Ten="Cải tạo hoàn thiện văn phòng Bùi Phú Gia", DiaChi="Tầng 4, LK 4B-(7), Khu tái định cư đô thị Mỗ Lao, Hà Đông, Hà Nội", TrangThai="Completed",  BatDau=new DateOnly(2025, 8, 5), KetThuc=new DateOnly(2025, 12, 15) },
            new { Ten="Nhà phố thương mại KĐT Văn Phú", DiaChi="Khu đô thị Văn Phú, Phường Phú La, Quận Hà Đông, Hà Nội", TrangThai="InProgress", BatDau=new DateOnly(2026, 2, 18), KetThuc=new DateOnly(2026, 11, 30) },
            new { Ten="Biệt thự vườn An Khánh - Hoài Đức", DiaChi="Khu đô thị An Khánh, Hoài Đức, Hà Nội", TrangThai="InProgress", BatDau=new DateOnly(2026, 3, 12), KetThuc=new DateOnly(2026, 12, 20) },
            new { Ten="Xưởng sản xuất phụ trợ Quang Minh", DiaChi="Khu công nghiệp Quang Minh, Mê Linh, Hà Nội", TrangThai="Draft", BatDau=new DateOnly(2026, 9, 15), KetThuc=new DateOnly(2027, 5, 30) },
            // Dự án có ngày mốc tính theo NGÀY CHẠY SEED, không cố định.
            // Giai đoạn 2 luôn bao trùm ngày hôm nay (today-15 → today+30), nhờ đó các nghiệp vụ
            // bắt buộc ngày chứng từ phải nằm trong khoảng giai đoạn — tạo Đơn mua hàng (ngày đơn
            // hàng = hôm nay) và Mua khẩn cấp (ngày mua = hôm nay) — mới thực hiện được.
            // Các dự án có ngày cố định phía trên đều đã kết thúc giai đoạn thi công trước hôm nay.
            new { Ten="Chung cư mini Tố Hữu - Hà Đông", DiaChi="Số 25 ngõ 71 Tố Hữu, Phường Vạn Phúc, Quận Hà Đông, Hà Nội", TrangThai="InProgress", BatDau=today.AddDays(-60), KetThuc=today.AddDays(200) },
        };

        var seededProjects = new List<(Project Project, User Leader, string Status)>();

        for (int i = 0; i < dsDuAn.Length; i++)
        {
            var dp     = dsDuAn[i];
            var leader = leaders[i % leaders.Length];
            var ksA    = kysus[(i * 2)     % kysus.Length];
            var ksB    = kysus[(i * 2 + 1) % kysus.Length];

            var project = new Project
            {
                Name         = dp.Ten,
                Address      = dp.DiaChi,
                PlannedStart = dp.BatDau,
                PlannedEnd   = dp.KetThuc,
                Status       = dp.TrangThai,   // ProjectStatus constant
                CreatedAt    = DateTime.UtcNow,
                CreatedBy    = tpkt.UserId
            };
            context.Projects.Add(project);
            await context.SaveChangesAsync();
            seededProjects.Add((project, leader, dp.TrangThai));
            context.Attachments.Add(new Attachment
            {
                EntityType = EntityType.Project,
                EntityId = project.ProjectId,
                AttachmentType = AttachmentType.Design,
                FileName = $"ban-ve-tong-mat-bang-{project.ProjectId}.pdf",
                FileUrl = $"/seed/projects/{project.ProjectId}/design.pdf",
                ContentType = "application/pdf",
                FileSizeBytes = 2_097_152,
                CreatedAt = project.CreatedAt,
                CreatedBy = tpkt.UserId
            });
            await context.SaveChangesAsync();

            // leader is SiteEngineer with IsLeader=true
            context.ProjectMembers.AddRange(
                new ProjectMember { ProjectId=project.ProjectId, UserId=leader.UserId, IsLeader=true,  JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow, CreatedBy=tpkt.UserId },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksA.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow, CreatedBy=tpkt.UserId },
                new ProjectMember { ProjectId=project.ProjectId, UserId=ksB.UserId,    IsLeader=false, JoinedAt=DateTime.UtcNow, CreatedAt=DateTime.UtcNow, CreatedBy=tpkt.UserId }
            );
            await context.SaveChangesAsync();

            // ── Phase completion: Completed → all approved, InProgress → phase1 approved + phase2 đang thi công
            var phases = new[]
            {
                new { Ten="Giai đoạn 1: Chuẩn bị & Thi công Cọc/Móng", ThuTu=1, Pct = dp.TrangThai is "Completed" or "InProgress" ? 100 : 0 },
                new { Ten="Giai đoạn 2: Thi công Khung Thân bê tông cốt thép", ThuTu=2, Pct = dp.TrangThai == "Completed" ? 100 : (dp.TrangThai == "InProgress" ? 55 : 0) },
                new { Ten="Giai đoạn 3: Thi công Xây tô & Hoàn thiện", ThuTu=3, Pct = dp.TrangThai == "Completed" ? 100 : 0 },
                new { Ten="Giai đoạn 4: Lắp đặt Thiết bị & Bàn giao", ThuTu=4, Pct = dp.TrangThai == "Completed" ? 100 : 0 },
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
                    Description = $"Giai đoạn {pd.Ten.ToLowerInvariant()} của dự án {project.Name}.",
                    OrderIndex = pd.ThuTu,
                    Status     = phaseStatus,
                    StartDate  = dp.BatDau.AddDays((pd.ThuTu - 1) * 45),
                    // Giai đoạn cuối kéo tới ngày kết thúc dự án. Nếu dự án kết thúc sớm hơn mốc
                    // 135 ngày thì lấy ngày bắt đầu giai đoạn cộng thêm 45, tránh sinh ra giai đoạn
                    // có ngày bắt đầu lớn hơn ngày kết thúc (mọi rule kiểm tra ngày sẽ sai theo).
                    EndDate    = pd.ThuTu == 4
                                   ? (dp.KetThuc > dp.BatDau.AddDays(135) ? dp.KetThuc : dp.BatDau.AddDays(180))
                                   : dp.BatDau.AddDays(pd.ThuTu * 45),
                    CreatedAt  = DateTime.UtcNow,
                    CreatedBy  = tpkt.UserId
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
                        UnitId = finalUnit, Quantity = qty, ConversionRate = convRate,
                        CreatedAt = DateTime.UtcNow, CreatedBy = tpkt.UserId
                    });
                }
                await context.SaveChangesAsync();

                // PhaseAcceptance for Approved phases
                if (isPhaseApproved)
                {
                    var acceptanceDate = DateTime.SpecifyKind(
                        phase.EndDate!.Value.ToDateTime(new TimeOnly(9, 0)), DateTimeKind.Utc).AddDays(1);
                    var acceptance = new PhaseAcceptance
                    {
                        PhaseId        = phase.PhaseId,
                        AcceptedBy     = tpkt.UserId,
                        AcceptanceDate = acceptanceDate,
                        PdfUrl         = $"/seed/acceptances/phase-{phase.PhaseId}.pdf",
                        ReportContent  = $@"### 2. Thành phần trực tiếp nghiệm thu:
* **Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát):**
  - Ông/Bà: Nguyễn Minh Đức  Chức vụ: Trưởng phòng Kỹ thuật
* **Đại diện Nhà thầu thi công:**
  - Ông/Bà: {leader.FullName}  Chức vụ: Chỉ huy trưởng công trình

### 3. Thời gian nghiệm thu:
* Bắt đầu: {acceptanceDate:dd/MM/yyyy}
* Kết thúc: {acceptanceDate:dd/MM/yyyy}
* Tại công trình: {project.Address}

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
                        CreatedAt      = acceptanceDate,
                        CreatedBy      = tpkt.UserId
                    };
                    context.PhaseAcceptances.Add(acceptance);
                    await context.SaveChangesAsync();
                    context.Attachments.Add(new Attachment
                    {
                        EntityType = EntityType.PhaseAcceptance,
                        EntityId = acceptance.AcceptanceId,
                        AttachmentType = AttachmentType.AcceptancePdf,
                        FileName = $"nghiem-thu-phase-{phase.PhaseId}.pdf",
                        FileUrl = acceptance.PdfUrl,
                        ContentType = "application/pdf",
                        FileSizeBytes = 524_288,
                        CreatedAt = acceptanceDate,
                        CreatedBy = tpkt.UserId
                    });
                    await context.SaveChangesAsync();
                }

                // ── TASKS ────────────────────────────────────────────────────
                // TaskStatus: New | Assigned | InProgress | Completed | Approved | Obsolete
                string[] taskNames = pd.ThuTu switch
                {
                    1 => new[] { "Định vị tim cọc, ranh móng và cote ±0.000", "Ép cọc BTCT 250x250 theo hồ sơ thiết kế", "Đào đất hố móng và vận chuyển đất thừa", "Đổ bê tông lót móng đá 4x6 mác 100", "Gia công lắp dựng thép móng, cổ cột", "Lắp cốp pha móng, giằng móng", "Đổ bê tông móng, giằng móng", "Tháo cốp pha và bảo dưỡng bê tông móng" },
                    2 => new[] { "Gia công lắp dựng thép cột tầng 1", "Lắp dựng cốp pha cột, dầm, sàn tầng 1", "Đặt thép dầm sàn tầng 1", "Đổ bê tông cột, dầm, sàn tầng 1", "Bảo dưỡng bê tông tầng 1", "Lắp dựng cốp pha, thép dầm sàn tầng 2", "Đổ bê tông dầm sàn tầng 2", "Thi công cầu thang và mái bê tông cốt thép" },
                    3 => new[] { "Xây tường gạch ống 8x8x18 tầng trệt và tầng lầu", "Tô trát tường trong nhà", "Tô trát tường ngoài nhà", "Đi đường ống điện âm tường", "Đi đường ống cấp thoát nước âm tường", "Chống thấm WC, ban công, sân thượng", "Ốp lát gạch sàn và gạch tường khu vệ sinh", "Sơn bả hoàn thiện, sơn nước 2 lớp" },
                    _ => new[] { "Lắp thiết bị điện, tủ điện, công tắc ổ cắm", "Lắp đèn chiếu sáng và đèn trang trí", "Lắp thiết bị vệ sinh", "Lắp cửa gỗ, cửa nhôm kính, lan can", "Kiểm tra vận hành hệ điện nước", "Vệ sinh công nghiệp toàn bộ công trình", "Nghiệm thu hoàn công nội bộ", "Bàn giao công trình cho chủ đầu tư" }
                };
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
                        Name            = tName,
                        Description     = $"{project.Name}: {tName}. Tuân thủ bản vẽ thi công, biện pháp an toàn và nghiệm thu nội bộ trước khi chuyển bước.",
                        OrderIndex      = taskIdx + 1,
                        StartDate       = tStartDate,
                        EndDate         = tEndDate,
                        Status          = taskStatus,
                        ProgressPercent = tProgress,
                        Weight          = 1,
                        IsOutsourced    = isPhaseActive && taskIdx == 2,
                        OutsourcedTeamName = isPhaseActive && taskIdx == 2 ? "Đội thi công Minh Thành" : null,
                        OutsourcedTeamContact = isPhaseActive && taskIdx == 2 ? "0908 123 456" : null,
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

                // Chỉ seed một dependency Finish-to-Start minh họa cho phase đầu của
                // mỗi dự án Draft. Hai task cùng phase và đều chưa bắt đầu.
                if (dp.TrangThai == ProjectStatus.Draft && pd.ThuTu == 1)
                {
                    context.TaskDependencies.Add(new TaskDependency
                    {
                        TaskId = createdTasks[1].TaskId,
                        PredecessorTaskId = createdTasks[0].TaskId
                    });
                    await context.SaveChangesAsync();
                }

                // ── WBS CHILD TASKS ───────────────────────────────────────────
                // Thêm task con vào các task cha để tạo cấu trúc WBS phân cấp
                await SeedWbsChildTasksAsync(context, createdTasks, phase, pd.ThuTu,
                    isPhaseApproved, isPhaseActive, ksA, ksB, tpkt, rnd);

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
            // Seed cho MỌI dự án đang thi công: mua khẩn cấp chỉ thao tác được trên giai đoạn
            // đang thi công, nên dự án nào cũng cần sẵn một phiếu mẫu để đối chiếu.
            if (dp.TrangThai == "InProgress")
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
        }

        var transferTarget = seededProjects.First(x => x.Status == ProjectStatus.InProgress);
        foreach (var completed in seededProjects.Where(x => x.Status == ProjectStatus.Completed))
        {
            await SeedSurplusAsync(
                context, completed.Project, completed.Leader,
                transferTarget.Project, transferTarget.Leader,
                tpkt, ketoan, suppliers.First());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WBS CHILD TASKS
    // Tạo cấu trúc WBS phân cấp: task cha → nhiều task con
    // Áp dụng cho tất cả dự án, tất cả giai đoạn, mô phỏng WBS thực tế thi công
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedWbsChildTasksAsync(
        AppDbContext context,
        List<ProjectTask> parentTasks,
        Phase phase,
        int phaseOrder,
        bool isPhaseApproved,
        bool isPhaseActive,
        User ksA, User ksB, User tpkt,
        Random rnd)
    {
        // Định nghĩa các task con theo từng giai đoạn
        // Key = chỉ số của task cha trong parentTasks (0-based)
        // Value = danh sách tên task con
        var subTaskDefs = phaseOrder switch
        {
            // ─── Giai đoạn 1: Chuẩn bị & Thi công Cọc/Móng ───
            1 => new Dictionary<int, string[]>
            {
                [0] = new[] // Định vị tim cọc, ranh móng
                {
                    "Kiểm tra và hiệu chỉnh máy trắc đạc (máy toàn đạc)",
                    "Định vị tim cọc và tim trục từ mốc chuẩn của dự án",
                    "Đóng cọc tiêu xác định ranh nền móng theo bản vẽ",
                    "Kiểm tra lại toàn bộ vị trí tim cọc và lập biên bản",
                },
                [1] = new[] // Ép cọc BTCT 250x250
                {
                    "Vệ sinh mặt bằng và tập kết cọc BTCT đến vị trí ép",
                    "Kiểm tra chất lượng cọc, đánh số và đánh dấu đoạn cọc",
                    "Vận hành máy ép thủy lực, ép đoạn cọc đầu tiên",
                    "Ghép nối đoạn cọc (hàn mối nối) và tiếp tục ép",
                    "Kiểm tra tải trọng ép cuối (Pep ≥ 2.5×Ptk)",
                    "Lập biên bản nghiệm thu từng cọc ép xong",
                    "Cắt đầu cọc thừa theo đúng cốt thiết kế móng",
                },
                [2] = new[] // Đào đất hố móng
                {
                    "Xác định cote đào và phạm vi hố móng theo bản vẽ",
                    "Đào đất bằng máy đào đến cote -0.5m so thiết kế",
                    "Đào thủ công hoàn thiện đáy hố đến đúng cote thiết kế",
                    "Bơm thoát nước hố đào và gia cố thành vách hố",
                    "Vận chuyển đất thừa ra ngoài công trường",
                },
                [4] = new[] // Gia công lắp dựng thép móng, cổ cột
                {
                    "Gia công thép đai và thép chủ móng đơn / móng băng",
                    "Lắp dựng khung thép móng, kê con kê bảo vệ bê tông",
                    "Gia công và lắp dựng thép cổ cột tầng trệt",
                    "Kiểm tra kích thước, khoảng cách, lớp bảo vệ thép",
                    "Lập biên bản nghiệm thu thép móng trước khi đổ BT",
                },
                [5] = new[] // Lắp cốp pha móng, giằng móng
                {
                    "Lắp dựng cốp pha thành móng và giằng móng",
                    "Lắp cốp pha cổ cột và chèn chống lún cốp pha",
                    "Kiểm tra độ phẳng, thẳng đứng và kín khít cốp pha",
                    "Neo giằng cốp pha đảm bảo ổn định khi đổ bê tông",
                },
                [6] = new[] // Đổ bê tông móng, giằng móng
                {
                    "Vệ sinh hố móng, tưới ẩm cốp pha trước khi đổ",
                    "Điều phối xe bê tông thương phẩm và bơm bê tông",
                    "Đổ bê tông móng đơn và móng băng theo từng đợt",
                    "Đầm dùi bê tông đảm bảo bê tông không bị rỗng",
                    "Đổ bê tông giằng móng và cổ cột",
                    "Gạt phẳng mặt bê tông và kiểm tra cao trình đỉnh móng",
                },
                [7] = new[] // Tháo cốp pha và bảo dưỡng bê tông móng
                {
                    "Tháo cốp pha thành móng sau 24h (theo tiêu chuẩn)",
                    "Tưới nước bảo dưỡng bê tông liên tục 7 ngày đêm",
                    "Lấp đất xung quanh móng và đầm chặt theo từng lớp",
                    "Kiểm tra chất lượng bê tông bằng súng bắn Schmidt",
                },
            },

            // ─── Giai đoạn 2: Khung Thân bê tông cốt thép ───
            2 => new Dictionary<int, string[]>
            {
                [0] = new[] // Gia công lắp dựng thép cột tầng 1
                {
                    "Gia công thép chủ (φ16-φ22) và thép đai cột tầng 1",
                    "Lắp dựng và nối thép cột, căn chỉnh tim cốt đúng vị trí",
                    "Buộc thép đai đúng khoảng cách, định vị con kê bảo vệ",
                    "Kiểm tra và nghiệm thu thép cột trước đổ bê tông",
                },
                [1] = new[] // Lắp dựng cốp pha cột, dầm, sàn tầng 1
                {
                    "Lắp dựng giàn giáo chống đỡ (cây chống thép/gỗ)",
                    "Lắp cốp pha cột tầng 1 (ván khuôn thép/ván dán phủ phim)",
                    "Lắp cốp pha đáy dầm chính và dầm phụ tầng 1",
                    "Lắp cốp pha thành dầm và cốp pha sàn tầng 1",
                    "Kiểm tra độ phẳng, thẳng đứng và kín khít toàn bộ cốp pha",
                    "Neo chống cốp pha tránh phồng vênh khi đổ bê tông",
                },
                [2] = new[] // Đặt thép dầm sàn tầng 1
                {
                    "Gia công thép dầm chính (φ18-φ25) theo bản vẽ kết cấu",
                    "Đặt và buộc thép dầm chính vào đúng vị trí",
                    "Gia công và đặt thép dầm phụ",
                    "Đặt thép sàn lớp dưới (thép chịu lực)",
                    "Lắp đặt ống gen điện, cơ điện âm sàn",
                    "Đặt thép sàn lớp trên (thép phân bố) và kiểm tra lớp bảo vệ",
                    "Nghiệm thu thép dầm sàn và lập biên bản trước đổ BT",
                },
                [3] = new[] // Đổ bê tông cột, dầm, sàn tầng 1
                {
                    "Vệ sinh và tưới ẩm cốp pha trước khi đổ bê tông",
                    "Điều phối xe bơm bê tông thương phẩm mác 300",
                    "Đổ và đầm dùi bê tông cột tầng 1",
                    "Đổ bê tông dầm chính, dầm phụ tầng 1",
                    "Đổ bê tông sàn tầng 1, đầm và gạt phẳng",
                    "Xoa nền, kiểm tra cao trình sàn bằng máy laser",
                },
                [4] = new[] // Bảo dưỡng bê tông tầng 1
                {
                    "Tưới nước bảo dưỡng ngay sau khi bê tông đông kết (4-8h)",
                    "Phủ bao tải/bạt giữ ẩm bề mặt sàn",
                    "Tưới nước bảo dưỡng định kỳ trong 7 ngày liên tục",
                    "Kiểm tra cường độ bê tông bằng súng bắn Schmidt",
                    "Tháo cốp pha cột sau 24h và cốp pha dầm sàn sau 7 ngày",
                },
                [5] = new[] // Lắp dựng cốp pha, thép dầm sàn tầng 2
                {
                    "Lắp giàn giáo và cốp pha dầm sàn tầng 2",
                    "Gia công và lắp đặt thép dầm tầng 2",
                    "Đặt thép sàn và ống gen cơ điện tầng 2",
                    "Kiểm tra, nghiệm thu thép và cốp pha tầng 2",
                },
                [6] = new[] // Đổ bê tông dầm sàn tầng 2
                {
                    "Chuẩn bị xe bơm bê tông và dụng cụ đầm dùi",
                    "Đổ bê tông dầm chính và dầm phụ tầng 2",
                    "Đổ bê tông sàn tầng 2, đầm và gạt phẳng",
                    "Xoa nền và kiểm tra cao trình bề mặt sàn tầng 2",
                    "Bảo dưỡng bê tông sàn tầng 2 trong 7 ngày",
                },
                [7] = new[] // Thi công cầu thang và mái bê tông
                {
                    "Lắp cốp pha và thép cầu thang bộ",
                    "Đổ bê tông cầu thang, đầm và hoàn thiện mặt bậc",
                    "Lắp cốp pha và thép mái bê tông cốt thép",
                    "Đổ bê tông mái, tạo dốc thoát nước và bảo dưỡng",
                },
            },

            // ─── Giai đoạn 3: Xây Tô & Hoàn thiện ───
            3 => new Dictionary<int, string[]>
            {
                [0] = new[] // Xây tường gạch
                {
                    "Vạch mực tim tường và kiểm tra đường cắt nước",
                    "Ngâm và chuẩn bị gạch, vữa xi măng cát vàng",
                    "Xây tường gạch ống 8x8x18 tầng trệt theo dây căng",
                    "Xây tường gạch các tầng lầu và tường bao che",
                    "Kiểm tra độ phẳng, thẳng đứng và đúng vị trí cửa",
                    "Trát bít các lỗ hổng và xử lý mối nối giữa tường và cột",
                },
                [1] = new[] // Tô trát tường trong nhà
                {
                    "Vệ sinh bề mặt tường và tưới ẩm trước khi tô",
                    "Trát vữa lót lớp 1 (scratch coat) dày 12-15mm",
                    "Chờ vữa lót khô đạt độ ẩm, trát lớp mặt hoàn thiện",
                    "Xử lý các góc, vị trí tiếp giáp cửa và lanh tô",
                    "Chà nhám và kiểm tra độ phẳng bề mặt bằng thước 2m",
                },
                [2] = new[] // Tô trát tường ngoài nhà
                {
                    "Dựng giàn giáo bên ngoài đảm bảo an toàn",
                    "Vệ sinh và tưới ẩm bề mặt tường ngoài",
                    "Trát vữa lớp lót tường ngoài chịu thời tiết",
                    "Trát lớp vữa mặt và tạo gờ trang trí theo thiết kế",
                    "Kiểm tra bề mặt, xử lý vết nứt và tháo giàn giáo",
                },
                [3] = new[] // Đi đường ống điện âm tường
                {
                    "Đánh dấu và đục rãnh đường ống theo bản vẽ điện",
                    "Luồn ống gen PVC φ16-φ25 theo sơ đồ mạch điện",
                    "Cố định ống gen và hộp đế công tắc, ổ cắm",
                    "Luồn dây điện qua ống gen và đấu sơ bộ đầu dây",
                    "Bít trát lại rãnh ống sau khi kiểm tra thông mạch",
                },
                [4] = new[] // Đi đường ống cấp thoát nước âm tường
                {
                    "Đánh dấu và đục rãnh đường ống cấp nước âm tường",
                    "Lắp đặt ống PPR cấp nước nóng/lạnh và van khóa",
                    "Đặt ống PVC thoát nước và ống thông hơi",
                    "Thử áp lực đường ống cấp nước (áp 10 bar/15 phút)",
                    "Bít trát lại rãnh sau khi thử áp lực đạt yêu cầu",
                },
                [5] = new[] // Chống thấm WC, ban công, sân thượng
                {
                    "Vệ sinh bề mặt, xử lý vết nứt và lỗ hổng",
                    "Quét lớp chống thấm gốc xi măng Sika lớp 1",
                    "Chờ lớp 1 khô, quét lớp chống thấm lớp 2 vuông góc",
                    "Thử nước ngâm 24-48 giờ kiểm tra không rò rỉ",
                    "Lập biên bản nghiệm thu chống thấm",
                },
                [6] = new[] // Ốp lát gạch sàn và gạch tường WC
                {
                    "Chuẩn bị vữa lót sàn, pha trộn xi măng cát đúng tỉ lệ",
                    "Trải vữa lót sàn và kiểm tra phẳng bằng máy laser",
                    "Ốp lát gạch sàn khu vệ sinh, bếp, ban công",
                    "Ốp gạch tường khu vệ sinh theo đúng thiết kế",
                    "Chà ron và vệ sinh bề mặt gạch sau khi hoàn thiện",
                },
                [7] = new[] // Sơn bả hoàn thiện
                {
                    "Bả ma tít tường lần 1 và chờ khô 8-12 giờ",
                    "Chà nhám lần 1 bằng giấy nhám 80, dọn bụi",
                    "Bả ma tít tường lần 2 và chờ khô",
                    "Chà nhám lần 2 bằng giấy nhám 120 (nhám mịn)",
                    "Sơn lót chống kiềm 1 lớp, chờ khô 4 giờ",
                    "Sơn phủ màu nước lớp 1",
                    "Sơn phủ màu nước lớp 2 hoàn thiện",
                },
            },

            // ─── Giai đoạn 4: Lắp đặt Thiết bị & Bàn giao ───
            _ => new Dictionary<int, string[]>
            {
                [0] = new[] // Lắp thiết bị điện, tủ điện
                {
                    "Lắp đặt tủ điện chính: MCB tổng, MCB nhánh, đồng hồ điện",
                    "Đi dây điện từ tủ đến các hộp đế công tắc/ổ cắm",
                    "Lắp đặt công tắc, ổ cắm theo đúng sơ đồ bố trí",
                    "Đo điện trở cách điện và kiểm tra an toàn điện (≥1MΩ)",
                    "Lập biên bản kiểm tra và nghiệm thu hệ thống điện",
                },
                [1] = new[] // Lắp đèn chiếu sáng và trang trí
                {
                    "Lắp đặt đèn downlight âm trần phòng khách, phòng ngủ",
                    "Lắp đèn led thanh trang trí và đèn vách",
                    "Lắp đèn ngoài trời và đèn hành lang",
                    "Kiểm tra vận hành toàn bộ mạch đèn và hệ thống chiếu sáng",
                },
                [2] = new[] // Lắp thiết bị vệ sinh
                {
                    "Lắp đặt bồn cầu một khối và két nước âm tường",
                    "Lắp đặt lavabo, bộ vòi nóng lạnh và gương soi",
                    "Lắp đặt bộ vòi sen, vách kính tắm đứng",
                    "Kết nối đường ống cấp nước và thoát nước thiết bị",
                    "Kiểm tra vận hành, độ kín khít và không rò rỉ toàn bộ",
                },
                [3] = new[] // Lắp cửa gỗ, cửa nhôm kính, lan can
                {
                    "Lắp khung cửa gỗ công nghiệp phòng ngủ",
                    "Lắp cánh cửa gỗ, bản lề và tay nắm cửa",
                    "Lắp cửa nhôm kính ban công và cầu thang",
                    "Lắp lan can cầu thang inox/sắt sơn tĩnh điện",
                    "Lắp lan can ban công và ban công sân thượng",
                    "Kiểm tra độ kín, thẩm mỹ và an toàn lan can",
                },
                [4] = new[] // Kiểm tra vận hành hệ điện nước
                {
                    "Kiểm tra toàn bộ hệ thống điện: thông mạch, an toàn",
                    "Kiểm tra hệ thống cấp nước: áp lực, lưu lượng",
                    "Kiểm tra hệ thống thoát nước: thoát nhanh, không ứ đọng",
                    "Chạy thử toàn bộ thiết bị điện nước 24/24 trong 3 ngày",
                    "Lập danh sách khiếm khuyết (punch list) và hoàn thiện",
                },
                [5] = new[] // Vệ sinh công nghiệp
                {
                    "Vệ sinh công nghiệp sàn, tường, trần tầng trệt",
                    "Vệ sinh các tầng lầu và khu vệ sinh",
                    "Lau kính cửa, bề mặt nhôm và thiết bị",
                    "Thu dọn vật liệu thừa và rác thải công trường",
                    "Kiểm tra lần cuối và bàn giao mặt bằng cho nội bộ",
                },
                [6] = new[] // Nghiệm thu hoàn công nội bộ
                {
                    "Kiểm tra tổng thể toàn bộ công trình theo check-list",
                    "Đo đạc và lập hồ sơ hoàn công các hạng mục",
                    "Chụp ảnh và quay video toàn bộ công trình hoàn thành",
                    "Họp đánh giá chất lượng nội bộ (leader, TPKT, GĐ)",
                    "Lập biên bản nghiệm thu hoàn công nội bộ",
                },
                [7] = new[] // Bàn giao công trình
                {
                    "Chuẩn bị toàn bộ hồ sơ bàn giao: bản vẽ hoàn công, biên bản nghiệm thu",
                    "Tổ chức buổi bàn giao chính thức với chủ đầu tư",
                    "Hướng dẫn chủ đầu tư vận hành và bảo trì công trình",
                    "Ký biên bản bàn giao và thanh lý hợp đồng",
                    "Lưu trữ hồ sơ dự án vào kho lưu trữ BPG",
                },
            },
        };

        byte subProgress = isPhaseApproved ? (byte)100 : isPhaseActive ? (byte)30 : (byte)0;
        string subStatus = isPhaseApproved ? "Approved" : isPhaseActive ? "InProgress" : "New";
        bool subLocked   = isPhaseApproved;

        foreach (var (parentIdx, childNames) in subTaskDefs)
        {
            if (parentIdx >= parentTasks.Count) continue;
            var parent = parentTasks[parentIdx];

            // Sub-task kế thừa tiến độ gần đúng từ task cha
            byte actualProgress = isPhaseApproved ? (byte)100
                : isPhaseActive ? parent.ProgressPercent
                : (byte)0;

            int subIdx = 0;
            foreach (var childName in childNames)
            {
                // Chia tiến độ từng task con: task sau có tiến độ = tiến độ cha × tỉ lệ
                byte childPct = isPhaseApproved ? (byte)100
                    : isPhaseActive ? (byte)Math.Min(actualProgress, (byte)((subIdx + 1) * actualProgress / childNames.Length))
                    : (byte)0;

                var sub = new ProjectTask
                {
                    PhaseId       = phase.PhaseId,
                    ParentTaskId  = parent.TaskId,
                    Name          = childName,
                    Description   = $"[Task con] {childName}. Thuộc công việc cha: {parent.Name}. Tuân thủ bản vẽ thi công và biện pháp an toàn.",
                    OrderIndex    = subIdx + 1,
                    StartDate     = parent.StartDate.AddDays(subIdx * 2),
                    EndDate       = parent.StartDate.AddDays((subIdx + 1) * 2 + 1),
                    Status        = subStatus,
                    ProgressPercent = childPct,
                    Weight        = 1,
                    IsOutsourced  = false,
                    IsLocked      = subLocked,
                    CreatedAt     = DateTime.UtcNow,
                    CreatedBy     = tpkt.UserId
                };
                context.Tasks.Add(sub);
                await context.SaveChangesAsync();

                // Gán kỹ sư xen kẽ ksA / ksB cho task con có tiến độ
                if (childPct > 0 || isPhaseActive)
                {
                    var assignee = subIdx % 2 == 0 ? ksA : ksB;
                    context.TaskAssignees.Add(new TaskAssignee
                    {
                        TaskId     = sub.TaskId,
                        UserId     = assignee.UserId,
                        AssignedAt = DateTime.UtcNow
                    });
                    await context.SaveChangesAsync();
                }

                subIdx++;
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

        var descriptions = new[]
        {
            "Thời tiết nắng nhẹ 31°C; 18 công nhân, 01 chỉ huy trưởng, 01 kỹ sư hiện trường. Kiểm tra tim trục, cao độ và biện pháp an toàn trước khi thi công.",
            "Thời tiết nắng; 22 công nhân. Hoàn thành phần việc theo kế hoạch ngày, vật tư cấp đủ, có chụp ảnh hiện trạng và biên bản nghiệm thu nội bộ.",
            "Buổi chiều mưa nhẹ; 16 công nhân. Che phủ vật tư, bơm thoát nước cục bộ, tiếp tục thi công các vị trí trong nhà/khu vực an toàn.",
            "Thời tiết khô ráo; 25 công nhân chia 2 tổ. Kiểm tra kích thước, khoảng cách thép/cốp pha/đường ống trước khi nghiệm thu chuyển bước.",
            "Thời tiết nắng; 20 công nhân. Hoàn tất hạng mục trong ngày, vệ sinh mặt bằng, thu gom vật tư thừa và cập nhật khối lượng hoàn thành.",
        };

        var creatorOptions = new[] { ksA, leader }; // kỹ sư hoặc leader đều có thể ghi

        foreach (var task in tasks)
        {
            byte previousPct = 0;
            DailyLog? lastLog = null;
            var progressSteps = Enumerable.Range(1, logDates.Length)
                .Select(step => (byte)Math.Min(
                    task.ProgressPercent,
                    (task.ProgressPercent / (decimal)logDates.Length) * step))
                .ToArray();
            progressSteps[^1] = task.ProgressPercent;
            var taskStart = DateTime.SpecifyKind(
                task.StartDate.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc);
            var taskEnd = DateTime.SpecifyKind(
                task.EndDate.ToDateTime(new TimeOnly(17, 0)), DateTimeKind.Utc);
            var logEnd = taskEnd < DateTime.UtcNow.AddDays(-1) ? taskEnd : DateTime.UtcNow.AddDays(-1);
            if (logEnd < taskStart) logEnd = taskStart;

            for (int d = 0; d < logDates.Length; d++)
            {
                var creator  = creatorOptions[d % 2];
                var ratio = (double)(d + 1) / logDates.Length;
                var logTimestamp = taskStart.AddTicks((long)((logEnd - taskStart).Ticks * ratio));
                var logDate  = DateOnly.FromDateTime(logTimestamp);
                var newPct   = progressSteps[d];

                var log = new DailyLog
                {
                    TaskId             = task.TaskId,
                    LogDate            = logDate,
                    NewProgressPercent = newPct,
                    Description        = descriptions[d % descriptions.Length],
                    CreatedBy          = creator.UserId,
                    CreatedAt          = logTimestamp
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
                    CreatedAt     = logTimestamp,
                    CreatedBy     = creator.UserId,
                    UpdatedAt     = logTimestamp,
                    UpdatedBy     = creator.UserId
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
                    CreatedAt = lastLog.CreatedAt.AddHours(2),
                    CreatedBy = commenter.UserId
                });
                context.Attachments.Add(new Attachment
                {
                    EntityType = EntityType.DailyLog,
                    EntityId = lastLog.LogId,
                    AttachmentType = AttachmentType.DailyLogPhoto,
                    FileName = $"nhat-ky-{lastLog.LogId}.jpg",
                    FileUrl = $"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=80&bpg_log={lastLog.LogId}",
                    ContentType = "image/jpeg",
                    FileSizeBytes = 409_600,
                    CreatedAt = lastLog.CreatedAt,
                    CreatedBy = lastLog.CreatedBy
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
        var phaseStart = DateTime.SpecifyKind(
            phase.StartDate!.Value.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc);
        var requestDate = phaseStart.AddDays(5);
        var orderDate = phaseStart.AddDays(6);
        var receiptDate = phaseStart.AddDays(10);

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
            CreatedAt      = requestDate,
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr);
        await context.SaveChangesAsync();

        // PurchaseOrderStatus: Draft | Sent | PartiallyReceived | FullyReceived | Closed
        var po = new PurchaseOrder
        {
            RequestId            = mr.RequestId,
            ProjectId            = project.ProjectId,
            SupplierId           = suppliers.First().SupplierId,
            PONumber             = $"PO-{rnd.Next(1000, 9999)}",
            OrderDate            = orderDate,
            ExpectedDeliveryDate = DateOnly.FromDateTime(receiptDate),
            DeliveryAddress      = project.Address,
            Notes                = $"Cung ứng vật tư cho giai đoạn {phase.Name}.",
            Status               = "FullyReceived",   // PurchaseOrderStatus.FullyReceived
            TotalAmount          = 0,
            CreatedAt            = orderDate,
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
            CreatedAt     = receiptDate,
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(gr);
        await context.SaveChangesAsync();
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.GoodsReceipt,
            EntityId = gr.ReceiptId,
            AttachmentType = AttachmentType.DeliveryPhoto,
            FileName = $"phieu-giao-hang-{gr.ReceiptNo}.jpg",
            FileUrl = $"/seed/goods-receipts/{gr.ReceiptId}/delivery.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 286_720,
            CreatedAt = receiptDate,
            CreatedBy = leader.UserId
        });
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
        po.TotalAmount = await context.PurchaseOrderItems
            .Where(x => x.POId == po.POId)
            .SumAsync(x => x.LineTotal);
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
                TransactionType = InventoryTransactionType.GoodsReceipt,
                ReferenceId = gr.ReceiptId,
                ReferenceType = EntityType.GoodsReceipt,
                QuantityChange = qty,
                BalanceAfter = inv.Quantity,
                CreatedBy = leader.UserId,
                CreatedAt = receiptDate
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
            CreatedAt      = phaseStart.AddDays(24),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr2);
        await context.SaveChangesAsync();

        var po2 = new PurchaseOrder
        {
            RequestId            = mr2.RequestId,
            ProjectId            = project.ProjectId,
            SupplierId           = suppliers.Skip(1).FirstOrDefault()?.SupplierId ?? suppliers.First().SupplierId,
            PONumber             = $"PO-WAIT-{rnd.Next(1000, 9999)}",
            OrderDate            = phaseStart.AddDays(25),
            ExpectedDeliveryDate = DateOnly.FromDateTime(phaseStart.AddDays(40)),
            DeliveryAddress      = project.Address,
            Notes                = "Đơn hàng chia theo năng lực giao hàng của nhiều nhà cung cấp.",
            Status               = "Sent",   // Đang chờ giao!
            TotalAmount          = 0,
            CreatedAt            = phaseStart.AddDays(25),
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
                Quantity       = qty / 2,
                UnitPrice      = 10_000,
                LineTotal      = (qty / 2) * 10_000,
                ConversionRate = 1
            });
        }
        await context.SaveChangesAsync();
        po2.TotalAmount = await context.PurchaseOrderItems
            .Where(x => x.POId == po2.POId)
            .SumAsync(x => x.LineTotal);
        await context.SaveChangesAsync();

        var po2SecondSupplier = new PurchaseOrder
        {
            RequestId = mr2.RequestId,
            ProjectId = project.ProjectId,
            SupplierId = suppliers.Skip(3).FirstOrDefault()?.SupplierId ?? suppliers.First().SupplierId,
            PONumber = $"PO-SPLIT-{rnd.Next(1000, 9999)}",
            OrderDate = phaseStart.AddDays(26),
            ExpectedDeliveryDate = DateOnly.FromDateTime(phaseStart.AddDays(42)),
            Status = PurchaseOrderStatus.Sent,
            TotalAmount = 0,
            DeliveryAddress = project.Address,
            Notes = "Đơn hàng thứ hai tách từ cùng yêu cầu vật tư để chia năng lực cung ứng.",
            CreatedAt = phaseStart.AddDays(26),
            CreatedBy = ketoan.UserId
        };
        context.PurchaseOrders.Add(po2SecondSupplier);
        await context.SaveChangesAsync();

        foreach (var mat in catalogs.Take(3))
        {
            var requestedQuantity = mat.Name.Contains("Thép") ? 2000m : 100m;
            var orderedQuantity = requestedQuantity / 2;
            context.PurchaseOrderItems.Add(new PurchaseOrderItem
            {
                POId = po2SecondSupplier.POId,
                MaterialId = mat.MaterialId,
                UnitId = mat.BaseUnitId,
                Quantity = orderedQuantity,
                UnitPrice = 10_500,
                LineTotal = orderedQuantity * 10_500,
                ConversionRate = 1,
                Notes = "Phần khối lượng còn lại của yêu cầu vật tư."
            });
        }
        await context.SaveChangesAsync();
        po2SecondSupplier.TotalAmount = await context.PurchaseOrderItems
            .Where(x => x.POId == po2SecondSupplier.POId)
            .SumAsync(x => x.LineTotal);
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
            CreatedAt      = phaseStart.AddDays(11),
            CreatedBy      = leader.UserId
        };
        context.MaterialRequests.Add(mr3);
        await context.SaveChangesAsync();

        var po3 = new PurchaseOrder
        {
            RequestId            = mr3.RequestId,
            ProjectId            = project.ProjectId,
            SupplierId           = suppliers.Skip(2).FirstOrDefault()?.SupplierId ?? suppliers.First().SupplierId,
            PONumber             = $"PO-PARTIAL-{rnd.Next(1000, 9999)}",
            OrderDate            = phaseStart.AddDays(12),
            ExpectedDeliveryDate = DateOnly.FromDateTime(phaseStart.AddDays(30)),
            DeliveryAddress      = project.Address,
            Notes                = "Nhà cung cấp giao thành nhiều đợt theo tiến độ thi công.",
            Status               = "PartiallyReceived",   // Nhận một phần!
            TotalAmount          = 0,
            CreatedAt            = phaseStart.AddDays(12),
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
        po3.TotalAmount = po3Items.Sum(x => x.LineTotal);
        await context.SaveChangesAsync();

        // Create a Goods Receipt for PO 3 where some quantities are already received
        var gr3 = new GoodsReceipt
        {
            POId          = po3.POId,
            ReceiptNo     = $"GR-PARTIAL-{rnd.Next(1000, 9999)}",
            DelivererInfo = "Tài xế NCC Giao Đợt 1",
            DeliveryDocNo = $"DOC-PART-{rnd.Next(100, 999)}",
            Status        = "Approved",
            CreatedAt     = phaseStart.AddDays(18),
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(gr3);
        await context.SaveChangesAsync();
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.GoodsReceipt,
            EntityId = gr3.ReceiptId,
            AttachmentType = AttachmentType.DeliveryPhoto,
            FileName = $"phieu-giao-hang-{gr3.ReceiptNo}.jpg",
            FileUrl = $"/seed/goods-receipts/{gr3.ReceiptId}/delivery.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 276_480,
            CreatedAt = gr3.CreatedAt,
            CreatedBy = leader.UserId
        });
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
                TransactionType = InventoryTransactionType.GoodsReceipt,
                ReferenceId = gr3.ReceiptId,
                ReferenceType = EntityType.GoodsReceipt,
                QuantityChange = receivedQty,
                BalanceAfter = inv.Quantity,
                CreatedBy = leader.UserId,
                CreatedAt = phaseStart.AddDays(18)
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
        var plannedIssuanceDate = DateTime.SpecifyKind(
            task.StartDate.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc).AddDays(20);
        var issuanceDate = plannedIssuanceDate < DateTime.UtcNow.AddDays(-3)
            ? plannedIssuanceDate
            : DateTime.UtcNow.AddDays(-3);

        var issuance = new MaterialIssuance
        {
            TaskId    = task.TaskId,
            Purpose   = $"Xuất vật tư thi công task: {task.Name}",
            CreatedAt = issuanceDate,
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
                    TransactionType = InventoryTransactionType.Issuance,
                    ReferenceId = issuance.MaterialIssuanceId,
                    ReferenceType = EntityType.MaterialIssuance,
                    QuantityChange = -issueQty,
                    BalanceAfter = inv.Quantity,
                    CreatedBy = task.CreatedBy,
                    CreatedAt = issuanceDate
                });
            }
        }
        await context.SaveChangesAsync();

        var returnedMaterial = matsToIssue.First();
        const decimal returnQuantity = 5;
        var materialReturn = new MaterialReturn
        {
            ReturnNo = $"PTRA-{issuance.MaterialIssuanceId:D5}",
            OriginalIssuanceId = issuance.MaterialIssuanceId,
            Reason = "Vật tư còn nguyên quy cách sau khi hoàn thành phần việc, hoàn lại kho dự án.",
            CreatedAt = issuanceDate.AddDays(2),
            CreatedBy = task.CreatedBy
        };
        context.MaterialReturns.Add(materialReturn);
        await context.SaveChangesAsync();

        context.MaterialReturnItems.Add(new MaterialReturnItem
        {
            MaterialReturnId = materialReturn.MaterialReturnId,
            MaterialId = returnedMaterial.MaterialId,
            UnitId = returnedMaterial.BaseUnitId,
            Quantity = returnQuantity,
            ConversionRate = 1
        });

        var returnInventory = await context.CurrentInventories.FirstAsync(
            x => x.ProjectId == project.ProjectId && x.MaterialId == returnedMaterial.MaterialId);
        returnInventory.Quantity += returnQuantity;
        returnInventory.LastUpdated = materialReturn.CreatedAt;
        await context.SaveChangesAsync();

        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProjectId = project.ProjectId,
            MaterialId = returnedMaterial.MaterialId,
            TransactionType = InventoryTransactionType.IssuanceReturn,
            ReferenceId = materialReturn.MaterialReturnId,
            ReferenceType = EntityType.MaterialReturn,
            QuantityChange = returnQuantity,
            BalanceAfter = returnInventory.Quantity,
            CreatedBy = task.CreatedBy,
            CreatedAt = materialReturn.CreatedAt
        });
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
        var activePhase = await context.Phases
            .FirstAsync(p => p.ProjectId == project.ProjectId && p.Status == PhaseStatus.InProgress);
        var phaseEnd = DateTime.SpecifyKind(
            activePhase.EndDate!.Value.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc);
        var purchaseDate = DateTime.UtcNow.AddDays(-7) < phaseEnd
            ? DateTime.UtcNow.AddDays(-7)
            : phaseEnd.AddDays(-2);

        decimal dpQty      = rnd.Next(10, 30);         // 10-30 bao xi măng
        decimal dpUnitPrice = 95_000;                   // 95,000 VNĐ/bao
        decimal dpTotal    = dpQty * dpUnitPrice;

        // DirectPurchaseRequest: Status=Approved (đã hệ thống duyệt – within BOQ)
        var dp = new DirectPurchaseRequest
        {
            ProjectId    = project.ProjectId,
            PhaseId      = activePhase.PhaseId,
            RequestedBy  = leader.UserId,
            Reason       = "Thiếu xi măng khẩn cấp để đổ bê tông cột, không kịp đặt hàng qua quy trình thông thường",
            Status       = "Approved",         // DirectPurchaseStatus.Approved – within BOQ nên auto duyệt
            AuditStatus  = "Audited",          // DirectPurchaseAuditStatus.Audited – kế toán đã soát
            TotalAmount  = dpTotal,
            PurchaseDate = purchaseDate,
            AuditedBy    = ketoan.UserId,
            AuditedAt    = purchaseDate.AddDays(1),
            AuditNote    = "Đã kiểm tra hóa đơn và đối chiếu BOQ – hợp lệ, phê duyệt giải ngân.",
            CreatedAt    = purchaseDate,
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

        // Auto sinh PO từ mua khẩn cấp
        var autoPO = new PurchaseOrder
        {
            ProjectId            = project.ProjectId,
            SupplierId           = null,                   // mua tại chỗ, không có NCC trong hệ thống
            PONumber             = $"DP-PO-{rnd.Next(100, 999)}",
            OrderDate            = purchaseDate,
            ExpectedDeliveryDate = DateOnly.FromDateTime(purchaseDate),
            DeliveryAddress      = project.Address,
            Notes                = "Đơn tự sinh từ mua khẩn cấp tại cửa hàng địa phương.",
            Status               = "FullyReceived",        // nhận ngay tại chỗ
            TotalAmount          = dpTotal,
            CreatedAt            = purchaseDate,
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
            CreatedAt     = purchaseDate,
            CreatedBy     = leader.UserId
        };
        context.GoodsReceipts.Add(autoGR);
        await context.SaveChangesAsync();

        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.DirectPurchaseRequest,
            EntityId = dp.DirectPurchaseId,
            AttachmentType = AttachmentType.InvoicePhoto,
            FileName = $"hoa-don-mua-khan-{dp.DirectPurchaseId}.jpg",
            FileUrl = $"/seed/direct-purchases/{dp.DirectPurchaseId}/invoice.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 245_760,
            CreatedAt = purchaseDate,
            CreatedBy = leader.UserId
        });
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

        var resultingInventory = await context.CurrentInventories.FirstAsync(
            x => x.ProjectId == project.ProjectId && x.MaterialId == matKhanCap.MaterialId);
        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProjectId = project.ProjectId,
            MaterialId = matKhanCap.MaterialId,
            TransactionType = InventoryTransactionType.GoodsReceipt,
            ReferenceId = autoGR.ReceiptId,
            ReferenceType = EntityType.GoodsReceipt,
            QuantityChange = dpQty,
            BalanceAfter = resultingInventory.Quantity,
            CreatedBy = leader.UserId,
            CreatedAt = purchaseDate
        });
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
            PhaseId               = task.PhaseId,
            TaskId                = task.TaskId,
            ReportedBy            = ksA.UserId,      // SE tạo báo cáo sự cố
            ReviewedBy            = tpkt.UserId,     // TPKT thẩm định
            IncidentType          = "InventoryDamage",
            Description           = "Mưa lớn bất ngờ gây ngập hố móng, toàn bộ xi măng trong kho bị ướt hỏng",
            Status                = IncidentStatus.Closed,
            DamageDescription     = "30 bao xi măng PCB40 bị ướt và đóng cứng, không thể sử dụng",
            EstimatedMaterialLoss = 30,
            EstimatedLaborDays    = 3,
            EstimatedDelayDays    = 3,
            ProposedAction        = "Tạo phiếu giảm tồn kho 30 bao xi măng hỏng, yêu cầu cấp thêm vật tư",
            HandlingInstruction   = "Cách ly lô xi măng hỏng, lập biên bản và điều chỉnh giảm tồn kho sau khi Giám đốc duyệt.",
            RecoveryPlanText      = "Che chắn lại khu lưu kho, kê pallet cao và mua bù 30 bao xi măng.",
            RecoveryEstimateCost  = 2_850_000,
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

        var inventoryAdjusted = inv != null && inv.Quantity >= 30;
        if (inventoryAdjusted)
        {
            inv!.Quantity   -= 30;
            inv.LastUpdated = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();

        if (inventoryAdjusted)
        {
            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProjectId = project.ProjectId,
                MaterialId = matXiMang.MaterialId,
                TransactionType = InventoryTransactionType.Adjustment,
                ReferenceId = adj.AdjustmentId,
                ReferenceType = EntityType.InventoryAdjustment,
                QuantityChange = -30,
                BalanceAfter = inv!.Quantity,
                CreatedBy = gd.UserId,
                CreatedAt = adj.ApprovedAt!.Value
            });
        }
        context.Attachments.Add(new Attachment
        {
            EntityType = EntityType.Incident,
            EntityId = incident.IncidentId,
            AttachmentType = AttachmentType.IncidentPhoto,
            FileName = $"su-co-xi-mang-{incident.IncidentId}.jpg",
            FileUrl = $"/seed/incidents/{incident.IncidentId}/damage.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 327_680,
            CreatedAt = incident.CreatedAt,
            CreatedBy = ksA.UserId
        });
        await context.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SURPLUS REQUEST for Completed projects
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedSurplusAsync(
        AppDbContext context,
        Project project,
        User leader,
        Project transferTarget,
        User targetLeader,
        User technicalManager,
        User accountant,
        Supplier supplier)
    {
        var invItems = await context.CurrentInventories
            .Where(c => c.ProjectId == project.ProjectId && c.Quantity > 0)
            .ToListAsync();

        if (!invItems.Any()) return;
        var processedAt = DateTime.SpecifyKind(
            project.PlannedEnd.ToDateTime(new TimeOnly(8, 0)), DateTimeKind.Utc).AddDays(1);

        var surplus = new SurplusRequest
        {
            ProjectId = project.ProjectId,
            Reason    = "Dự án đã hoàn thành, kiểm kê và xử lý toàn bộ vật tư còn dư trong kho.",
            Status    = SurplusRequestStatus.Processed,
            CreatedAt = processedAt,
            CreatedBy = leader.UserId
        };
        context.SurplusRequests.Add(surplus);
        await context.SaveChangesAsync();

        for (var index = 0; index < invItems.Count; index++)
        {
            var inv = invItems[index];
            var quantity = inv.Quantity;
            var item = new SurplusRequestItem
            {
                SurplusRequestId = surplus.SurplusRequestId,
                MaterialId       = inv.MaterialId,
                UnitId           = inv.UnitId,
                Quantity         = quantity,
                ConversionRate   = 1,
                Status           = SurplusRequestItemStatus.Completed,
                CreatedAt        = processedAt,
                CreatedBy        = leader.UserId
            };
            context.SurplusRequestItems.Add(item);
            await context.SaveChangesAsync();

            long actionId;
            byte transactionType;
            string referenceType;

            if (index % 3 == 0)
            {
                var transfer = new SurplusTransfer
                {
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    FromProjectId = project.ProjectId,
                    ToProjectId = transferTarget.ProjectId,
                    TransferQuantity = quantity,
                    Status = SurplusTransferStatus.Received,
                    ApprovedBy = technicalManager.UserId,
                    ApprovedAt = processedAt.AddHours(1),
                    DispatchedBy = leader.UserId,
                    DispatchedAt = processedAt.AddHours(2),
                    ReceivedBy = targetLeader.UserId,
                    ReceivedAt = processedAt.AddHours(5),
                    CreatedAt = processedAt,
                    CreatedBy = leader.UserId
                };
                context.SurplusTransfers.Add(transfer);
                await context.SaveChangesAsync();
                actionId = transfer.SurplusTransferId;
                transactionType = InventoryTransactionType.TransferOut;
                referenceType = EntityType.SurplusTransferDispatch;

                var targetInventory = await context.CurrentInventories.FirstOrDefaultAsync(
                    x => x.ProjectId == transferTarget.ProjectId && x.MaterialId == inv.MaterialId);
                if (targetInventory == null)
                {
                    targetInventory = new CurrentInventory
                    {
                        ProjectId = transferTarget.ProjectId,
                        MaterialId = inv.MaterialId,
                        UnitId = inv.UnitId,
                        Quantity = quantity,
                        ReservedQuantity = 0,
                        LastUpdated = transfer.ReceivedAt!.Value
                    };
                    context.CurrentInventories.Add(targetInventory);
                }
                else
                {
                    targetInventory.Quantity += quantity;
                    targetInventory.LastUpdated = transfer.ReceivedAt!.Value;
                }
                await context.SaveChangesAsync();

                context.InventoryTransactions.Add(new InventoryTransaction
                {
                    ProjectId = transferTarget.ProjectId,
                    MaterialId = inv.MaterialId,
                    TransactionType = InventoryTransactionType.TransferIn,
                    ReferenceId = actionId,
                    ReferenceType = EntityType.SurplusTransferReceive,
                    QuantityChange = quantity,
                    BalanceAfter = targetInventory.Quantity,
                    CreatedBy = targetLeader.UserId,
                    CreatedAt = transfer.ReceivedAt.Value
                });
            }
            else if (index % 3 == 1)
            {
                var supplierReturn = new SurplusReturnSupplier
                {
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    SupplierId = supplier.SupplierId,
                    ReturnQuantity = quantity,
                    RefundAmount = quantity * 7_500,
                    Note = "Nhà cung cấp xác nhận nhận lại hàng còn nguyên bao bì và quy cách.",
                    CreatedAt = processedAt,
                    CreatedBy = accountant.UserId
                };
                context.SurplusReturnSuppliers.Add(supplierReturn);
                await context.SaveChangesAsync();
                actionId = supplierReturn.SurplusReturnSupplierId;
                transactionType = InventoryTransactionType.ReturnToSupplier;
                referenceType = EntityType.SurplusReturnSupplier;
            }
            else
            {
                var liquidation = new SurplusLiquidation
                {
                    SurplusRequestItemId = item.SurplusRequestItemId,
                    BuyerName = "Cơ sở thu mua vật liệu tái sử dụng Minh Phát",
                    LiquidationQuantity = quantity,
                    TotalAmount = quantity * 3_000,
                    CreatedAt = processedAt,
                    CreatedBy = accountant.UserId
                };
                context.SurplusLiquidations.Add(liquidation);
                await context.SaveChangesAsync();
                actionId = liquidation.SurplusLiquidationId;
                transactionType = InventoryTransactionType.Liquidation;
                referenceType = EntityType.SurplusLiquidation;
            }

            inv.Quantity    = 0;
            inv.LastUpdated = processedAt;
            await context.SaveChangesAsync();

            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProjectId = project.ProjectId,
                MaterialId = inv.MaterialId,
                TransactionType = transactionType,
                ReferenceId = actionId,
                ReferenceType = referenceType,
                QuantityChange = -quantity,
                BalanceAfter = 0,
                CreatedBy = leader.UserId,
                CreatedAt = processedAt
            });
            context.Attachments.Add(new Attachment
            {
                EntityType = EntityType.SurplusRequest,
                EntityId = surplus.SurplusRequestId,
                AttachmentType = AttachmentType.SurplusEvidence,
                FileName = $"bien-ban-xu-ly-{surplus.SurplusRequestId}-{item.SurplusRequestItemId}.pdf",
                FileUrl = $"/seed/surplus/{surplus.SurplusRequestId}/{item.SurplusRequestItemId}.pdf",
                ContentType = "application/pdf",
                FileSizeBytes = 184_320,
                CreatedAt = processedAt,
                CreatedBy = leader.UserId
            });
            await context.SaveChangesAsync();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedNotificationsAsync(AppDbContext context, Dictionary<string, User> users)
    {
        var gd     = users["giamdoc@bpg.com"];
        var tpkt   = users["tpkt@bpg.com"];
        var ketoan = users["ketoan@bpg.com"];
        var activeProject = await context.Projects.FirstAsync(x => x.Status == ProjectStatus.InProgress);
        var latestPo = await context.PurchaseOrders.OrderByDescending(x => x.OrderDate).FirstAsync();
        var latestIncident = await context.Incidents.OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync();

        context.Notifications.AddRange(
            new Notification
            {
                UserId    = gd.UserId,
                Title     = "Chào mừng",
                Content   = "Chào mừng Giám đốc đến với hệ thống BPG CMS.",
                NotificationType = NotificationType.System,
                ReferenceType = NotificationReferenceType.Project,
                ReferenceId = activeProject.ProjectId,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow
            },
            new Notification
            {
                UserId    = tpkt.UserId,
                Title     = "Nhắc nhở nghiệm thu",
                Content   = $"Dự án {activeProject.Name} đang thi công, cần theo dõi tiến độ và nghiệm thu đúng kế hoạch.",
                NotificationType = NotificationType.Progress,
                ReferenceType = NotificationReferenceType.Project,
                ReferenceId = activeProject.ProjectId,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new Notification
            {
                UserId    = ketoan.UserId,
                Title     = "Theo dõi đơn đặt hàng",
                Content   = $"Đơn đặt hàng {latestPo.PONumber} cần được theo dõi tình trạng giao vật tư.",
                NotificationType = NotificationType.Procurement,
                ReferenceType = NotificationReferenceType.PurchaseOrder,
                ReferenceId = latestPo.POId,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            }
        );
        if (latestIncident != null)
        {
            context.Notifications.Add(new Notification
            {
                UserId = tpkt.UserId,
                Title = "Sự cố đã được xử lý",
                Content = $"Sự cố #{latestIncident.IncidentId} đã hoàn tất phương án khắc phục và điều chỉnh tồn kho.",
                NotificationType = NotificationType.Incident,
                ReferenceType = NotificationReferenceType.Incident,
                ReferenceId = latestIncident.IncidentId,
                IsRead = true,
                ReadAt = DateTime.UtcNow.AddHours(-12),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
        }
        await context.SaveChangesAsync();
    }
}
