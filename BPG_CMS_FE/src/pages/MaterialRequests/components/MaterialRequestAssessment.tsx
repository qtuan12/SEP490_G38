import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { MaterialRequestAssessmentItem } from '../../../services/materialRequestAssessmentService';
import { formatPlainDate } from '../../../utils/dateHelpers';
import { formatNumber } from '../../../utils/formatNumber';
import './MaterialRequestAssessment.css';

interface MaterialRequestAssessmentItemProps {
  assessment?: MaterialRequestAssessmentItem;
  colSpan: number;
  canView: boolean;
  isLoading: boolean;
  isError: boolean;
}

export const MaterialRequestAssessmentItemRow: React.FC<MaterialRequestAssessmentItemProps> = ({
  assessment,
  colSpan,
  canView,
  isLoading,
  isError,
}) => {
  if (!canView) return null;

  return (
    <tr className="mr-assessment-inline-row">
      <td colSpan={colSpan}>
        <details className="mr-assessment-inline">
          <summary>
            <span>Xem cơ sở thẩm định</span>
            <ChevronDown size={14} />
          </summary>
          <div className="mr-assessment-inline__content">
            {isLoading ? (
              <p className="mr-assessment-inline__message">Đang tải cơ sở thẩm định...</p>
            ) : isError || !assessment ? (
              <p className="mr-assessment-inline__message mr-assessment-inline__message--error">
                Không thể tải cơ sở thẩm định của vật tư này.
              </p>
            ) : (
              <div className="mr-assessment-inline__reference">
                <div>
                  <span>Tồn tại dự án</span>
                  <strong>{formatNumber(assessment.projectInventoryQuantity)} {assessment.unitName}</strong>
                </div>

                <div>
                  <span>Đang được cung ứng</span>
                  {assessment.activeSupplies.length > 0 ? (
                    <div className="mr-assessment-inline__compact-list">
                      {assessment.activeSupplies.map(supply => (
                        <div className="mr-assessment-inline__supply-value" key={supply.poId}>
                          <strong>{formatNumber(supply.remainingQuantity)} {assessment.unitName}</strong>
                          <b aria-hidden="true">-</b>
                          <a
                            href={`/purchase-orders/${supply.poId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Mở ${supply.poNumber} trong tab mới`}
                          >
                            {supply.poNumber}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <strong>Không có</strong>
                  )}
                </div>

                <div>
                  <span>Nguồn nội bộ khác</span>
                  {assessment.internalSources.length > 0 ? (
                    <div className="mr-assessment-inline__compact-list">
                      {assessment.internalSources.map(source => (
                        <div className="mr-assessment-inline__source-value" key={source.projectId}>
                          <strong>{source.projectName}</strong>
                          <small>{formatNumber(source.availableQuantity)} {assessment.unitName} khả dụng</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <strong>Không có</strong>
                  )}
                </div>

                <div>
                  <span>Giá mua gần nhất</span>
                  {assessment.lastPurchasePrice ? (
                    <>
                    <strong>
                      {formatNumber(assessment.lastPurchasePrice.unitPrice)} đ/{assessment.unitName}
                    </strong>
                    <small>{formatPlainDate(assessment.lastPurchasePrice.orderDate)}</small>
                    </>
                  ) : (
                    <strong>Không có</strong>
                  )}
                </div>
              </div>
            )}
          </div>
        </details>
      </td>
    </tr>
  );
};
