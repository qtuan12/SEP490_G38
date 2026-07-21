namespace BPG.Application.Common.Interfaces;

/// <summary>
/// Đánh dấu Command yêu cầu người dùng phải là Kế toán hoặc Giám đốc.
/// </summary>
public interface IRequireAccountant : IProjectRequirement
{
}
