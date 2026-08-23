import { describe, expect, it } from 'vitest';
import type { MaterialRequest } from '../../types/common';
import {
  canResubmitProjectMaterialRequest,
  canProcessMaterialRequestByAccountant,
  getMaterialRequestBusinessStatus,
  getMaterialRequestBusinessStatusVariant,
  getMaterialRequestDetailTableState,
  getProcurementDecisionLabel,
  getProjectMaterialRequestBusinessStatus,
  getProjectMaterialRequestBusinessStatusVariant,
  matchesProjectMaterialRequestStatusFilter,
} from './materialRequestDecision';
import { materialRequestDecisionSchema } from './materialRequestDecisionSchema';

const requestWith = (
  status: MaterialRequest['status'],
  procurementDecision?: MaterialRequest['procurementDecision'],
) => ({ status, procurementDecision });

describe('getMaterialRequestBusinessStatus', () => {
  it.each([
    ['InternalTransfer', 'Đề nghị điều chuyển nội bộ'],
    ['WaitSupply', 'Chờ cung ứng'],
    ['NeedMoreInfo', 'Từ chối'],
    ['NotApproved', 'Từ chối'],
    ['ExternalPurchase', 'Không chấp thuận mua ngoài'],
  ] as const)('diễn giải Rejected + %s thành trạng thái nghiệp vụ', (decision, expected) => {
    expect(getMaterialRequestBusinessStatus(requestWith('rejected', decision))).toBe(expected);
  });

  it('phân biệt mua ngoài đang chờ Giám đốc và đã được duyệt', () => {
    expect(getMaterialRequestBusinessStatus(requestWith('pending_director', 'ExternalPurchase')))
      .toBe('Chờ phê duyệt vượt định mức');
    expect(getMaterialRequestBusinessStatus(requestWith('approved', 'ExternalPurchase')))
      .toBe('Đã phê duyệt');
  });

  it('giữ nhãn tương thích cho phiếu cũ chưa có ProcurementDecision', () => {
    expect(getMaterialRequestBusinessStatus(requestWith('rejected'))).toBe('Không chấp thuận');
    expect(getMaterialRequestBusinessStatus(requestWith('pending_accountant'))).toBe('Chờ phê duyệt');
  });

  it.each([
    ['InternalTransfer', 'info'],
    ['WaitSupply', 'warning'],
    ['NeedMoreInfo', 'danger'],
    ['NotApproved', 'danger'],
  ] as const)('dùng màu trạng thái phù hợp cho %s', (decision, expectedVariant) => {
    expect(getMaterialRequestBusinessStatusVariant(requestWith('rejected', decision)))
      .toBe(expectedVariant);
  });

  it('giữ dữ liệu NeedMoreInfo cũ nhưng hiển thị chung là Từ chối', () => {
    expect(getProcurementDecisionLabel('NeedMoreInfo')).toBe('Từ chối');
    expect(getProcurementDecisionLabel('NotApproved')).toBe('Từ chối');
  });
});

describe('canProcessMaterialRequestByAccountant', () => {
  it.each([
    [['accountant'], true],
    [['ACCOUNTANT'], true],
    [['technicalmanager'], false],
    [['director'], false],
    [['siteengineer'], false],
    [['admin'], false],
    [[], false],
    [undefined, false],
  ] as const)('kiểm tra quyền FE cho roles=%s', (roles, expected) => {
    expect(canProcessMaterialRequestByAccountant(roles)).toBe(expected);
  });
});

describe('MaterialRequestDetailModal item table state', () => {
  it('hiện đối chiếu động và trạng thái khi phiếu đang chờ Kế toán', () => {
    expect(getMaterialRequestDetailTableState('pending_accountant')).toEqual({
      comparisonHeader: 'Tổng yêu cầu vật tư',
      showDynamicBoqComparison: true,
      showStatusColumn: true,
      columnCount: 6,
    });
  });

  it.each([
    'pending_leader',
    'approved_by_leader',
    'pending_tpkt',
    'pending_director',
    'approved',
    'rejected',
    'cancelled',
    'pending_disbursement',
    'disbursed',
    'received',
  ] as const)('chỉ hiện định mức khi phiếu ở trạng thái %s', status => {
    expect(getMaterialRequestDetailTableState(status)).toEqual({
      comparisonHeader: 'Định mức',
      showDynamicBoqComparison: false,
      showStatusColumn: false,
      columnCount: 5,
    });
  });
});

