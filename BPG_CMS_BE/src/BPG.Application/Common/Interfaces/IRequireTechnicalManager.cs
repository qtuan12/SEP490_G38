namespace BPG.Application.Common.Interfaces;

/// <summary>
/// Đánh dấu Command yêu cầu người dùng phải là Trưởng phòng Kỹ thuật hoặc Giám đốc.
/// </summary>
public interface IRequireTechnicalManager : IProjectRequirement
{
}
