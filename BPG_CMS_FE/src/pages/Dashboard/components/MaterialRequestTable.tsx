import React from 'react';
import { Boxes, CheckCircle, XCircle, FileCheck2 } from 'lucide-react';
import type { MaterialRequest } from '../../../types/common';
import { Badge, Button } from '../../../components/ui';

interface MaterialRequestTableProps {
  materialRequests: MaterialRequest[];
  loadingRequests: boolean;
  isAccountant: boolean;
  isDirector: boolean;
  handleVerifyRequestByAccountant: (id: string) => void;
  handleDisburseRequestByAccountant: (id: string) => void;
  handleApproveRequestByDirector: (id: string) => void;
  handleRejectRequest: (id: string) => void;
}

export const MaterialRequestTable: React.FC<MaterialRequestTableProps> = ({
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
    <div className="card p-6 flex flex-col gap-4 bg-[hsl(var(--bg-card))]">
      <div>
        <h3 className="text-[1.15rem] font-semibold m-0 flex items-center gap-2">
          <Boxes className="text-[hsl(var(--primary))]" size={20} />
          <span>Phê duyệt Yêu cầu Vật tư (Material Request Approval)</span>
        </h3>
        <p className="text-[0.8rem] text-[hsl(var(--text-muted))] mt-1.5">
          Soát xét đề xuất vật tư của Kế toán & Phê duyệt vượt định mức (Over BOQ) của Giám đốc
        </p>
      </div>

      {loadingRequests ? (
        <div className="text-center py-5 text-[hsl(var(--text-muted))]">Đang tải danh sách vật tư...</div>
      ) : materialRequests.length === 0 ? (
        <div className="text-center py-8 text-[hsl(var(--text-muted))] text-[0.85rem] border border-dashed border-[hsl(var(--border))] rounded-md">
          Chưa có yêu cầu vật tư nào.
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto w-full">
            <table>
              <thead>
                <tr>
                  <th>Ngày yêu cầu</th>
                  <th>Giai đoạn / Công việc</th>
                  <th>Người yêu cầu</th>
                  <th>Chi tiết Vật tư</th>
                  <th>Phân loại</th>
                  <th>Trạng thái</th>
                  <th className="text-center">Thao tác duyệt</th>
                </tr>
              </thead>
              <tbody>
                {materialRequests.map((req) => {
                  return (
                    <tr key={req.id} className="hover:bg-[hsl(var(--bg-main)/0.5)] transition-colors">
                      <td className="whitespace-nowrap text-sm">{req.date}</td>
                      <td><strong className="text-[0.85rem] font-semibold">{req.taskName || req.phaseName || 'N/A'}</strong></td>
                      <td className="text-sm">{req.requesterName}</td>
                      <td>
                        <div className="text-[0.8rem] flex flex-col gap-0.5">
                          {req.items.map((it, idx) => (
                            <span key={idx}>- {it.name}: <strong>{it.quantity}</strong> {it.unit}</span>
                          ))}
                        </div>
                        {req.reason && <p className="text-[0.75rem] text-[hsl(var(--text-muted))] mt-1 mb-0 italic">Lý do: {req.reason}</p>}
                        {req.type === 'emergency' && req.invoiceImage && (
                          <div className="mt-1">
                            <a href={req.invoiceImage} target="_blank" rel="noopener noreferrer" className="text-[0.72rem] text-[hsl(var(--primary))] font-semibold hover:underline">Xem hóa đơn mua lẻ</a>
                          </div>
                        )}
                      </td>
                      <td>
                        {req.type === 'emergency' ? (
                          <Badge variant="warning" className="text-[0.65rem] bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)] py-0.5 px-2 normal-case">Khẩn cấp (Direct Purchase)</Badge>
                        ) : req.isOverBOQ ? (
                          <Badge variant="danger" className="text-[0.65rem] py-0.5 px-2 normal-case">Over BOQ (Vượt định mức)</Badge>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-[hsl(210_20%_90%)] text-[hsl(var(--text-secondary))] text-[0.65rem]">Trong định mức</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{getStatusBadgeMR(req.status)}</td>
                      <td className="text-center align-middle">
                        {req.status === 'pending_accountant' && (
                          isAccountant ? (
                            <div className="flex gap-1.5 justify-center flex-wrap">
                              <Button 
                                variant="secondary"
                                onClick={() => handleVerifyRequestByAccountant(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto flex items-center gap-1 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                              >
                                <FileCheck2 size={13} />
                                <span>{req.isOverBOQ ? 'Trình Giám đốc' : 'Duyệt cấp PO'}</span>
                              </Button>
                              <Button 
                                variant="secondary"
                                onClick={() => handleRejectRequest(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[0.78rem] text-[hsl(var(--text-muted))] italic">Chờ Kế toán soát</span>
                          )
                        )}

                        {req.status === 'pending_disbursement' && (
                          isAccountant ? (
                            <div className="flex gap-1.5 justify-center flex-wrap">
                              <Button 
                                variant="primary"
                                onClick={() => handleDisburseRequestByAccountant(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto bg-[hsl(var(--success))] hover:bg-[hsl(142_70%_35%)] border-none"
                              >
                                Giải ngân
                              </Button>
                              <Button 
                                variant="secondary"
                                onClick={() => handleRejectRequest(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[0.78rem] text-[hsl(var(--text-muted))] italic">Chờ Giải ngân</span>
                          )
                        )}

                        {req.status === 'pending_director' && (
                          isDirector ? (
                            <div className="flex gap-1.5 justify-center flex-wrap">
                              <Button 
                                variant="primary"
                                onClick={() => handleApproveRequestByDirector(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto bg-[hsl(var(--success))] hover:bg-[hsl(142_70%_35%)] border-none"
                              >
                                Duyệt
                              </Button>
                              <Button 
                                variant="secondary"
                                onClick={() => handleRejectRequest(req.id)}
                                className="py-1 px-2 text-[0.75rem] h-auto bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)] hover:bg-[hsl(var(--danger)/0.15)]"
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[0.78rem] text-[hsl(var(--text-muted))] italic">Chờ Giám đốc duyệt</span>
                          )
                        )}

                        {(req.status === 'approved' || req.status === 'disbursed') && (
                          <div className="text-[0.78rem] text-[hsl(var(--success))] flex flex-col gap-0.5 items-center justify-center font-medium">
                            <div className="flex items-center gap-1">
                              <CheckCircle size={13} />
                              <span>{req.status === 'approved' ? 'Đã duyệt' : 'Đã giải ngân'}</span>
                            </div>
                            <span className="text-[0.68rem] text-[hsl(var(--text-muted))] font-normal">{req.approvedBy || 'GĐ'}</span>
                          </div>
                        )}

                        {req.status === 'rejected' && (
                          <div className="text-[0.78rem] text-[hsl(var(--danger))] flex flex-col gap-0.5 items-center font-medium">
                            <div className="flex items-center gap-1">
                              <XCircle size={13} />
                              <span>Đã từ chối</span>
                            </div>
                            {req.rejectionReason && (
                              <span 
                                className="text-[0.68rem] text-[hsl(var(--text-muted))] max-w-[140px] inline-block overflow-hidden text-ellipsis whitespace-nowrap font-normal" 
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
        </div>
      )}
    </div>
  );
};
