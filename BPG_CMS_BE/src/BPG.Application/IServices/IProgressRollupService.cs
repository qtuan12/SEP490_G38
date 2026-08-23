using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.IServices;

public interface IProgressRollupService
{
    /// <summary>
    /// Tính toán lại % tiến độ của task cha dựa trên các task con, theo trọng số số ngày (duration).
    /// </summary>
    Task RecalculateParentTaskProgressAsync(long parentTaskId, long? triggeringChildTaskId = null, CancellationToken ct = default);

    /// <summary>
    /// Cập nhật tự động trạng thái của Giai đoạn (Phase) dựa trên tiến độ của các công việc bên trong.
    /// </summary>
    Task UpdatePhaseStatusAsync(long phaseId, CancellationToken ct = default);
}
