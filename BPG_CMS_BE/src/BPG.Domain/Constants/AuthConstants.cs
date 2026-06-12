namespace BPG.Domain.Constants;

/// <summary>
/// Tên các Authorization Policy đăng ký trong Program.cs.
/// Dùng với [Authorize(Policy = PolicyNames.xxx)] trên Controller/Action.
/// </summary>
public static class PolicyNames
{
    public const string RequireAdmin = "RequireAdmin";
    public const string RequireDirector = "RequireDirector";
    public const string RequireTechnicalManager = "RequireTechnicalManager";
    public const string RequireSiteEngineer = "RequireSiteEngineer";
    public const string RequireAccountant = "RequireAccountant";

    // Nhóm chính sách ghép nhiều vai trò
    public const string RequireManagerOrAbove = "RequireManagerOrAbove"; // TechnicalManager + Director + Admin
    public const string RequireFieldStaff = "RequireFieldStaff";         // SiteEngineer + TechnicalManager
    public const string RequireProcurement = "RequireProcurement";       // Accountant + Director + Admin
}

/// <summary>
/// Tên các custom claim trong JWT token.
/// Dùng khi tạo token (TokenService) và đọc token (CurrentUserService).
/// </summary>
public static class AppClaimTypes
{
    public const string UserId = "userId";         // Long – PK của User trong DB
    public const string Email = "email";           // Email đăng nhập
    public const string FullName = "fullName";     // Họ tên hiển thị
    public const string Role = "role";             // Vai trò (Admin, Director...)
    public const string ProjectIds = "projectIds"; // Danh sách project user được giao (csv: "1,2,5")
    public const string IsActive = "isActive";     // Tài khoản có đang hoạt động không
}
