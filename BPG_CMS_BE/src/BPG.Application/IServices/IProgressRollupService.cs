using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.IServices;

public interface IProgressRollupService
{
    /// <summary>
    /// Tính toán lại % tiến độ của task cha dựa trên các task con, theo trọng số số ngày (duration).
    /// </summary>
    Task RecalculateParentTaskProgressAsync(long parentTaskId, CancellationToken ct = default);
}