describe('ProjectMaterialRequestsTab state UI', () => {
  it.each([
    ['NeedMoreInfo', 'Từ chối'],
    ['NotApproved', 'Từ chối'],
    ['ExternalPurchase', 'Từ chối'],
    [undefined, 'Từ chối'],
    ['InternalTransfer', 'Đề nghị điều chuyển nội bộ'],
    ['WaitSupply', 'Tạm hoãn cung ứng'],
  ] as const)('hiển thị Rejected + %s thành %s', (decision, expected) => {
    expect(getProjectMaterialRequestBusinessStatus(requestWith('rejected', decision))).toBe(expected);
  });

  it.each([
    ['NeedMoreInfo', true],
    ['NotApproved', true],
    ['ExternalPurchase', true],
    [undefined, true],
    ['InternalTransfer', false],
    ['WaitSupply', false],
  ] as const)('xác định quyền hiển thị Gửi lại cho Rejected + %s', (decision, expected) => {
    expect(canResubmitProjectMaterialRequest(requestWith('rejected', decision))).toBe(expected);
  });

  it('không cho gửi lại phiếu chưa bị từ chối', () => {
    expect(canResubmitProjectMaterialRequest(requestWith('approved', 'ExternalPurchase'))).toBe(false);
  });

  it.each([
    ['rejected', requestWith('rejected', 'NeedMoreInfo'), true],
    ['rejected', requestWith('rejected', 'NotApproved'), true],
    ['rejected', requestWith('rejected', 'InternalTransfer'), false],
    ['rejected:InternalTransfer', requestWith('rejected', 'InternalTransfer'), true],
    ['rejected:InternalTransfer', requestWith('rejected', 'WaitSupply'), false],
    ['rejected:WaitSupply', requestWith('rejected', 'WaitSupply'), true],
    ['approved', requestWith('approved', 'ExternalPurchase'), true],
    ['', requestWith('cancelled'), true],
  ] as const)('lọc %s đúng theo trạng thái UI', (filter, request, expected) => {
    expect(matchesProjectMaterialRequestStatusFilter(request, filter)).toBe(expected);
  });

  it('dùng cùng màu từ chối cho NeedMoreInfo và NotApproved', () => {
    expect(getProjectMaterialRequestBusinessStatusVariant(requestWith('rejected', 'NeedMoreInfo'))).toBe('danger');
    expect(getProjectMaterialRequestBusinessStatusVariant(requestWith('rejected', 'NotApproved'))).toBe('danger');
  });
});

describe('materialRequestDecisionSchema', () => {
  it('chấp nhận phương án và cơ sở thẩm định hợp lệ', () => {
    expect(materialRequestDecisionSchema.safeParse({
      decision: 'InternalTransfer',
      note: 'Dự án khác có nguồn để xem xét điều chuyển.',
    }).success).toBe(true);
  });

  it.each([
    [{ note: 'Cơ sở hợp lệ' }],
    [{ decision: 'Unknown', note: 'Cơ sở hợp lệ' }],
    [{ decision: 'NeedMoreInfo', note: 'Cơ sở hợp lệ' }],
    [{ decision: 'ExternalPurchase', note: '1234' }],
    [{ decision: 'ExternalPurchase', note: '   ' }],
    [{ decision: 'ExternalPurchase', note: 'a'.repeat(1001) }],
  ])('chặn input không hợp lệ: %s', (input) => {
    expect(materialRequestDecisionSchema.safeParse(input).success).toBe(false);
  });
});
