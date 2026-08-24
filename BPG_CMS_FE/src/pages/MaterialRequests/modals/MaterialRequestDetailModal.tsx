import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Info, Calendar, User, Layers, ExternalLink } from 'lucide-react';
import { projectService } from '../../../services/projectService';
import type { MaterialRequest, MaterialRequestProcurementDecision, WBSPhase } from '../../../types/common';
import { Modal } from '../../../components/ui/Modal';
import { Button, Badge, LoadingSpinner } from '../../../components/ui';
import { formatDate } from '../../../utils/dateHelpers';
import { materialRequestAssessmentService } from '../../../services/materialRequestAssessmentService';
import { MaterialRequestAssessmentItemRow } from '../components/MaterialRequestAssessment';
import { useAuth } from '../../../context/AuthContext';
import { canViewMaterialRequestAssessment } from '../materialRequestAssessmentPermissions';
import { formatNumber } from '../../../utils/formatNumber';
import { MaterialRequestDecisionForm } from '../components/MaterialRequestDecisionForm';
import {
  getMaterialRequestBusinessStatus,
  getMaterialRequestBusinessStatusVariant,
  getMaterialRequestDetailTableState,
  getProcurementDecisionLabel,
} from '../materialRequestDecision';

interface MaterialRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest | null;
  isAccountant: boolean;
  isDirector: boolean;
  canManageTechnical?: boolean;
  handleVerifyRequestByAccountant: (
    id: string,
    decision: MaterialRequestProcurementDecision,
    note: string,
  ) => Promise<boolean>;
  handleDisburseRequestByAccountant: (id: string) => void;
  handleApproveRequestByDirector: (id: string) => void;
  handleRejectRequest: (id: string) => void;
  handleCancelRequest?: (id: string) => void;
}

