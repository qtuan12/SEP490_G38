import { createContext, useContext, useState, ReactNode } from 'react';

// Interfaces
export interface Project {
  id: string;
  name: string;
  address: string;
  type: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  progress: number;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Task {
  id: string;
  phaseId: string;
  projectId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  assigneeId: string;
  assigneeName: string;
  progress: number; // 0-100
  status: 'new' | 'assigned' | 'in-progress' | 'completed' | 'accepted' | 'obsolete';
  parentId?: string;
  delayReason?: string;
  delayLog?: Array<{ date: string; reason: string; oldDeadline: string; newDeadline: string }>;
  incidentLog?: Array<{ date: string; reason: string; oldProgress: number; newProgress: number; author: string }>;
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'approved';
  acceptanceReport?: string;
  acceptanceDate?: string;
  acceptancePdfUrl?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'TPKT' | 'Kỹ sư' | 'Kế toán' | 'Giám đốc' | 'Admin';
  email: string;
  avatar?: string;
}

export interface DailyLogEntry {
  id: string;
  date: string;
  project: string;
  projectId: string;
  task: string;
  taskId: string;
  progress: number;
  description: string;
  images: string[];
  author: string;
  authorId: string;
  comments: Comment[];
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  project: string;
  materialId: string;
  material: string;
  phaseId: string;
  phase: string;
  quantity: number;
  unit: string;
  quota: number;
  used: number;
  status: 'pending' | 'accountant-review' | 'director-review' | 'approved' | 'rejected';
  isOverQuota: boolean;
  reason: string;
  requestDate: string;
  requester: string;
  requesterId: string;
  rejectionReason?: string;
}

export interface InventoryItem {
  materialId: string;
  material: string;
  unit: string;
  inStock: number;
  quota: number;
  minStock: number;
  lastUpdate: string;
  projectId: string;
  project: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  materialId: string;
  material: string;
  quantity: number;
  unit: string;
  from: string;
  to: string;
  note: string;
  projectId: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  projectId: string;
  project: string;
  supplier: string;
  orderDate: string;
  expectedDate: string;
  status: 'sent' | 'partial' | 'completed';
  totalAmount: number;
  receivedAmount: number;
  items: POItem[];
  materialRequestIds: string[];
  receivedItems?: { [materialId: string]: number }; // Theo dõi số lượng đã nhận theo từng vật tư
}

export interface POItem {
  materialId: string;
  material: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
}

export interface ExcessProposal {
  id: string;
  projectId: string;
  project: string;
  materialId: string;
  material: string;
  quantity: number;
  unit: string;
  type: 'return-ncc' | 'transfer-project';
  destProjectId?: string;
  destProjectName?: string;
  reason: string;
  status: 'submitted' | 'accountant-checked' | 'approved' | 'rejected' | 'completed';
  proposerId: string;
  proposerName: string;
  requestDate: string;
  rejectionReason?: string;
  accountantNote?: string;
  refundAmount?: number;
  isDispatched?: boolean; // Xác nhận đã xuất hàng
  isReceived?: boolean; // Xác nhận đã nhận hàng
}

export interface InventoryAdjustment {
  id: string;
  projectId: string;
  project: string;
  materialId: string;
  material: string;
  quantity: number; // hao hụt/mất mát (luôn giảm)
  unit: string;
  type: 'wastage' | 'theft' | 'wrong-execution' | 'shortage';
  incidentId?: string; // ID sự cố nếu là wrong-execution
  description: string;
  status: 'submitted' | 'accountant-checked' | 'approved' | 'rejected' | 'completed';
  proposerId: string;
  proposerName: string;
  requestDate: string;
  rejectionReason?: string;
  accountantNote?: string;
}

interface AppContextType {
  // Projects
  projects: Project[];
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Phases
  phases: Phase[];
  addPhase: (phase: Omit<Phase, 'id' | 'status'>) => void;
  updatePhase: (id: string, updates: Partial<Phase>) => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'progress' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  // Daily Logs
  dailyLogs: DailyLogEntry[];
  addDailyLog: (log: Omit<DailyLogEntry, 'id' | 'comments'>) => void;
  addComment: (logId: string, comment: Omit<Comment, 'id'>) => void;

