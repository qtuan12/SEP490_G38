using BPG.Domain.Entities;

namespace BPG.Application.IServices
{
    public interface IJwtService
    {
        string GenerateToken(User user);

        /// <summary>Sinh chuỗi refresh token ngẫu nhiên (giá trị thô trả về client, KHÔNG lưu DB).</summary>
        string GenerateRefreshToken();

        /// <summary>Hash refresh token để lưu vào cột TokenHash (không lưu plain text).</summary>
        string HashToken(string token);

        /// <summary>Số ngày sống của refresh token, đọc từ cấu hình Jwt:RefreshTokenExpiryDays.</summary>
        int RefreshTokenExpiryDays { get; }
    }
}
