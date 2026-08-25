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
        return '/projects';
      }

      // Mở thẳng chi tiết phiếu ngay trong phạm vi dự án
      if (referenceId) {
        if (tab === 'inventoryadjustments') {
          return `/projects/${projectId}?tab=inventoryadjustments&adjustmentId=${referenceId}`;
        }
        if (tab === 'incidents' || tab === 'inventoryincidents') {
          return `/projects/${projectId}?tab=incidents&incidentId=${referenceId}`;
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
        if (tab === 'surplus-incoming') {
          return `/projects/${projectId}?tab=surplus&incoming=true`;
        }
      }
      if (tab === 'surplus-incoming') {
        return `/projects/${projectId}?tab=surplus&incoming=true`;
      }
      return `/projects/${projectId}?tab=${tab}`;
    }

    if (referenceType.includes('/acceptance')) {
      return referenceId ? `${referenceType}?historyId=${referenceId}&acceptanceId=${referenceId}` : referenceType;
    }

    // Không chuyển hướng tới route /projects/0/... nếu BE gửi nhầm projectId = 0
    if (referenceType.startsWith('/projects/0/')) {
      return referenceId ? `/tasks/${referenceId}` : '/projects';
    }

    return referenceType;
  }

  // 2. Fallbacks for entity constant names
  if (referenceType === 'Project' && referenceId && referenceId !== 0) {
    return `/projects/${referenceId}`;
  }

  if (referenceType === 'Task' && referenceId) {
    return `/tasks/${referenceId}`;
  }

  if (referenceType === 'DailyLog' || referenceType === 'Comment') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0) {
      return `/projects/${projId}/logs?logId=${referenceId}`;
    }
    return referenceId ? `/tasks/${referenceId}` : '/field?standalone=true';
  }

  if (referenceType === 'GoodsReceipt') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0 && referenceId) {
      return `/projects/${projId}?tab=inventory&subTab=receipts&receiptId=${referenceId}`;
    }
    return `/purchase-orders`;
  }

  if (referenceType === 'MaterialIssuance') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0 && referenceId) {
      return `/projects/${projId}?tab=inventory&subTab=issuances&issuanceId=${referenceId}`;
    }
    return `/materials`;
  }

  if (referenceType === 'MaterialReturn') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0 && referenceId) {
      return `/projects/${projId}?tab=inventory&subTab=returns&returnId=${referenceId}`;
    }
    return `/materials`;
  }

  if (referenceType === 'PurchaseOrder') {
    return referenceId ? `/purchase-orders/${referenceId}` : `/purchase-orders`;
  }

  if (referenceType === 'DirectPurchaseRequest') {
    return referenceId ? `/direct-purchases?directPurchaseId=${referenceId}` : `/direct-purchases`;
  }

  if (referenceType === 'Incident' || referenceType === 'IncidentReported' || referenceType === 'InventoryIncidentReported' || referenceType === 'EmergencyStop') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0 && referenceId) {
      return `/projects/${projId}?tab=incidents&incidentId=${referenceId}`;
    }
    return `/projects`;
  }

  if (referenceType === 'PhaseAcceptance') {
    return referenceId ? `/phase-acceptances?acceptanceId=${referenceId}` : `/phase-acceptances`;
  }

  if (referenceType === 'InventoryAdjustment') {
    return referenceId ? `/inventory-adjustments?adjustmentId=${referenceId}` : `/inventory-adjustments`;
  }

  if (referenceType === 'MaterialRequest') {
    const projId = noti.projectId || noti.project?.id || noti.project?.projectId;
    if (projId && projId !== '0' && projId !== 0 && referenceId) {
      return `/projects/${projId}?tab=materialrequests&requestId=${referenceId}`;
    }
    return `/materials-control`;
  }

  if (referenceType === 'SurplusRequest') {
    return `/projects`;
  }

  return null;
};