  // Material Requests
  materialRequests: MaterialRequest[];
  addMaterialRequest: (request: Omit<MaterialRequest, 'id' | 'requestDate' | 'status'>) => void;
  updateMaterialRequestStatus: (
    id: string,
    status: MaterialRequest['status'],
    rejectionReason?: string
  ) => void;

  // Inventory
  inventory: InventoryItem[];
  updateInventory: (projectId: string, materialId: string, quantity: number) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'receivedAmount' | 'status'>) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  recordReceipt: (poId: string, receipts: { [materialId: string]: number }) => void;

  // Excess Proposals
  excessProposals: ExcessProposal[];
  addExcessProposal: (prop: Omit<ExcessProposal, 'id' | 'requestDate' | 'status'>) => void;
  updateExcessProposal: (id: string, updates: Partial<ExcessProposal>) => void;

  // Inventory Adjustments
  inventoryAdjustments: InventoryAdjustment[];
  addInventoryAdjustment: (adj: Omit<InventoryAdjustment, 'id' | 'requestDate' | 'status'>) => void;
  updateInventoryAdjustment: (id: string, updates: Partial<InventoryAdjustment>) => void;

  // Users & Current User
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => boolean;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial mock data
// Export global materials catalog
export const MATERIALS = [
  { id: 'MAT001', name: 'Xi măng PCB40', unit: 'bao', defaultQuota: 1000 },
  { id: 'MAT002', name: 'Thép D16', unit: 'kg', defaultQuota: 500 },
  { id: 'MAT003', name: 'Cát xây dựng', unit: 'm3', defaultQuota: 1000 },
  { id: 'MAT004', name: 'Gạch block', unit: 'viên', defaultQuota: 20000 },
  { id: 'MAT005', name: 'Thép D10', unit: 'kg', defaultQuota: 800 },
  { id: 'MAT006', name: 'Đá 1x2', unit: 'm3', defaultQuota: 800 },
];

const initialUsers: User[] = [
  { id: 'USER001', name: 'Trần Quốc Bảo', role: 'TPKT', email: 'baotq@bpg.vn', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
  { id: 'USER002', name: 'Nguyễn Văn A', role: 'Kỹ sư', email: 'anv@bpg.vn', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
  { id: 'USER003', name: 'Nguyễn Văn B', role: 'Kỹ sư', email: 'bnv@bpg.vn', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
  { id: 'USER004', name: 'Lê Thị Hoa', role: 'Kế toán', email: 'hoalt@bpg.vn', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
  { id: 'USER005', name: 'Phạm Minh Hoàng', role: 'Giám đốc', email: 'hoangpm@bpg.vn', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80' },
];

const initialProjects: Project[] = [
  {
    id: 'PRJ001',
    name: 'Dự án Chung cư Green Park',
    address: '123 Nguyễn Văn A, Q.1, TP.HCM',
    type: 'Xây mới',
    status: 'active',
    progress: 65,
    startDate: '2026-01-15',
    endDate: '2026-08-30',
  },
  {
    id: 'PRJ002',
    name: 'Biệt thự Ocean View',
    address: '456 Trần Hưng Đạo, Q.5, TP.HCM',
    type: 'Xây mới',
    status: 'active',
    progress: 0,
    startDate: '2026-02-01',
    endDate: '2026-06-15',
  },
  {
    id: 'PRJ003',
    name: 'Nhà xưởng công nghiệp',
    address: 'KCN Tân Bình, Bình Dương',
    type: 'Xây mới',
    status: 'active',
    progress: 0,
    startDate: '2026-03-01',
    endDate: '2026-05-25',
  },
];

const initialPhases: Phase[] = [
  {
    id: 'PHASE001',
    projectId: 'PRJ001',
    name: 'Phase 1: Làm móng',
    order: 1,
    startDate: '2026-01-15',
    endDate: '2026-03-15',
    status: 'approved',
    acceptanceReport: 'Nghiệm thu phần móng đạt yêu cầu chất lượng, không sụt lún, hoàn thành đúng tiến độ.',
    acceptanceDate: '2026-03-14',
    acceptancePdfUrl: 'acceptance_PHASE001.pdf',
  },
  {
    id: 'PHASE002',
    projectId: 'PRJ001',
    name: 'Phase 2: Xây thô tầng 1',
    order: 2,
    startDate: '2026-03-16',
    endDate: '2026-06-30',
    status: 'draft',
  },
  {
    id: 'PHASE003',
    projectId: 'PRJ001',
    name: 'Phase 3: Hoàn thiện',
    order: 3,
    startDate: '2026-07-01',
    endDate: '2026-08-30',
    status: 'draft',
  },
];

const initialTasks: Task[] = [
  {
    id: 'TASK001',
    phaseId: 'PHASE001',
    projectId: 'PRJ001',
    name: 'Đào đất hố móng',
    description: 'Sử dụng máy xúc đào hố móng sâu 2.5m theo thiết kế bản vẽ.',
    startDate: '2026-01-15',
    endDate: '2026-01-30',
    assigneeId: 'USER002',
    assigneeName: 'Nguyễn Văn A',
    progress: 100,
    status: 'accepted',
  },
  {
    id: 'TASK002',
    phaseId: 'PHASE001',
    projectId: 'PRJ001',
    name: 'Lắp dựng cốt thép móng',
    description: 'Cắt, uốn và định hình thép D16, D10 gia cố khung móng.',
    startDate: '2026-02-01',
    endDate: '2026-02-20',
    assigneeId: 'USER002',
    assigneeName: 'Nguyễn Văn A',
    progress: 100,
    status: 'accepted',
  },
  {
    id: 'TASK003',
    phaseId: 'PHASE001',
    projectId: 'PRJ001',
    name: 'Đổ bê tông móng',
    description: 'Đổ bê tông thương phẩm mác 300 hoàn thành bề mặt móng.',
    startDate: '2026-02-21',
    endDate: '2026-03-10',
    assigneeId: 'USER002',
    assigneeName: 'Nguyễn Văn A',
    progress: 100,
    status: 'accepted',
  },
  {
    id: 'TASK004',
    phaseId: 'PHASE002',
    projectId: 'PRJ001',
    name: 'Dựng cột bê tông cốt thép',
    description: 'Lắp cốp pha cột dầm tầng 1, dựng thép gia cố dầm dọc dầm ngang.',
    startDate: '2026-03-16',
    endDate: '2026-04-15',
    assigneeId: 'USER003',
    assigneeName: 'Nguyễn Văn B',
    progress: 100,
    status: 'completed',
  },
  {
    id: 'TASK005',
    phaseId: 'PHASE002',
    projectId: 'PRJ001',
    name: 'Xây tường gạch dầm bao quanh',
    description: 'Xây tường bao dày 220mm bằng gạch block xi măng cốt liệu.',
    startDate: '2026-04-16',
    endDate: '2026-05-30',
    assigneeId: 'USER002',
    assigneeName: 'Nguyễn Văn A',
    progress: 50,
    status: 'in-progress',
    incidentLog: [],
    delayLog: [],
  },
  {
    id: 'TASK006',
    phaseId: 'PHASE002',
    projectId: 'PRJ001',
    name: 'Lắp đặt hệ thống điện nước ngầm dầm',
    description: 'Đi đường ống nhựa PVC cấp thoát nước và ống luồn dây điện âm tường.',
    startDate: '2026-06-01',
    endDate: '2026-06-25',
    assigneeId: 'USER003',
    assigneeName: 'Nguyễn Văn B',
    progress: 0,
    status: 'assigned',
  },
];

const initialDailyLogs: DailyLogEntry[] = [
  {
    id: 'LOG001',
    date: '2026-05-22',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
    taskId: 'TASK005',
    task: 'Xây tường gạch dầm bao quanh',
    progress: 50,
    description: 'Hoàn thành xây tường bao phía đông. Thời tiết thuận lợi, công việc diễn ra đúng tiến độ.',
    images: [],
    authorId: 'USER002',
    author: 'Nguyễn Văn A',
    comments: [],
  },
];

const initialMaterialRequests: MaterialRequest[] = [
  {
    id: 'MR001',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
    materialId: 'MAT001',
    material: 'Xi măng PCB40',
    phaseId: 'PHASE002',
    phase: 'Phase 2: Xây thô tầng 1',
    quantity: 150,
    unit: 'bao',
    quota: 1000,
    used: 120,
    status: 'director-review',
    isOverQuota: false,
    reason: 'Phát sinh thi công xây dầm bao',
    requestDate: '2026-05-22',
    requesterId: 'USER002',
    requester: 'Nguyễn Văn A',
  },
];

const initialInventory: InventoryItem[] = [
  {
    materialId: 'MAT001',
    material: 'Xi măng PCB40',
    unit: 'bao',
    inStock: 120,
    quota: 1000,
    minStock: 50,
    lastUpdate: '2026-05-22',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
  },
  {
    materialId: 'MAT002',
    material: 'Thép D16',
    unit: 'kg',
    inStock: 500,
    quota: 500,
    minStock: 50,
    lastUpdate: '2026-05-22',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
  },
  {
    materialId: 'MAT003',
    material: 'Cát xây dựng',
    unit: 'm3',
    inStock: 100,
    quota: 1000,
    minStock: 100,
    lastUpdate: '2026-05-22',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
  },
];

const initialTransactions: Transaction[] = [
  {
    id: 'TX001',
    date: '2026-05-22 14:30',
    type: 'in',
    materialId: 'MAT001',
    material: 'Xi măng PCB40',
    quantity: 100,
    unit: 'bao',
    from: 'PO-2026-001',
    to: 'Chung cư Green Park',
    note: 'Nhận hàng từ NCC Hoàng Long',
    projectId: 'PRJ001',
  },
];

const initialPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO001',
    poNumber: 'PO-2026-001',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
    supplier: 'Công ty TNHH Hoàng Long',
    orderDate: '2026-05-20',
    expectedDate: '2026-05-25',
    status: 'partial',
    totalAmount: 23250000,
    receivedAmount: 14250000,
    materialRequestIds: ['MR001'],
    items: [
      {
        materialId: 'MAT001',
        material: 'Xi măng PCB40',
        quantity: 150,
        unit: 'bao',
        unitPrice: 95000,
        totalPrice: 14250000,
        receivedQuantity: 100,
      },
      {
        materialId: 'MAT002',
        material: 'Thép D16',
        quantity: 500,
        unit: 'kg',
        unitPrice: 18000,
        totalPrice: 9000000,
        receivedQuantity: 0,
      },
    ],
    receivedItems: {
      'MAT001': 100
    }
  },
];

const initialExcessProposals: ExcessProposal[] = [
  {
    id: 'EP001',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
    materialId: 'MAT001',
    material: 'Xi măng PCB40',
    quantity: 50,
    unit: 'bao',
    type: 'return-ncc',
    reason: 'Xi măng thừa cuối giai đoạn móng cần trả lại NCC',
    status: 'approved',
    proposerId: 'USER002',
    proposerName: 'Nguyễn Văn A',
    requestDate: '2026-05-22',
    accountantNote: 'Đã đối chiếu với NCC, họ đồng ý nhận lại 50 bao với giá 80%',
  }
];

const initialInventoryAdjustments: InventoryAdjustment[] = [
  {
    id: 'ADJ001',
    projectId: 'PRJ001',
    project: 'Chung cư Green Park',
    materialId: 'MAT001',
    material: 'Xi măng PCB40',
    quantity: 10,
    unit: 'bao',
    type: 'wastage',
    description: 'Hao hụt xi măng ẩm mốc do trời mưa ngập kho bãi',
    status: 'approved',
    proposerId: 'USER002',
    proposerName: 'Nguyễn Văn A',
    requestDate: '2026-05-21',
    accountantNote: 'Đã xác nhận sự cố ngập bãi và lập biên bản kiểm kê',
  }
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(initialDailyLogs);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(
    initialMaterialRequests
  );
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPurchaseOrders);
  const [excessProposals, setExcessProposals] = useState<ExcessProposal[]>(initialExcessProposals);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustment[]>(initialInventoryAdjustments);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUser = localStorage.getItem('bpg_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        // ignore
      }
    }
    return initialUsers[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('bpg_auth') === 'true';
  });

  const login = (email: string, password?: string): boolean => {
    const user = initialUsers.find((u) => u.email === email.trim().toLowerCase());
    // For demo/simulation, accept password123 as valid password
    if (user && (!password || password === 'password123')) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('bpg_user', JSON.stringify(user));
      localStorage.setItem('bpg_auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('bpg_auth');
    localStorage.removeItem('bpg_user');
  };

  // Project functions
  const addProject = (project: Omit<Project, 'id'>) => {
    const newProject = {
      ...project,
      id: `PRJ${String(projects.length + 1).padStart(3, '0')}`,
    };
    setProjects([...projects, newProject]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProject = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id));
  };

  // Phase functions
  const addPhase = (phase: Omit<Phase, 'id' | 'status'>) => {
    const newPhase: Phase = {
      ...phase,
      id: `PHASE${String(phases.length + 1).padStart(3, '0')}`,
      status: 'draft',
    };
    setPhases([...phases, newPhase]);
  };

  const updatePhase = (id: string, updates: Partial<Phase>) => {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  // Task functions
  const addTask = (task: Omit<Task, 'id' | 'progress' | 'status'>) => {
    const newTask: Task = {
      ...task,
      id: `TASK${String(tasks.length + 1).padStart(3, '0')}`,
      progress: 0,
      status: 'new',
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...updates };
          if (updates.progress !== undefined) {
            const prog = updates.progress;
            if (prog === 0) {
              updated.status = updated.assigneeId ? 'assigned' : 'new';
            } else if (prog > 0 && prog < 100) {
              updated.status = 'in-progress';
            } else if (prog === 100) {
              updated.status = 'completed';
            }
          }
          return updated;
        }
        return t;
      })
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // Daily Log functions
  const addDailyLog = (log: Omit<DailyLogEntry, 'id' | 'comments'>) => {
    const newLog: DailyLogEntry = {
      ...log,
      id: `LOG${String(dailyLogs.length + 1).padStart(3, '0')}`,
      comments: [],
    };
    setDailyLogs([newLog, ...dailyLogs]);

    // Update task progress in WBS
    if (log.taskId) {
      updateTask(log.taskId, { progress: log.progress });
    }

    // Recalculate project progress based on average of tasks
    const projectTasks = tasks.filter((t) => t.projectId === log.projectId && t.status !== 'obsolete');
    if (projectTasks.length > 0) {
      // Tính trung bình tiến độ các task
      const updatedTasks = projectTasks.map(t => t.id === log.taskId ? { ...t, progress: log.progress } : t);
      const totalProgress = updatedTasks.reduce((sum, t) => sum + t.progress, 0);
      const avgProgress = Math.round(totalProgress / projectTasks.length);
      updateProject(log.projectId, { progress: avgProgress });
    } else {
      // Backup logic if no tasks yet
      const project = projects.find((p) => p.id === log.projectId);
      if (project && log.progress > project.progress) {
        updateProject(project.id, { progress: log.progress });
      }
    }
  };

