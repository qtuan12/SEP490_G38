import { hasAnyRole, RoleGroup } from '../../auth/roles';
import type {
  MaterialRequest,
  MaterialRequestProcurementDecision,
} from '../../types/common';

export const MATERIAL_REQUEST_DECISION_OPTIONS: ReadonlyArray<{
  value: MaterialRequestProcurementDecision;
  label: string;
  description: string;
}> = [
  {
    value: 'ExternalPurchase',
    label: 'Phê duyệt',
    description: '',
  },
  {
    value: 'InternalTransfer',
    label: 'Đề nghị điều chuyển nội bộ',
    description: '',
  },
  {
    value: 'WaitSupply',
    label: 'Chờ cung ứng',
    description: '',
  },
  {
    value: 'NotApproved',
    label: 'Từ chối',
    description: '',
  },
];

export const getProcurementDecisionLabel = (
  decision: MaterialRequestProcurementDecision | undefined,
): string | undefined => decision === 'NeedMoreInfo'
  ? 'Từ chối'
  : MATERIAL_REQUEST_DECISION_OPTIONS.find(option => option.value === decision)?.label;

export const getMaterialRequestBusinessStatus = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
): string => {
  if (request.status === 'rejected') {
    switch (request.procurementDecision) {
      case 'InternalTransfer': return 'Đề nghị điều chuyển nội bộ';
      case 'WaitSupply': return 'Chờ cung ứng';
      case 'NeedMoreInfo':
      case 'NotApproved': return 'Từ chối';
      case 'ExternalPurchase': return 'Từ chối';
      default: return 'Từ chối';
    }
  }

  if (request.status === 'pending_director' && request.procurementDecision === 'ExternalPurchase') {
    return 'Chờ phê duyệt vượt định mức';
  }

  if (request.status === 'approved' && request.procurementDecision === 'ExternalPurchase') {
    return 'Đã phê duyệt';
  }

  const labels: Record<MaterialRequest['status'], string> = {
    pending_leader: 'Chờ Trưởng dự án',
    approved_by_leader: 'Đã được Trưởng dự án duyệt',
    pending_tpkt: 'Chờ Trưởng phòng kỹ thuật',
    pending_accountant: 'Chờ phê duyệt',
    pending_director: 'Chờ phê duyệt vượt định mức',
    approved: 'Đã phê duyệt',
    rejected: 'Từ chối',
    cancelled: 'Đã hủy',
    pending_disbursement: 'Chờ tạm ứng',
    disbursed: 'Đã tạm ứng',
    received: 'Đã nhận vật tư',
  };

  return labels[request.status];
};

export const getMaterialRequestBusinessStatusVariant = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
): 'default' | 'info' | 'warning' | 'success' | 'danger' => {
  if (request.status === 'rejected') {
    switch (request.procurementDecision) {
      case 'InternalTransfer': return 'info';
      case 'WaitSupply': return 'warning';
      case 'NeedMoreInfo': return 'danger';
      default: return 'danger';
    }
  }

  if (request.status === 'approved' || request.status === 'disbursed' || request.status === 'received') {
    return 'success';
  }

  if (request.status.startsWith('pending')) return 'warning';
  return 'default';
};

export const getMaterialRequestDetailTableState = (
  status: MaterialRequest['status'],
) => {
  const showDynamicBoqComparison = status === 'pending_accountant';

  return {
    comparisonHeader: showDynamicBoqComparison ? 'Tổng yêu cầu vật tư' : 'Định mức',
    showDynamicBoqComparison,
    showStatusColumn: showDynamicBoqComparison,
    columnCount: showDynamicBoqComparison ? 6 : 5,
  } as const;
};

export type ProjectMaterialRequestStatusFilter =
  | ''
  | 'pending_accountant'
  | 'pending_director'
  | 'approved'
  | 'rejected'
  | 'rejected:InternalTransfer'
  | 'rejected:WaitSupply'
  | 'cancelled';

const isAlternativeSupplyOutcome = (
  decision: MaterialRequestProcurementDecision | undefined,
): boolean => decision === 'InternalTransfer' || decision === 'WaitSupply';

export const canResubmitProjectMaterialRequest = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
): boolean => request.status === 'rejected'
  && !isAlternativeSupplyOutcome(request.procurementDecision);

export const getProjectMaterialRequestBusinessStatus = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
): string => canResubmitProjectMaterialRequest(request)
  ? 'Từ chối'
  : getMaterialRequestBusinessStatus(request);

export const getProjectMaterialRequestBusinessStatusVariant = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
): 'default' | 'info' | 'warning' | 'success' | 'danger' => (
  canResubmitProjectMaterialRequest(request)
    ? 'danger'
    : getMaterialRequestBusinessStatusVariant(request)
);

export const matchesProjectMaterialRequestStatusFilter = (
  request: Pick<MaterialRequest, 'status' | 'procurementDecision'>,
  filter: ProjectMaterialRequestStatusFilter,
): boolean => {
  if (filter === '') return true;
  if (filter === 'rejected') return canResubmitProjectMaterialRequest(request);
  if (filter === 'rejected:InternalTransfer') {
    return request.status === 'rejected' && request.procurementDecision === 'InternalTransfer';
  }
  if (filter === 'rejected:WaitSupply') {
    return request.status === 'rejected' && request.procurementDecision === 'WaitSupply';
  }
  return request.status === filter;
};

export const canProcessMaterialRequestByAccountant = (
  roles: readonly string[] | undefined,
): boolean => hasAnyRole(roles, RoleGroup.Accounting);
