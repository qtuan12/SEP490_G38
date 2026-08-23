import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MaterialRequestAssessmentItem } from '../../../services/materialRequestAssessmentService';
import { MaterialRequestAssessmentItemRow } from './MaterialRequestAssessment';

const assessment: MaterialRequestAssessmentItem = {
  requestItemId: 101,
  materialId: 50,
  unitId: 2,
  unitName: 'Bao (50kg)',
  projectInventoryQuantity: 3,
  activeSupplies: [
    { poId: 18, poNumber: 'PO-2026-018', remainingQuantity: 15 },
    { poId: 19, poNumber: 'PO-2026-019', remainingQuantity: 8 },
  ],
  internalSources: [
    { projectId: 20, projectName: 'Biệt thự An Khánh', availableQuantity: 15 },
    { projectId: 30, projectName: 'Nhà máy Long Hậu', availableQuantity: 8 },
  ],
  lastPurchasePrice: {
    poId: 17,
    poNumber: 'PO-2026-017',
    unitPrice: 198_000,
    orderDate: '2026-08-01',
  },
};

const renderRow = (canView: boolean, item = assessment) => renderToStaticMarkup(
  <table>
    <tbody>
      <MaterialRequestAssessmentItemRow
        assessment={item}
        colSpan={7}
        canView={canView}
        isLoading={false}
        isError={false}
      />
    </tbody>
  </table>,
);

describe('MaterialRequestAssessmentItemRow', () => {
  it('không render dữ liệu thẩm định khi FE không có quyền', () => {
    expect(renderRow(false)).toBe('<table><tbody></tbody></table>');
  });

  it('render số đang về tối giản và link PO mở tab mới', () => {
    const markup = renderRow(true);

    expect(markup).toContain('15 Bao (50kg)');
    expect(markup).toContain('href="/purchase-orders/18"');
    expect(markup).toContain('href="/purchase-orders/19"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).not.toContain('Đã gửi nhà cung cấp');
    expect(markup).not.toContain('Đã đặt');
    expect(markup).not.toContain('Dự kiến giao');
  });

  it('render đầy đủ nhiều dự án nguồn trong vùng danh sách gọn', () => {
    const markup = renderRow(true);

    expect(markup).toContain('Biệt thự An Khánh');
    expect(markup).toContain('15 Bao (50kg) khả dụng');
    expect(markup).toContain('Nhà máy Long Hậu');
    expect(markup).toContain('8 Bao (50kg) khả dụng');
  });

  it('giữ đủ bốn vùng cơ sở thẩm định và hiện Không có khi chưa có dữ liệu', () => {
    const markup = renderRow(true, {
      ...assessment,
      activeSupplies: [],
      internalSources: [],
      lastPurchasePrice: undefined,
    });

    expect(markup).toContain('Tồn tại dự án');
    expect(markup).toContain('Đang được cung ứng');
    expect(markup).toContain('Nguồn nội bộ khác');
    expect(markup).toContain('Giá mua gần nhất');
    expect(markup.match(/Không có/g)).toHaveLength(3);
  });
});