  const addComment = (logId: string, comment: Omit<Comment, 'id'>) => {
    setDailyLogs(
      dailyLogs.map((log) => {
        if (log.id === logId) {
          const newComment = {
            ...comment,
            id: `CMT${String(log.comments.length + 1).padStart(3, '0')}`,
          };
          return {
            ...log,
            comments: [...log.comments, newComment],
          };
        }
        return log;
      })
    );
  };

  // Material Request functions
  const addMaterialRequest = (
    request: Omit<MaterialRequest, 'id' | 'requestDate' | 'status'>
  ) => {
    const newRequest: MaterialRequest = {
      ...request,
      id: `MR${String(materialRequests.length + 1).padStart(3, '0')}`,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending',
    };
    setMaterialRequests([...materialRequests, newRequest]);
  };

  const updateMaterialRequestStatus = (
    id: string,
    status: MaterialRequest['status'],
    rejectionReason?: string
  ) => {
    setMaterialRequests(
      materialRequests.map((r) =>
        r.id === id ? { ...r, status, rejectionReason } : r
      )
    );
  };

  // Inventory functions
  const updateInventory = (projectId: string, materialId: string, quantity: number) => {
    setInventory((prevInventory) => {
      const exists = prevInventory.some((item) => item.projectId === projectId && item.materialId === materialId);
      if (exists) {
        return prevInventory.map((item) => {
          if (item.projectId === projectId && item.materialId === materialId) {
            return {
              ...item,
              inStock: Math.max(0, item.inStock + quantity),
              lastUpdate: new Date().toISOString().split('T')[0],
            };
          }
          return item;
        });
      } else {
        const matInfo = MATERIALS.find((m) => m.id === materialId) || { name: materialId, unit: 'đơn vị', defaultQuota: 1000 };
        const projectInfo = projects.find((p) => p.id === projectId) || { name: projectId };
        const newItem: InventoryItem = {
          materialId,
          material: matInfo.name,
          unit: matInfo.unit,
          inStock: Math.max(0, quantity),
          quota: matInfo.defaultQuota,
          minStock: Math.round(matInfo.defaultQuota * 0.1),
          lastUpdate: new Date().toISOString().split('T')[0],
          projectId,
          project: projectInfo.name,
        };
        return [...prevInventory, newItem];
      }
    });
  };

