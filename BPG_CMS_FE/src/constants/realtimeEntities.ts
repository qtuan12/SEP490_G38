export const REALTIME_DATA_CHANGED_EVENT = 'bpg:data-changed';
export const REALTIME_DATA_CHANGED_AGGREGATION_MS = 150;

export type RealtimeDataChangedPayload = {
  entities?: string[];
  changedAt?: string;
  refreshAll?: boolean;
};

/** Tên CLR của entity do backend gửi trong sự kiện SignalR DataChanged. */
export const RealtimeEntities = {
  users: ['User', 'UserRole', 'Role'],
  projects: ['Project', 'ProjectMember', 'Phase', 'ProjectTask', 'TaskAssignee', 'TaskDependency', 'TaskProgressLog'],
  dailyLogs: ['DailyLog', 'Comment', 'Attachment', 'ProjectTask', 'TaskProgressLog'],
  materials: ['MaterialCatalog', 'MaterialCategory', 'MaterialConversion', 'Unit', 'BOQItem'],
  materialRequests: ['MaterialRequest', 'MaterialRequestItem', 'BOQItem', 'ProjectTask'],
  procurement: ['PurchaseOrder', 'PurchaseOrderItem', 'DirectPurchaseRequest', 'DirectPurchaseItem', 'Supplier'],
  inventory: [
    'CurrentInventory',
    'InventoryTransaction',
    'GoodsReceipt',
    'GoodsReceiptItem',
    'MaterialIssuance',
    'MaterialIssuanceItem',
    'MaterialReturn',
    'MaterialReturnItem',
    'InventoryAdjustment',
    'AdjustmentItem',
  ],
  incidents: ['Incident', 'InventoryAdjustment', 'DirectPurchaseRequest'],
  phaseAcceptances: ['PhaseAcceptance', 'Phase', 'ProjectTask', 'TaskProgressLog'],
  surplus: ['SurplusRequest', 'SurplusRequestItem', 'SurplusTransfer', 'SurplusLiquidation', 'SurplusReturnSupplier'],
  systemConfig: ['SystemConfig'],
} as const;

export const RealtimeEntityGroups = {
  projectOverview: [
    ...RealtimeEntities.projects,
    ...RealtimeEntities.dailyLogs,
    ...RealtimeEntities.incidents,
    ...RealtimeEntities.materialRequests,
  ],
  projectMaterials: [
    ...RealtimeEntities.materials,
    ...RealtimeEntities.materialRequests,
    ...RealtimeEntities.procurement,
    ...RealtimeEntities.inventory,
    ...RealtimeEntities.surplus,
  ],
  reports: [
    ...RealtimeEntities.projects,
    ...RealtimeEntities.dailyLogs,
    ...RealtimeEntities.materials,
    ...RealtimeEntities.materialRequests,
    ...RealtimeEntities.procurement,
    ...RealtimeEntities.inventory,
    ...RealtimeEntities.incidents,
    ...RealtimeEntities.phaseAcceptances,
    ...RealtimeEntities.surplus,
  ],
} as const;

/** Ánh xạ tiền tố React Query sang entity để tránh tải lại dữ liệu không liên quan. */
export const RealtimeQueryEntities: Readonly<Record<string, readonly string[]>> = {
  'company-info': RealtimeEntities.systemConfig,
  'system-configs': RealtimeEntities.systemConfig,
  categories: ['MaterialCategory'],
  materials: RealtimeEntities.materials.filter(entity => entity !== 'BOQItem'),
  materialCatalogList: RealtimeEntities.materials.filter(entity => entity !== 'BOQItem'),
  units: ['Unit'],
  conversions: ['MaterialConversion', 'Unit'],
  suppliers: ['Supplier'],
  'suppliers-active': ['Supplier'],

  project: ['Project'],
  phases: RealtimeEntities.projects,
  projects: RealtimeEntities.projects,
  'projects-dropdown': RealtimeEntities.projects,
  'projects-for-po-filter': RealtimeEntities.projects,
  'project-access': ['Project', 'ProjectMember'],
  'project-members': ['ProjectMember', 'User', 'UserRole'],
  members: ['ProjectMember', 'User', 'UserRole'],

  wbsTree: RealtimeEntities.projects,
  wbsData: RealtimeEntities.projects,
  wbsProject: ['Project'],
  wbsMembers: ['ProjectMember', 'User', 'UserRole'],
  wbsMaterialRequests: RealtimeEntities.materialRequests,
  wbsIncidents: RealtimeEntities.incidents,
  tasks: RealtimeEntities.projects,
  'task-progress-history': [...RealtimeEntities.projects, ...RealtimeEntities.dailyLogs],
  'daily-logs': RealtimeEntities.dailyLogs,

  incidents: RealtimeEntities.incidents,
  globalIncidents: RealtimeEntities.incidents,
  projectIncidents: RealtimeEntities.incidents,
  phaseAcceptances: RealtimeEntities.phaseAcceptances,

  materialRequests: [...RealtimeEntities.materialRequests, ...RealtimeEntities.procurement],
  'approved-requests-po': [...RealtimeEntities.materialRequests, ...RealtimeEntities.procurement],
  'next-po-number': ['PurchaseOrder'],
  'purchase-orders': [...RealtimeEntities.procurement, ...RealtimeEntities.inventory],
  'project-purchase-orders': [...RealtimeEntities.procurement, ...RealtimeEntities.inventory],
  'po-detail': [...RealtimeEntities.procurement, ...RealtimeEntities.inventory],
  'direct-purchases': [...RealtimeEntities.procurement, ...RealtimeEntities.inventory],
  'project-direct-purchases': [...RealtimeEntities.procurement, ...RealtimeEntities.inventory],
};
