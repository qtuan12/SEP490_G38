export const resolveNotificationUrl = (noti: any): string | null => {
  if (!noti) return null;
  const referenceType = noti.referenceType;
  const referenceId = noti.referenceId;
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
        if (tab === 'inventoryadjustments') return '/inventory-adjustments';
        if (tab === 'inventoryincidents') return '/materials-control';
      }

      // Mở thẳng chi tiết phiếu ngay trong phạm vi dự án, để đóng/quay lại thì thấy
      // danh sách của dự án đó chứ không phải danh sách tổng toàn hệ thống.
      if (referenceId) {
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

    if (referenceType.includes('/acceptance') && referenceId) {
      return `${referenceType}?historyId=${referenceId}`;
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
    return `/direct-purchases`;
  }

  if (referenceType === 'Incident') {
    return `/incidents`;
  }

  if (referenceType === 'PhaseAcceptance') {
    return `/phase-acceptances`;
  }

  if (referenceType === 'InventoryAdjustment') {
    return `/inventory-adjustments`;
  }

  if (referenceType === 'SurplusRequest') {
    // Old notifications didn't have projectId. We can't navigate to project surplus.
    return `/projects`;
  }

  return null;
};