  // Transaction functions
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `TX${String(transactions.length + 1).padStart(3, '0')}`,
    };
    setTransactions((prev) => [newTransaction, ...prev]);

    // Update inventory based on transaction
    if (transaction.type === 'in') {
      updateInventory(transaction.projectId, transaction.materialId, transaction.quantity);
    } else if (transaction.type === 'out') {
      updateInventory(transaction.projectId, transaction.materialId, -transaction.quantity);
    } else if (transaction.type === 'transfer') {
      // transfer: from (source projectId) -> to (destination projectId)
      updateInventory(transaction.from, transaction.materialId, -transaction.quantity);
      updateInventory(transaction.to, transaction.materialId, transaction.quantity);
    }
  };

  // Purchase Order functions
  const addPurchaseOrder = (po: Omit<PurchaseOrder, 'id' | 'receivedAmount' | 'status'>) => {
    const newPO: PurchaseOrder = {
      ...po,
      id: `PO${String(purchaseOrders.length + 1).padStart(3, '0')}`,
      receivedAmount: 0,
      status: 'sent',
      items: po.items.map((item) => ({ ...item, receivedQuantity: 0 })),
      receivedItems: {}
    };
    setPurchaseOrders([...purchaseOrders, newPO]);

    // Update material request status to approved
    po.materialRequestIds.forEach((mrId) => {
      updateMaterialRequestStatus(mrId, 'approved');
    });
  };

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
    setPurchaseOrders(purchaseOrders.map((po) => (po.id === id ? { ...po, ...updates } : po)));
  };

  const recordReceipt = (poId: string, receipts: { [materialId: string]: number }) => {
    setPurchaseOrders((prevPO) =>
      prevPO.map((po) => {
        if (po.id === poId) {
          const receivedItems = { ...(po.receivedItems || {}) };

          const updatedItems = po.items.map((item) => {
            const qtyReceivedThisTime = receipts[item.materialId] || 0;
            if (qtyReceivedThisTime > 0) {
              const newReceivedQty = item.receivedQuantity + qtyReceivedThisTime;
              receivedItems[item.materialId] = (receivedItems[item.materialId] || 0) + qtyReceivedThisTime;
              return {
                ...item,
                receivedQuantity: newReceivedQty,
              };
            }
            return item;
          });

          const totalReceived = updatedItems.reduce(
            (sum, item) => sum + (item.unitPrice * item.receivedQuantity),
            0
          );
          const allReceived = updatedItems.every((item) => item.receivedQuantity >= item.quantity);
          const anyReceived = updatedItems.some((item) => item.receivedQuantity > 0);

          return {
            ...po,
            items: updatedItems,
            receivedAmount: totalReceived,
            receivedItems,
            status: allReceived ? 'completed' : anyReceived ? 'partial' : 'sent',
          };
        }
        return po;
      })
    );

    // Ghi nhận nhận hàng trong transactions & cập nhật kho
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) {
      Object.entries(receipts).forEach(([materialId, quantity]) => {
        if (quantity > 0) {
          const item = po.items.find((i) => i.materialId === materialId);
          if (item) {
            addTransaction({
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              type: 'in',
              materialId,
              material: item.material,
              quantity,
              unit: item.unit,
              from: po.poNumber,
              to: po.project,
              note: `Nhận hàng từ đơn PO ${po.poNumber}`,
              projectId: po.projectId,
            });
          }
        }
      });
    }
  };

  // Excess Proposal functions
  const addExcessProposal = (prop: Omit<ExcessProposal, 'id' | 'requestDate' | 'status'>) => {
    const newProp: ExcessProposal = {
      ...prop,
      id: `EP${String(excessProposals.length + 1).padStart(3, '0')}`,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'submitted',
    };
    setExcessProposals([...excessProposals, newProp]);
  };

  const updateExcessProposal = (id: string, updates: Partial<ExcessProposal>) => {
    setExcessProposals((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };

          if (updated.status === 'completed' && p.status !== 'completed') {
            if (updated.type === 'return-ncc') {
              // Trừ tồn kho dự án
              updateInventory(updated.projectId, updated.materialId, -updated.quantity);
              // Lưu giao dịch
              addTransaction({
                date: new Date().toISOString().replace('T', ' ').substring(0, 16),
                type: 'out',
                materialId: updated.materialId,
                material: updated.material,
                quantity: updated.quantity,
                unit: updated.unit,
                from: updated.project,
                to: 'Trả lại Nhà cung cấp',
                note: `Trả hàng thừa thu hồi chi phí (Hoàn tiền: ${updated.refundAmount ? updated.refundAmount.toLocaleString() : 0}đ)`,
                projectId: updated.projectId,
              });
            }
          }

          if (updated.type === 'transfer-project' && updated.status === 'approved') {
            if (updated.isDispatched && updated.isReceived) {
              updated.status = 'completed';
              // Trừ kho nguồn
              updateInventory(updated.projectId, updated.materialId, -updated.quantity);
              // Cộng kho đích
              updateInventory(updated.destProjectId || '', updated.materialId, updated.quantity);
              // Lưu giao dịch
              addTransaction({
                date: new Date().toISOString().replace('T', ' ').substring(0, 16),
                type: 'transfer',
                materialId: updated.materialId,
                material: updated.material,
                quantity: updated.quantity,
                unit: updated.unit,
                from: updated.projectId,
                to: updated.destProjectId || '',
                note: `Chuyển vật tư thừa từ ${updated.project} sang ${updated.destProjectName}`,
                projectId: updated.projectId,
              });
            }
          }

          return updated;
        }
        return p;
      })
    );
  };

  // Inventory Adjustment functions
  const addInventoryAdjustment = (adj: Omit<InventoryAdjustment, 'id' | 'requestDate' | 'status'>) => {
    const newAdj: InventoryAdjustment = {
      ...adj,
      id: `ADJ${String(inventoryAdjustments.length + 1).padStart(3, '0')}`,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'submitted',
    };
    setInventoryAdjustments([...inventoryAdjustments, newAdj]);
  };

  const updateInventoryAdjustment = (id: string, updates: Partial<InventoryAdjustment>) => {
    setInventoryAdjustments((prev) =>
      prev.map((adj) => {
        if (adj.id === id) {
          const updated = { ...adj, ...updates };
          if (updated.status === 'approved' && adj.status !== 'approved') {
            updated.status = 'completed'; // Auto complete
            // Trừ tồn kho
            updateInventory(updated.projectId, updated.materialId, -updated.quantity);
            // Lưu giao dịch
            addTransaction({
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              type: 'out',
              materialId: updated.materialId,
              material: updated.material,
              quantity: updated.quantity,
              unit: updated.unit,
              from: updated.project,
              to: `Điều chỉnh giảm kho (${updated.type === 'wastage' ? 'Hao hụt' : updated.type === 'theft' ? 'Mất mát' : updated.type === 'wrong-execution' ? 'Thi công sai' : 'Thiếu hụt kiểm kê'})`,
              note: updated.description,
              projectId: updated.projectId,
            });
          }
          return updated;
        }
        return adj;
      })
    );
  };

  const value: AppContextType = {
    projects,
    addProject,
    updateProject,
    deleteProject,
    phases,
    addPhase,
    updatePhase,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    dailyLogs,
    addDailyLog,
    addComment,
    materialRequests,
    addMaterialRequest,
    updateMaterialRequestStatus,
    inventory,
    updateInventory,
    transactions,
    addTransaction,
    purchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrder,
    recordReceipt,
    excessProposals,
    addExcessProposal,
    updateExcessProposal,
    inventoryAdjustments,
    addInventoryAdjustment,
    updateInventoryAdjustment,
    users: initialUsers,
    currentUser,
    setCurrentUser,
    isAuthenticated,
    login,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
