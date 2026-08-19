export const resolveNotificationUrl = (noti: any): string | null => {
  if (!noti) return null;
  const referenceType = noti.referenceType;
  
  // Trích xuất ID: ưu tiên referenceId, fallback trích xuất từ nội dung/tiêu đề dạng #123
  let referenceId = noti.referenceId;
  if (!referenceId) {
    const extracted = noti.content?.match(/#(\d+)/)?.[1] || noti.title?.match(/#(\d+)/)?.[1];
    if (extracted) {
      referenceId = Number(extracted);
    }
  }

  const titleOrContent = ((noti.title || '') + ' ' + (noti.content || '')).toLowerCase();

  if (!referenceType) return null;

  // 1. Path starting with '/' (custom path sent from BE)
  if (referenceType.startsWith('/')) {
    const projectWorkspaceRegex = /^\/projects\/(\d+)\/workspace\/([a-zA-Z0-9_-]+)/i;
    const match = referenceType.match(projectWorkspaceRegex);
    if (match) {
      const projectId = match[1];
      let tab = match[2].toLowerCase();

      if (tab === 'incidents' && (titleOrContent.includes('vật tư') || titleOrContent.includes('tồn kho') || titleOrContent.includes('thất thoát') || titleOrContent.includes('hàng hóa'))) {
        tab = 'inventoryincidents';
      }

      if (projectId === '0') {
        if (tab === 'inventoryadjustments') {
          return referenceId ? `/inventory-adjustments?adjustmentId=${referenceId}` : '/inventory-adjustments';
        }
        if (tab === 'inventoryincidents' || tab === 'incidents') {
          return '/projects';
        }
      }

      // Mở thẳng chi tiết phiếu ngay trong phạm vi dự án
      if (referenceId) {
        if (tab === 'inventoryadjustments') {
          return `/projects/${projectId}?tab=inventoryadjustments&adjustmentId=${referenceId}`;
        }
        if (tab === 'incidents') {
          return `/projects/${projectId}?tab=incidents&incidentId=${referenceId}`;
        }
        if (tab === 'inventoryincidents') {
          return `/projects/${projectId}?tab=inventoryincidents&incidentId=${referenceId}`;
        }
        if (tab === 'materialrequests') {
          return `/projects/${projectId}?tab=materialrequests&requestId=${referenceId}`;
        }
        if (tab === 'directpurchases') {
          return `/projects/${projectId}?tab=directpurchases&directPurchaseId=${referenceId}`;
        }
        if (tab === 'purchaseorders') {
          return `/purchase-orders/${referenceId}?fromProject=${projectId}`;
        }
        if (tab === 'surplus') {
          return `/projects/${projectId}?tab=surplus&surplusRequestId=${referenceId}`;
        }
      }

      return `/projects/${projectId}?tab=${tab}`;
    }

    if (referenceType.includes('/acceptance')) {
      return referenceId ? `${referenceType}?historyId=${referenceId}&acceptanceId=${referenceId}` : referenceType;
    }

    return referenceType;
  }

  // 2. Fallbacks for entity constant names
  if (referenceType === 'Project' && referenceId) {
    return `/projects/${referenceId}`;
  }

  if (referenceType === 'DailyLog' || referenceType === 'Comment') {
    return `/projects/0/logs?logId=${referenceId}`;
  }

  if (referenceType === 'Task' && referenceId) {
    if (titleOrContent.includes('bình luận') || titleOrContent.includes('nhật ký')) {
      return `/projects/0/tasks/${referenceId}/logs`;
    }
    return `/tasks/${referenceId}`;
  }

  if (referenceType === 'GoodsReceipt' && referenceId) {
    return `/projects/0?tab=inventory&subTab=receipts&receiptId=${referenceId}`;
  }

  if (referenceType === 'MaterialIssuance' && referenceId) {
    return `/projects/0?tab=inventory&subTab=issuances&issuanceId=${referenceId}`;
  }

  if (referenceType === 'MaterialReturn' && referenceId) {
    return `/projects/0?tab=inventory&subTab=returns&returnId=${referenceId}`;
  }

  if (referenceType === 'PurchaseOrder' && referenceId) {
    return `/purchase-orders/${referenceId}`;
  }

  if (referenceType === 'DirectPurchaseRequest') {
    return referenceId ? `/direct-purchases?directPurchaseId=${referenceId}` : `/direct-purchases`;
  }

  if (referenceType === 'Incident' || referenceType === 'IncidentReported' || referenceType === 'InventoryIncidentReported' || referenceType === 'EmergencyStop') {
    return `/projects`;
  }

  if (referenceType === 'PhaseAcceptance') {
    return referenceId ? `/phase-acceptances?acceptanceId=${referenceId}` : `/phase-acceptances`;
  }

  if (referenceType === 'InventoryAdjustment') {
    return referenceId ? `/inventory-adjustments?adjustmentId=${referenceId}` : `/inventory-adjustments`;
  }

  if (referenceType === 'MaterialRequest') {
    return referenceId ? `/projects/0?tab=materialrequests&requestId=${referenceId}` : `/projects`;
  }

  if (referenceType === 'SurplusRequest') {
    return `/projects`;
  }

  return null;
};
