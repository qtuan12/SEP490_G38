import React from 'react';
import { Boxes, CheckCircle, XCircle, FileCheck2 } from 'lucide-react';
import type {MaterialRequest} from '../../../types/common';

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
        return <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Chờ Kế toán soát</span>;
      case 'pending_director':
        return <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>Chờ Giám đốc duyệt</span>;
      case 'pending_disbursement':
        return <span className="badge badge-warning" style={{ fontSize: '0.72rem', backgroundColor: 'hsl(38 92% 95%)', color: 'hsl(38 90% 40%)' }}>Chờ Giải ngân (PO/Kho Auto)</span>;
      case 'disbursed':
        return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Đã giải ngân</span>;
      case 'approved':
        return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Đã duyệt (PO Auto)</span>;
      case 'rejected':
        return <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Đã từ chối</span>;
      default:
        return null;
    }
  };

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Boxes style={{ color: 'hsl(var(--primary))' }} size={20} />
          <span>Phê duyệt Vật tư bù đắp Sự cố (Over BOQ Approval)</span>
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
          Cấp vật tư đền bù cho các Rework Task · Tự động phát hiện vượt định mức (Over BOQ) · Soát xét Kế toán & Phê duyệt của Giám đốc (Bước 5)
        </p>
      </div>

      {loadingRequests ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--text-muted))' }}>Đang tải danh sách vật tư...</div>
      ) : materialRequests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
          Chưa có yêu cầu vật tư bù đắp sự cố nào.
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto w-full">
            <table>
            <thead>
              <tr>
                <th>Ngày yêu cầu</th>
                <th>Công việc / Giai đoạn</th>
                <th>Người yêu cầu</th>
                <th>Chi tiết Vật tư đền bù</th>
                <th>Tổng giá trị (VND)</th>
                <th>Phân loại</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
              </tr>
            </thead>
            <tbody>
              {materialRequests.map((req) => {
                const totalVal = req.items.reduce((sum, item) => sum + (item.quantity * ((item as any).price || 0)), 0);
                
                return (
                  <tr key={req.id}>
                    <td>{req.date}</td>
                    <td><strong style={{ fontSize: '0.85rem' }}>{req.taskName || req.phaseName || 'N/A'}</strong></td>
                    <td>{req.requesterName}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {req.items.map((it, idx) => (
                          <span key={idx}>- {it.name}: <strong>{it.quantity}</strong> {it.unit} {((it as any).price || 0) > 0 && `(đơn giá: ${((it as any).price || 0).toLocaleString('vi-VN')}đ)`}</span>
                        ))}
                      </div>
                      {req.reason && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>Lý do: {req.reason}</p>}
                      {req.type === 'emergency' && req.invoiceImage && (
                        <div style={{ marginTop: '4px' }}>
                          <a href={req.invoiceImage} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>Xem hóa đơn mua lẻ</a>
                        </div>
                      )}
                    </td>
                    <td><strong>{totalVal.toLocaleString('vi-VN')} đ</strong></td>
                    <td>
                      {req.type === 'emergency' ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', backgroundColor: 'hsl(38 92% 95%)', color: 'hsl(38 90% 40%)' }}>Khẩn cấp (Direct Purchase)</span>
                      ) : req.isOverBOQ ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Over BOQ (Vượt định mức)</span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'hsl(210 20% 90%)', color: 'hsl(var(--text-secondary))', fontSize: '0.65rem' }}>Trong định mức</span>
                      )}
                    </td>
                    <td>{getStatusBadgeMR(req.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {req.status === 'pending_accountant' && (
                        isAccountant ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => handleVerifyRequestByAccountant(req.id)}
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FileCheck2 size={13} />
                              <span>{req.isOverBOQ ? 'Trình Giám đốc' : 'Duyệt cấp PO'}</span>
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(req.id)}
                              className="btn" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Kế toán soát</span>
                        )
                      )}

                      {req.status === 'pending_disbursement' && (
                        isAccountant ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => handleDisburseRequestByAccountant(req.id)}
                              className="btn btn-primary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--success))', border: 'none' }}
                            >
                              Giải ngân
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(req.id)}
                              className="btn" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Giải ngân</span>
                        )
                      )}

                      {req.status === 'pending_director' && (
                        isDirector ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => handleApproveRequestByDirector(req.id)}
                              className="btn btn-primary" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--success))', border: 'none' }}
                            >
                              Duyệt
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(req.id)}
                              className="btn" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'hsl(var(--danger-glow))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Chờ Giám đốc duyệt</span>
                        )
                      )}

                      {(req.status === 'approved' || req.status === 'disbursed') && (
                        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--success))', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle size={13} />
                            <span>{req.status === 'approved' ? 'Đã duyệt PO' : 'Đã giải ngân'}</span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))' }}>{req.approvedBy || 'GĐ'}</span>
                        </div>
                      )}

                      {req.status === 'rejected' && (
                        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--danger))', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <XCircle size={13} />
                            <span>Đã từ chối</span>
                          </div>
                          {req.rejectionReason && (
                            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', maxWidth: '140px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.rejectionReason}>
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
