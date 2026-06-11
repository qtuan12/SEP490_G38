namespace BPG.Application.DTOs.Users
{
    /// <summary>Request body cho PUT /api/users/{id} — chỉ chứa các trường cần update.</summary>
    public class UpdateUserRequest
    {
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
    }
}
