import React from 'react';
import { Boxes, CheckCircle, XCircle, FileCheck2 } from 'lucide-react';
import type { MaterialRequest } from '../../../types/common';
import { Badge, Button } from '../../../components/ui';
import { formatDate } from '../../../utils/dateHelpers';

interface MaterialCompensationTableProps {
  materialRequests: MaterialRequest[];
  loadingRequests: boolean;
  isAccountant: boolean;
  isDirector: boolean;
  handleVerifyRequestByAccountant: (id: string) => void;
  handleDisburseRequestByAccountant: (id: string) => void;
  handleApproveRequestByDirector: (id: string) => void;
  handleRejectRequest: (id: string) => void;
}

export const MaterialCompensationTable: React.FC<MaterialCompensationTableProps> = ({
  materialRequests,
  loadingRequests,
  isAccountant,
  isDirector,
  handleVerifyRequestByAccountant,
  handleDisburseRequestByAccountant,
  handleApproveRequestByDirector,
  handleRejectRequest
}) => {
  const getStatusBadgeMR = (status: MaterialRequest['status']) => {
    switch (status) {
      case 'pending_accountant':
        return <Badge variant="warning" className="text-[0.72rem] py-0.5 px-2 normal-case">Chờ Kế toán soát</Badge>;
      case 'pending_director':
        return <Badge variant="default" className="text-[0.72rem] py-0.5 px-2 normal-case">Chờ Giám đốc duyệt</Badge>;
      case 'pending_disbursement':
        return <Badge variant="warning" className="text-[0.72rem] py-0.5 px-2 bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)] normal-case">Chờ Giải ngân</Badge>;
      case 'disbursed':
        return <Badge variant="success" className="text-[0.72rem] py-0.5 px-2 normal-case">Đã giải ngân</Badge>;
      case 'approved':
        return <Badge variant="success" className="text-[0.72rem] py-0.5 px-2 normal-case">Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="danger" className="text-[0.72rem] py-0.5 px-2 normal-case">Đã từ chối</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="card p-4 flex flex-col gap-3 bg-[hsl(var(--bg-card))]">
      <div className="border-b border-[hsl(var(--border))] pb-3">
        <h3 className="text-[1.05rem] font-bold m-0 flex items-center gap-2 text-[hsl(var(--text-primary))]">
          <Boxes className="text-[hsl(var(--primary))]" size={18} />
          <span>Phê duyệt Vật tư bù đắp Sự cố (Over BOQ Approval)</span>
        </h3>
        <p className="text-[0.75rem] text-[hsl(var(--text-muted))] mt-1">
          Cấp vật tư đền bù cho các Rework Task · Tự động phát hiện vượt định mức (Over BOQ) · Soát xét Kế toán & Phê duyệt của Giám đốc (Bước 5)
        </p>
      </div>

      {loadingRequests ? (
        <div className="text-center py-5 text-[hsl(var(--text-muted))] text-xs">Đang tải danh sách vật tư...</div>
      ) : materialRequests.length === 0 ? (
        <div className="text-center py-8 text-[hsl(var(--text-muted))] text-[0.8rem] border border-dashed border-[hsl(var(--border))] rounded">
          Chưa có yêu cầu vật tư bù đắp sự cố nào.
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[450px] w-full border border-[hsl(var(--border))] rounded custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse relative">
            <thead className="bg-[hsl(var(--bg-main))] border-b border-[hsl(var(--border))] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap">Ngày yêu cầu</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap min-w-[140px]">Công việc / Giai đoạn</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap min-w-[120px]">Người yêu cầu</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider min-w-[280px]">Chi tiết Vật tư đền bù</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap text-right">Tổng giá trị</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap min-w-[100px]">Phân loại</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap min-w-[110px]">Trạng thái</th>
                <th className="px-3 py-2.5 font-bold text-[hsl(var(--text-secondary))] text-[10px] uppercase tracking-wider whitespace-nowrap text-center min-w-[150px]">Thao tác duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))] bg-white">
              {materialRequests.map((req) => {
                const totalVal = req.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);

                return (
                  <tr key={req.id} className="hover:bg-[hsl(var(--bg-main)/0.2)] transition-colors">
                          <td className="px-3 py-3 text-[hsl(var(--text-muted))] align-top whitespace-nowrap">{formatDate(req.date)}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-semibold text-[hsl(var(--text-primary))]">{req.taskName || req.phaseName || 'N/A'}</div>
                          </td>
                          <td className="px-3 py-3 align-top text-[hsl(var(--text-secondary))]">{req.requesterName}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1 max-w-[320px]">
                              {req.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center gap-2 bg-[hsl(var(--bg-main)/0.4)] px-2 py-1 rounded border border-[hsl(var(--border))]/50 text-[11px] leading-tight">
                                  <span className="font-medium text-[hsl(var(--text-primary))] truncate" title={it.name}>{it.name}</span>
                                  <span className="text-[hsl(var(--text-muted))] shrink-0 font-mono text-[10px]">
                                    <strong className="text-[hsl(var(--text-primary))]">{it.quantity}</strong> {it.unit}
                                  </span>
                                </div>
                              ))}
                              {req.reason && <p className="text-[10px] text-[hsl(var(--text-muted))] mt-1 mb-0 italic leading-snug">Lý do: {req.reason}</p>}
                              {req.type === 'emergency' && req.invoiceImage && (
                                <div className="mt-1">
                                  <a href={req.invoiceImage} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[hsl(var(--primary))] font-semibold hover:underline">Xem hóa đơn mua lẻ</a>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top font-bold text-right text-[hsl(var(--text-primary))] whitespace-nowrap">{totalVal > 0 ? `${totalVal.toLocaleString('vi-VN')} đ` : '—'}</td>
                          <td className="px-3 py-3 align-top">
                            {req.type === 'emergency' ? (
                              <Badge variant="warning" className="text-[9px] bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)] py-0.5 px-1.5 normal-case font-semibold">Khẩn cấp (Direct Purchase)</Badge>
                            ) : req.isOverBOQ ? (
                              <Badge variant="danger" className="text-[9px] py-0.5 px-1.5 normal-case font-semibold">Over BOQ (Vượt định mức)</Badge>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold bg-[hsl(210_20%_90%)] text-[hsl(var(--text-secondary))] text-[9px]">Trong định mức</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top whitespace-nowrap">{getStatusBadgeMR(req.status)}</td>
                          <td className="px-3 py-3 align-top text-center">
                            {req.status === 'pending_accountant' && (
                              isAccountant ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleVerifyRequestByAccountant(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto flex items-center gap-1 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                                  >
                                    <FileCheck2 size={11} />
                                    <span>{req.isOverBOQ ? 'Trình GĐ' : 'Duyệt cấp PO'}</span>
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                                  >
                                    Từ chối
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[hsl(var(--text-muted))] italic">Chờ Kế toán soát</span>
                              )
                            )}

                            {req.status === 'pending_disbursement' && (
                              isAccountant ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <Button
                                    variant="primary"
                                    onClick={() => handleDisburseRequestByAccountant(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto bg-[hsl(var(--success))] hover:bg-[hsl(142_70%_35%)] border-none"
                                  >
                                    Giải ngân
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                                  >
                                    Từ chối
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[hsl(var(--text-muted))] italic">Chờ Giải ngân</span>
                              )
                            )}

                            {req.status === 'pending_director' && (
                              isDirector ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <Button
                                    variant="primary"
                                    onClick={() => handleApproveRequestByDirector(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto bg-[hsl(var(--success))] hover:bg-[hsl(142_70%_35%)] border-none"
                                  >
                                    Duyệt
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="py-0.5 px-1.5 text-[10px] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                                  >
                                    Từ chối
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[hsl(var(--text-muted))] italic">Chờ GĐ duyệt</span>
                              )
                            )}

                            {(req.status === 'approved' || req.status === 'disbursed') && (
                              <div className="text-[11px] text-[hsl(var(--success))] flex flex-col gap-0.5 items-center justify-center font-medium">
                                <div className="flex items-center gap-1">
                                  <CheckCircle size={12} />
                                  <span>{req.status === 'approved' ? 'Đã duyệt' : 'Đã giải ngân'}</span>
                                </div>
                                <span className="text-[10px] text-[hsl(var(--text-muted))] font-normal">{req.approvedBy || 'GĐ'}</span>
                              </div>
                            )}

                            {req.status === 'rejected' && (
                              <div className="text-[11px] text-[hsl(var(--danger))] flex flex-col gap-0.5 items-center font-medium">
                                <div className="flex items-center gap-1">
                                  <XCircle size={12} />
                                  <span>Từ chối</span>
                                </div>
                                {req.rejectionReason && (
                                  <span
                                    className="text-[9px] text-[hsl(var(--text-muted))] max-w-[120px] inline-block overflow-hidden text-ellipsis whitespace-nowrap font-normal"
                                    title={req.rejectionReason}
                                  >
                                    Lý do: {req.rejectionReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        );
              })}
                      </tbody>
                    </table>
                  </div>
                )
              }
    </div>
            );
};
