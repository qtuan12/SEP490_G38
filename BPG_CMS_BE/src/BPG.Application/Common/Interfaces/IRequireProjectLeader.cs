namespace BPG.Application.Common.Interfaces;

/// <summary>
/// Đánh dấu Command yêu cầu người dùng phải là Trưởng dự án (Project Leader)
/// hoặc thuộc nhóm quản lý cấp cao (Giám đốc, Trưởng phòng kỹ thuật).
/// </summary>
public interface IRequireProjectLeader : IProjectRequirement
{
}