export const MaterialRequestDetailModal: React.FC<MaterialRequestDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  isAccountant,
  isDirector,
  canManageTechnical,
  handleVerifyRequestByAccountant,
  handleDisburseRequestByAccountant,
  handleApproveRequestByDirector,
  handleRejectRequest,
  handleCancelRequest
}) => {
  const { user } = useAuth();
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [allRequests, setAllRequests] = useState<MaterialRequest[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const canViewAssessment = canViewMaterialRequestAssessment(
    user?.roles?.length ? user.roles : user ? [user.role] : undefined,
  );
  const numericRequestId = Number(request?.id.replace('mat-req-', '') || 0);
  const assessmentQuery = useQuery({
    queryKey: ['material-request-assessment', numericRequestId],
    queryFn: () => materialRequestAssessmentService.getByRequestId(numericRequestId),
    enabled: isOpen && canViewAssessment && numericRequestId > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !request) return;
      setLoadingData(true);
      try {
        const [pList, rList] = await Promise.all([
          projectService.getPhases(request.projectId),
          projectService.getMaterialRequests(request.projectId)
        ]);
        setPhases(pList);
        setAllRequests(rList);
      } catch (err) {
        console.error('Error fetching details data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [isOpen, request]);

  const currentPhase = useMemo(() => {
    if (!request) return null;
    return phases.find(p => p.id === request.phaseId) || null;
  }, [phases, request]);

  // Tính toán đối chiếu định mức cho từng vật tư trong request
  const itemsComparison = useMemo(() => {
    if (!request) return [];
    return request.items.map(item => {
      // 1. Tìm định mức BOQ gốc của Phase cho vật tư này
      const boqItem = currentPhase?.materials?.find(m => m.name.toLowerCase() === item.name.toLowerCase());
      const boqLimit = boqItem ? boqItem.quantity : 0;
      const boqUnit = boqItem ? boqItem.unit : item.unit;
      const boqCR = boqItem?.conversionRate || 1;
      const itemCR = item.conversionRate || 1;

      // Quy đổi limit và requested sang Base Unit
      const boqLimitInBase = boqLimit / (boqCR === 0 ? 1 : boqCR);
      const requestedQtyInBase = item.quantity / (itemCR === 0 ? 1 : itemCR);

      // 2. Tính số lượng đã được yêu cầu bởi các phiếu khác đang hoạt động trong Phase (quy đổi sang Base Unit)
      let usedQtyInBase = 0;
      allRequests.forEach(r => {
        if (
          r.phaseId === request.phaseId &&
          r.id !== request.id &&
          r.status !== 'rejected' &&
          r.status !== 'cancelled'
        ) {
          const matchItem = r.items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
          if (matchItem) {
            const matchCR = matchItem.conversionRate || 1;
            usedQtyInBase += matchItem.quantity / (matchCR === 0 ? 1 : matchCR);
          }
        }
      });

      const totalRequestedInBase = usedQtyInBase + requestedQtyInBase;
      const isOver = totalRequestedInBase > boqLimitInBase;

      // Quy đổi phần vượt định mức về đơn vị BOQ
      const overAmountInBase = isOver ? (totalRequestedInBase - boqLimitInBase) : 0;
      const overAmount = parseFloat((overAmountInBase * boqCR).toFixed(3));

      // Quy đổi số lượng đã dùng về đơn vị BOQ
      const usedQtyInBOQ = parseFloat((usedQtyInBase * boqCR).toFixed(3));

      // Lũy kế yêu cầu của tất cả các phiếu trong phase (gồm cả phiếu hiện tại) quy đổi về đơn vị BOQ
      const cumulativeQtyInBOQ = parseFloat((totalRequestedInBase * boqCR).toFixed(3));
      return {
        requestItemId: item.requestItemId,
        materialId: item.materialId,
        name: item.name,
        requested: item.quantity,
        unit: item.unit, // Giữ nguyên đơn vị yêu cầu
        boqLimit: boqLimit,
        boqUnit: boqUnit,
        used: usedQtyInBOQ,
        cumulative: cumulativeQtyInBOQ,
        isOver: isOver,
        overAmount: overAmount,
        dbIsOver: item.isOverBOQ || false
      };
    });
  }, [request, currentPhase, allRequests]);

  if (!request) return null;

  const getStatusBadge = (status: MaterialRequest['status']) => {
    switch (status) {
      case 'pending_accountant':
        return <Badge variant="warning">{getMaterialRequestBusinessStatus(request)}</Badge>;
      case 'pending_director':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]">{getMaterialRequestBusinessStatus(request)}</Badge>;
      case 'pending_disbursement':
        return <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]">Chờ tạm ứng</Badge>;
      case 'disbursed':
        return <Badge variant="success">Đã tạm ứng</Badge>;
      case 'approved':
        return <Badge variant="success">{getMaterialRequestBusinessStatus(request)}</Badge>;
      case 'rejected':
        return <Badge variant={getMaterialRequestBusinessStatusVariant(request)}>{getMaterialRequestBusinessStatus(request)}</Badge>;
      case 'cancelled':
        return <Badge variant="default">Đã hủy</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${request.id.toUpperCase().replace('MAT-REQ-', 'YCVT-')} — Chi tiết Yêu cầu Vật tư`}
      width="xl"
      mobileFullScreen
    >
      {loadingData ? (
        <LoadingSpinner size="md" label="Đang tải thông tin đối chiếu định mức..." className="py-12" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Thông tin chung của phiếu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Calendar size={16} className="text-slate-400" />
                <span>Ngày yêu cầu:</span>
                <strong className="text-slate-800 font-semibold">{formatDate(request.date)}</strong>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <User size={16} className="text-slate-400" />
                <span>Người yêu cầu:</span>
                <strong className="text-slate-800 font-semibold">{request.requesterName}</strong>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Layers size={16} className="text-slate-400" />
                <span>Giai đoạn:</span>
                <strong className="text-slate-800 font-semibold">{request.phaseName || 'N/A'}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Info size={16} className="text-slate-400" />
                <span>Phân loại yêu cầu:</span>
                {request.type === 'emergency' ? (
                  <Badge variant="warning" className="bg-[hsl(38_92%_95%)] text-[hsl(38_90%_40%)]">Khẩn cấp (Mua ngoài)</Badge>
                ) : request.isOverBOQ ? (
                  <Badge variant="danger">Vượt định mức</Badge>
                ) : (
                  <Badge variant="success" className="bg-blue-50 text-blue-600 border-blue-200">Trong định mức</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <CheckCircle size={16} className="text-slate-400" />
                <span>Trạng thái phiếu:</span>
                {getStatusBadge(request.status)}
              </div>
            </div>
          </div>

          {/* Bảng đối chiếu chi tiết vật tư */}
          {(() => {
            const tableState = getMaterialRequestDetailTableState(request.status);
            return (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-slate-700 m-0 flex items-center gap-1.5">
                  <span>Danh sách vật tư</span>
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full border-collapse text-left text-xs bg-white">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 w-[40px] text-center">STT</th>
                        <th className="p-3 w-[35%]">Tên vật tư kỹ thuật / Quy cách</th>
                        <th className="p-3 text-center">Số lượng</th>
                        <th className="p-3 text-center">Đơn vị</th>
                        <th className="p-3 text-center">{tableState.comparisonHeader}</th>
                        {tableState.showStatusColumn && (
                          <th className="p-3 text-center w-[160px]">Trạng thái</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {itemsComparison.map((item, idx) => (
                        <React.Fragment key={`${request.id}-${item.name}-${idx}`}>
                          <tr className="border-b border-slate-100 hover:bg-slate-50/50 align-middle">
                            <td className="p-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                            <td className="p-3 text-slate-800 font-semibold">{item.name}</td>
                            <td className="p-3 text-center text-slate-900 font-bold text-sm bg-slate-50/30">{item.requested}</td>
                            <td className="p-3 text-center text-slate-500">{item.unit}</td>
                            <td className="p-3 text-center text-slate-600 font-medium">
                              {tableState.showDynamicBoqComparison ? (
                                <>
                                  <span className={item.cumulative > 0 ? "text-slate-700 font-semibold" : "text-slate-400"}>
                                    {item.cumulative}
                                  </span>
                                  <span className="text-slate-300"> / </span>
                                  <span className={item.boqLimit > 0 ? "text-blue-600 font-semibold" : "text-slate-400 font-medium"}>
                                    {item.boqLimit > 0 ? `${item.boqLimit} ${item.boqUnit}` : 'Không có trong BOQ'}
                                  </span>
                                </>
                              ) : (
                                <span className={item.boqLimit > 0 ? "text-blue-600 font-semibold" : "text-slate-400 font-medium"}>
                                  {item.boqLimit > 0 ? `${item.boqLimit} ${item.boqUnit}` : 'Không có trong BOQ'}
                                </span>
                              )}
                            </td>
                            {tableState.showStatusColumn && (
                              <td className="p-3 text-center">
                                {item.isOver ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                                      Vượt định mức
                                    </span>
                                    <span className="text-[9px] text-red-500 font-bold">
                                      {/* Vượt {item.overAmount.toLocaleString('vi-VN')} {item.boqUnit} */}
                                      Vượt {formatNumber(item.overAmount)} {item.boqUnit}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">
                                    Trong định mức
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                          <MaterialRequestAssessmentItemRow
                            assessment={assessmentQuery.data?.items.find(assessmentItem =>
                              item.requestItemId
                                ? assessmentItem.requestItemId === item.requestItemId
                                : assessmentItem.materialId === item.materialId
                            )}
                            colSpan={tableState.columnCount}
                            canView={canViewAssessment}
                            isLoading={assessmentQuery.isLoading}
                            isError={assessmentQuery.isError}
                          />
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-slate-700 m-0">Lịch sử xử lý phiếu</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="font-bold text-slate-700">1. Tạo yêu cầu</div>
                <div className="mt-1 text-slate-600">{request.requesterName} · {formatDate(request.date)}</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="font-bold text-slate-700">2. Kế toán thẩm định</div>
                <div className="mt-1 text-slate-600">{request.checkedByName ? `Đã xử lý bởi ${request.checkedByName}` : 'Chưa xử lý'}</div>
                {request.procurementDecision && (
                  <div className="mt-1 text-slate-600">Phương án: {getProcurementDecisionLabel(request.procurementDecision)}</div>
                )}
                {request.accountantNote && <div className="mt-1 text-slate-500 italic">Ý kiến: {request.accountantNote}</div>}
              </div>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="font-bold text-slate-700">3. Giám đốc phê duyệt yêu cầu vượt dự toán</div>
                <div className="mt-1 text-slate-600">
                  {request.isOverBOQ
                    ? (request.approvedByName ? `Đã xử lý bởi ${request.approvedByName}` : 'Chưa xử lý')
                    : 'Không áp dụng - yêu cầu trong dự toán'}
                </div>
                {request.approvalNote && <div className="mt-1 text-slate-500 italic">Ghi chú: {request.approvalNote}</div>}
              </div>
            </div>
          </div>

          {request.reason && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-600">Ghi chú:</span>
              <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-lg text-slate-700 text-sm leading-relaxed italic">
                "{request.reason}"
              </div>
            </div>
          )}

          {request.type === 'emergency' && request.invoiceImage && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-600">Hình ảnh hóa đơn mua lẻ đính kèm:</span>
              <div className="flex items-center gap-3">
                <div className="relative border border-slate-200 rounded-md p-1 bg-white hover:shadow-md transition-shadow">
                  <img
                    src={request.invoiceImage}
                    alt="Hóa đơn mua lẻ"
                    className="w-32 h-20 object-cover rounded"
                  />
                  <a
                    href={request.invoiceImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white rounded-full p-1 shadow hover:bg-blue-700 transition-colors"
                    title="Mở ảnh lớn trong tab mới"
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
                <span className="text-xs text-slate-400 italic">Bấm vào biểu tượng ở góc để xem ảnh phóng to trong tab mới.</span>
              </div>
            </div>
          )}

          {request.status === 'rejected' && request.rejectionReason && (
            <div className="flex flex-col gap-1.5 border border-slate-200 rounded-lg p-3 bg-slate-50/70">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                <Info size={16} />
                <span>{getMaterialRequestBusinessStatus(request)}:</span>
              </div>
              <p className="text-sm text-slate-600 m-0 leading-relaxed italic">"{request.rejectionReason}"</p>
            </div>
          )}

          {request.status === 'cancelled' && request.rejectionReason && (
            <div className="flex flex-col gap-1.5 border border-slate-100 rounded-lg p-3 bg-slate-50/50">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                <AlertTriangle size={16} className="text-slate-500" />
                <span>Lý do hủy yêu cầu:</span>
              </div>
              <p className="text-sm text-slate-600 m-0 leading-relaxed italic">"{request.rejectionReason}"</p>
            </div>
          )}

          {request.status === 'pending_accountant' && isAccountant && (
            <MaterialRequestDecisionForm
              requestId={request.id}
              onSubmitDecision={handleVerifyRequestByAccountant}
              onCompleted={onClose}
            />
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Đóng chi tiết
            </Button>

            <div className="flex gap-2">
              {((request.status === 'pending_accountant' || request.status === 'pending_director') &&
                canManageTechnical &&
                handleCancelRequest) && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      onClose();
                      handleCancelRequest(request.id);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-3.5 text-xs font-semibold"
                  >
                    Hủy yêu cầu
                  </Button>
                )}

              {request.status === 'pending_disbursement' && isAccountant && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      onClose();
                      handleRejectRequest(request.id);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-3.5 text-xs font-semibold"
                  >
                    Từ chối
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onClose();
                      handleDisburseRequestByAccountant(request.id);
                    }}
                    className="bg-green-600 hover:bg-green-700 border-none py-1.5 px-3.5 text-xs font-semibold text-white"
                  >
                    Giải ngân
                  </Button>
                </>
              )}

              {request.status === 'pending_director' && isDirector && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      onClose();
                      handleRejectRequest(request.id);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-3.5 text-xs font-semibold"
                  >
                    Từ chối
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onClose();
                      handleApproveRequestByDirector(request.id);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 border-none py-1.5 px-3.5 text-xs font-semibold text-white"
                  >
                    <span>Phê duyệt vượt định mức</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
