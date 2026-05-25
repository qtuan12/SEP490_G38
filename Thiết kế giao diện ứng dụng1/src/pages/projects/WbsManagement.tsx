import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Lock as LockIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  History as HistoryIcon,
  ReportProblem as ReportProblemIcon,
  ObsoleteIcon, // We can use Block or Warning
  Block as BlockIcon,
  Info as InfoIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useApp, MATERIALS, Phase, Task, User } from '@/context/AppContext';

interface WbsManagementProps {
  projectId: string;
  onBack: () => void;
}

export default function WbsManagement({ projectId, onBack }: WbsManagementProps) {
  const {
    projects,
    phases,
    addPhase,
    updatePhase,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    dailyLogs,
    inventory,
    updateInventory,
    users,
    currentUser,
  } = useApp();

  const [tabValue, setTabValue] = useState(0);
  const [openPhaseDialog, setOpenPhaseDialog] = useState(false);
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [openIncidentDialog, setOpenIncidentDialog] = useState(false);
  const [openDelayDialog, setOpenDelayDialog] = useState(false);
  const [openAcceptanceDialog, setOpenAcceptanceDialog] = useState(false);
  const [openCancelAcceptanceDialog, setOpenCancelAcceptanceDialog] = useState(false);
  const [openQuotaDialog, setOpenQuotaDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);

  // Form states
  const [phaseName, setPhaseName] = useState('');
  const [phaseStartDate, setPhaseStartDate] = useState('');
  const [phaseEndDate, setPhaseEndDate] = useState('');

  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPhaseId, setTaskPhaseId] = useState('');

  const [incidentProgress, setIncidentProgress] = useState(0);
  const [incidentReason, setIncidentReason] = useState('');
  const [incidentDeadline, setIncidentDeadline] = useState('');

  const [delayNewDeadline, setDelayNewDeadline] = useState('');
  const [delayReason, setDelayReason] = useState('');

  const [acceptanceReport, setAcceptanceReport] = useState('');
  const [cancelAcceptanceReason, setCancelAcceptanceReason] = useState('');

  const [quotaMaterialId, setQuotaMaterialId] = useState('');
  const [quotaQuantity, setQuotaQuantity] = useState(100);

  const project = projects.find((p) => p.id === projectId);
  const projectPhases = phases.filter((p) => p.projectId === projectId).sort((a, b) => a.order - b.order);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const engineers = users.filter((u) => u.role === 'Kỹ sư');

  if (!project) return <Typography>Dự án không tồn tại</Typography>;

  // Thao tác với Phase
  const handleOpenPhaseDialog = (phase?: Phase) => {
    if (phase) {
      setSelectedPhase(phase);
      setPhaseName(phase.name);
      setPhaseStartDate(phase.startDate);
      setPhaseEndDate(phase.endDate);
    } else {
      setSelectedPhase(null);
      setPhaseName('');
      setPhaseStartDate(project.startDate);
      setPhaseEndDate(project.endDate);
    }
    setOpenPhaseDialog(true);
  };

  const handleSavePhase = () => {
    if (!phaseName || !phaseStartDate || !phaseEndDate) return;

    if (selectedPhase) {
      updatePhase(selectedPhase.id, {
        name: phaseName,
        startDate: phaseStartDate,
        endDate: phaseEndDate,
      });
    } else {
      addPhase({
        projectId,
        name: phaseName,
        order: projectPhases.length + 1,
        startDate: phaseStartDate,
        endDate: phaseEndDate,
      });
    }
    setOpenPhaseDialog(false);
  };

  // Thao tác với Task
  const handleOpenTaskDialog = (phaseId: string, task?: Task) => {
    setTaskPhaseId(phaseId);
    const phase = projectPhases.find((p) => p.id === phaseId);
    if (task) {
      setSelectedTask(task);
      setTaskName(task.name);
      setTaskDescription(task.description);
      setTaskStartDate(task.startDate);
      setTaskEndDate(task.endDate);
      setTaskAssigneeId(task.assigneeId);
    } else {
      setSelectedTask(null);
      setTaskName('');
      setTaskDescription('');
      setTaskStartDate(phase?.startDate || project.startDate);
      setTaskEndDate(phase?.endDate || project.endDate);
      setTaskAssigneeId('');
    }
    setOpenTaskDialog(true);
  };

  const handleSaveTask = () => {
    if (!taskName || !taskStartDate || !taskEndDate || !taskAssigneeId) return;

    // Validate deadline task con <= phase
    const phase = projectPhases.find((p) => p.id === taskPhaseId);
    if (phase) {
      if (taskEndDate > phase.endDate) {
        alert('Hạn chót của công việc không được vượt quá hạn chót của giai đoạn (Phase)!');
        return;
      }
    }

    const assignee = engineers.find((e) => e.id === taskAssigneeId);

    if (selectedTask) {
      updateTask(selectedTask.id, {
        name: taskName,
        description: taskDescription,
        startDate: taskStartDate,
        endDate: taskEndDate,
        assigneeId: taskAssigneeId,
        assigneeName: assignee ? assignee.name : '',
      });
    } else {
      addTask({
        phaseId: taskPhaseId,
        projectId,
        name: taskName,
        description: taskDescription,
        startDate: taskStartDate,
        endDate: taskEndDate,
        assigneeId: taskAssigneeId,
        assigneeName: assignee ? assignee.name : '',
      });
    }
    setOpenTaskDialog(false);
  };

  // Điều chỉnh giảm tiến độ do sự cố (Incident)
  const handleOpenIncidentDialog = (task: Task) => {
    setSelectedTask(task);
    setIncidentProgress(task.progress - 10 > 0 ? task.progress - 10 : 0);
    setIncidentReason('');
    setIncidentDeadline(task.endDate);
    setOpenIncidentDialog(true);
  };

  const handleSaveIncident = () => {
    if (!selectedTask || !incidentReason) return;
    if (incidentProgress >= selectedTask.progress) {
      alert('Tiến độ mới phải nhỏ hơn tiến độ hiện tại!');
      return;
    }

    const newIncidentLog = [
      ...(selectedTask.incidentLog || []),
      {
        date: new Date().toISOString().split('T')[0],
        reason: incidentReason,
        oldProgress: selectedTask.progress,
        newProgress: incidentProgress,
        author: currentUser.name,
      },
    ];

    const updates: Partial<Task> = {
      progress: incidentProgress,
      incidentLog: newIncidentLog,
    };

    if (incidentDeadline !== selectedTask.endDate) {
      const newDelayLog = [
        ...(selectedTask.delayLog || []),
        {
          date: new Date().toISOString().split('T')[0],
          reason: `Sự cố: ${incidentReason}`,
          oldDeadline: selectedTask.endDate,
          newDeadline: incidentDeadline,
        },
      ];
      updates.endDate = incidentDeadline;
      updates.delayLog = newDelayLog;
    }

    updateTask(selectedTask.id, updates);
    setOpenIncidentDialog(false);
  };

  // Điều chỉnh gia hạn chót (Delay)
  const handleOpenDelayDialog = (task: Task) => {
    setSelectedTask(task);
    setDelayNewDeadline(task.endDate);
    setDelayReason('');
    setOpenDelayDialog(true);
  };

  const handleSaveDelay = () => {
    if (!selectedTask || !delayNewDeadline || !delayReason) return;

    if (delayNewDeadline <= selectedTask.endDate) {
      alert('Hạn chót mới phải lớn hơn hạn chót cũ!');
      return;
    }

    const newDelayLog = [
      ...(selectedTask.delayLog || []),
      {
        date: new Date().toISOString().split('T')[0],
        reason: delayReason,
        oldDeadline: selectedTask.endDate,
        newDeadline: delayNewDeadline,
      },
    ];

    updateTask(selectedTask.id, {
      endDate: delayNewDeadline,
      delayLog: newDelayLog,
    });
    setOpenDelayDialog(false);
  };

  // Nghiệm thu phase
  const handleOpenAcceptance = (phase: Phase) => {
    setSelectedPhase(phase);
    setAcceptanceReport('');
    setOpenAcceptanceDialog(true);
  };

  const handleConfirmAcceptance = () => {
    if (!selectedPhase || acceptanceReport.length < 50) {
      alert('Vui lòng nhập báo cáo nghiệm thu chi tiết (tối thiểu 50 ký tự)!');
      return;
    }

    const pdfName = `acceptance_${selectedPhase.id}_${Date.now()}.pdf`;
    updatePhase(selectedPhase.id, {
      status: 'approved',
      acceptanceReport,
      acceptanceDate: new Date().toISOString().split('T')[0],
      acceptancePdfUrl: pdfName,
    });

    // Khóa tất cả các task trong phase
    projectTasks
      .filter((t) => t.phaseId === selectedPhase.id)
      .forEach((t) => {
        updateTask(t.id, { status: 'accepted' });
      });

    setOpenAcceptanceDialog(false);
  };

  // Hủy nghiệm thu
  const handleOpenCancelAcceptance = (phase: Phase) => {
    setSelectedPhase(phase);
    setCancelAcceptanceReason('');
    setOpenCancelAcceptanceDialog(true);
  };

  const handleConfirmCancelAcceptance = () => {
    if (!selectedPhase || !cancelAcceptanceReason) return;

    updatePhase(selectedPhase.id, {
      status: 'draft',
      acceptanceReport: undefined,
      acceptanceDate: undefined,
      acceptancePdfUrl: undefined,
    });

    // Mở khóa các task về lại trạng thái completed (100%)
    projectTasks
      .filter((t) => t.phaseId === selectedPhase.id)
      .forEach((t) => {
        updateTask(t.id, { status: 'completed' });
      });

    setOpenCancelAcceptanceDialog(false);
  };

  // Đổi trạng thái Obsolete
  const handleToggleObsolete = (task: Task) => {
    const isObsolete = task.status === 'obsolete';
    const reason = prompt('Nhập lý do thay đổi thiết kế / bỏ qua công việc này:');
    if (!reason) return;

    updateTask(task.id, {
      status: isObsolete ? 'new' : 'obsolete',
      delayReason: reason,
    });
  };

  // Định mức vật tư
  const handleSaveQuota = () => {
    if (!quotaMaterialId || quotaQuantity <= 0) return;
    updateInventory(projectId, quotaMaterialId, 0); // Initialize if not exists
    // Update quota in state
    const mat = MATERIALS.find((m) => m.id === quotaMaterialId);
    if (mat) {
      const invItem = inventory.find((item) => item.projectId === projectId && item.materialId === quotaMaterialId);
      if (invItem) {
        invItem.quota = quotaQuantity;
        invItem.minStock = Math.round(quotaQuantity * 0.1);
      }
    }
    setOpenQuotaDialog(false);
  };

  const getPhaseTasks = (phaseId: string) => projectTasks.filter((t) => t.phaseId === phaseId);

  const getTaskStatusChip = (task: Task) => {
    switch (task.status) {
      case 'accepted':
        return <Chip label="Đã nghiệm thu" color="success" size="small" icon={<CheckCircleIcon />} />;
      case 'completed':
        return <Chip label="Đã xong (100%)" color="info" size="small" />;
      case 'in-progress':
        return <Chip label={`Đang làm (${task.progress}%)`} color="primary" size="small" />;
      case 'assigned':
        return <Chip label="Đã phân công" color="warning" size="small" />;
      case 'obsolete':
        return <Chip label="Hủy bỏ (Obsolete)" color="error" size="small" variant="outlined" icon={<BlockIcon />} />;
      default:
        return <Chip label="Chưa phân công" color="default" size="small" />;
    }
  };

  const isTPKT = currentUser.role === 'TPKT';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={onBack} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">
          Kế hoạch thi công & định mức - {project.name}
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, nv) => setTabValue(nv)}>
          <Tab label="Kế hoạch thi công WBS" />
          <Tab label="Định mức vật tư (Quota)" />
        </Tabs>
      </Paper>

      {/* TAB 1: KẾ HOẠCH THI CÔNG WBS */}
      {tabValue === 0 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          {isTPKT && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenPhaseDialog()}>
                Thêm Phase (Giai đoạn)
              </Button>
            </Box>
          )}

          {projectPhases.map((phase) => {
            const phaseTasks = getPhaseTasks(phase.id);
            const allTasks100 = phaseTasks.length > 0 && phaseTasks.every((t) => t.progress === 100);
            const isApproved = phase.status === 'approved';

            return (
              <Card key={phase.id} sx={{ borderLeft: `6px solid ${isApproved ? '#2e7d32' : '#1976d2'}` }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {phase.name}
                        </Typography>
                        {isApproved ? (
                          <Chip label="Đã nghiệm thu phase" color="success" size="small" icon={<CheckCircleIcon />} />
                        ) : (
                          <Chip label="Đang thi công" color="primary" size="small" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Thời gian: {phase.startDate} đến {phase.endDate}
                      </Typography>
                    </Box>

                    {isTPKT && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" onClick={() => handleOpenPhaseDialog(phase)} disabled={isApproved}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {!isApproved && allTasks100 && (
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<AssignmentTurnedInIcon />}
                            onClick={() => handleOpenAcceptance(phase)}
                          >
                            Nghiệm thu Phase
                          </Button>
                        )}
                        {isApproved && (
                          <>
                            {phase.acceptancePdfUrl && (
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<PdfIcon />}
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  alert(`Biên bản PDF giả lập:\nTên file: ${phase.acceptancePdfUrl}\nNgày nghiệm thu: ${phase.acceptanceDate}\nBáo cáo chi tiết: ${phase.acceptanceReport}\nĐã được ký điện tử bởi TPKT: ${currentUser.name}`);
                                }}
                              >
                                Xem biên bản
                              </Button>
                            )}
                            <Button
                              variant="outlined"
                              color="warning"
                              size="small"
                              startIcon={<CancelIcon />}
                              onClick={() => handleOpenCancelAcceptance(phase)}
                            >
                              Hủy nghiệm thu
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenTaskDialog(phase.id)}
                          disabled={isApproved}
                        >
                          Thêm Task
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Tasks List */}
                  {phaseTasks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      Chưa có công việc nào trong giai đoạn này.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Tên công việc</TableCell>
                            <TableCell>Mô tả</TableCell>
                            <TableCell>Kỹ sư</TableCell>
                            <TableCell>Thời hạn</TableCell>
                            <TableCell>Trạng thái</TableCell>
                            <TableCell align="center">Thao tác</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {phaseTasks.map((task) => {
                            const hasIncident = task.incidentLog && task.incidentLog.length > 0;
                            const hasDelay = task.delayLog && task.delayLog.length > 0;

                            return (
                              <TableRow key={task.id} hover>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {isApproved && <LockIcon fontSize="inherit" color="action" />}
                                    <Typography variant="body2" fontWeight="bold">
                                      {task.name}
                                    </Typography>
                                    {hasIncident && (
                                      <Tooltip title="Task này từng xảy ra sự cố giảm tiến độ">
                                        <ReportProblemIcon color="error" sx={{ fontSize: 16 }} />
                                      </Tooltip>
                                    )}
                                    {hasDelay && (
                                      <Tooltip title="Task này từng bị gia hạn tiến độ">
                                        <HistoryIcon color="warning" sx={{ fontSize: 16 }} />
                                      </Tooltip>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>{task.description}</TableCell>
                                <TableCell>{task.assigneeName}</TableCell>
                                <TableCell>
                                  <Typography variant="caption" display="block">
                                    {task.startDate}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    đến {task.endDate}
                                  </Typography>
                                </TableCell>
                                <TableCell>{getTaskStatusChip(task)}</TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                    {isTPKT && !isApproved && (
                                      <>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => handleOpenTaskDialog(phase.id, task)}
                                        >
                                          <EditIcon fontSize="inherit" />
                                        </IconButton>
                                        {task.progress > 0 && task.progress < 100 && (
                                          <Tooltip title="Báo cáo sự cố & giảm tiến độ">
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => handleOpenIncidentDialog(task)}
                                            >
                                              <ReportProblemIcon fontSize="inherit" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        {task.progress > 0 && (
                                          <Tooltip title="Điều chỉnh deadline">
                                            <IconButton
                                              size="small"
                                              color="warning"
                                              onClick={() => handleOpenDelayDialog(task)}
                                            >
                                              <HistoryIcon fontSize="inherit" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        <Tooltip title={task.status === 'obsolete' ? 'Kích hoạt lại task' : 'Đánh dấu hủy/obsolete'}>
                                          <IconButton
                                            size="small"
                                            color="action"
                                            onClick={() => handleToggleObsolete(task)}
                                          >
                                            <BlockIcon fontSize="inherit" />
                                          </IconButton>
                                        </Tooltip>
                                        {task.progress === 0 && (
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => {
                                              if (confirm('Xác nhận xóa công việc này?')) deleteTask(task.id);
                                            }}
                                          >
                                            <DeleteIcon fontSize="inherit" />
                                          </IconButton>
                                        )}
                                      </>
                                    )}

                                    {!isTPKT && (
                                      <Tooltip title="Xem lịch sử thay đổi">
                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            setSelectedTask(task);
                                            alert(`Chi tiết task: ${task.name}\nTiến độ: ${task.progress}%\nLịch sử gia hạn: ${JSON.stringify(task.delayLog || [])}\nLịch sử sự cố: ${JSON.stringify(task.incidentLog || [])}`);
                                          }}
                                        >
                                          <InfoIcon fontSize="inherit" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* TAB 2: ĐỊNH MỨC VẬT TƯ (QUOTA) */}
      {tabValue === 1 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              Bảng định mức vật tư tối đa dự án
            </Typography>
            {isTPKT && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenQuotaDialog(true)}>
                Khai báo định mức vật tư
              </Button>
            )}
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã vật tư</TableCell>
                  <TableCell>Tên vật tư</TableCell>
                  <TableCell align="right">Định mức Quota</TableCell>
                  <TableCell align="right">Đã xuất dùng</TableCell>
                  <TableCell align="right">Tồn kho hiện tại</TableCell>
                  <TableCell>Trạng thái kiểm soát</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {MATERIALS.map((mat) => {
                  const invItem = inventory.find((item) => item.projectId === projectId && item.materialId === mat.id);
                  const quota = invItem ? invItem.quota : mat.defaultQuota;
                  const inStock = invItem ? invItem.inStock : 0;
                  
                  // Tính tổng lượng đã sử dụng (đã xuất dùng) từ transaction.
                  const used = invItem ? invItem.quota - invItem.inStock : 0; // Dự phòng
                  const isOver = used > quota;

                  return (
                    <TableRow key={mat.id} hover>
                      <TableCell>{mat.id}</TableCell>
                      <TableCell fontWeight="bold">{mat.name}</TableCell>
                      <TableCell align="right">
                        {quota} {mat.unit}
                      </TableCell>
                      <TableCell align="right">
                        {Math.max(0, used)} {mat.unit}
                      </TableCell>
                      <TableCell align="right">
                        {inStock} {mat.unit}
                      </TableCell>
                      <TableCell>
                        {isOver ? (
                          <Chip label="Vượt định mức" color="error" size="small" />
                        ) : (
                          <Chip label="Trong định mức" color="success" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* DIALOG THÊM/SỬA PHASE */}
      <Dialog open={openPhaseDialog} onClose={() => setOpenPhaseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedPhase ? 'Sửa giai đoạn (Phase)' : 'Thêm giai đoạn mới'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Tên giai đoạn"
              fullWidth
              required
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Ngày bắt đầu"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={phaseStartDate}
                onChange={(e) => setPhaseStartDate(e.target.value)}
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={phaseEndDate}
                onChange={(e) => setPhaseEndDate(e.target.value)}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPhaseDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSavePhase}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG THÊM/SỬA TASK */}
      <Dialog open={openTaskDialog} onClose={() => setOpenTaskDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedTask ? 'Sửa công việc' : 'Thêm công việc mới'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Tên công việc"
              fullWidth
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
            <TextField
              label="Mô tả công việc"
              fullWidth
              multiline
              rows={2}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Ngày bắt đầu"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={taskStartDate}
                onChange={(e) => setTaskStartDate(e.target.value)}
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={taskEndDate}
                onChange={(e) => setTaskEndDate(e.target.value)}
              />
            </Box>
            <TextField
              select
              label="Kỹ sư hiện trường phụ trách"
              fullWidth
              required
              value={taskAssigneeId}
              onChange={(e) => setTaskAssigneeId(e.target.value)}
            >
              {engineers.map((eng) => (
                <MenuItem key={eng.id} value={eng.id}>
                  {eng.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTaskDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveTask}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG BÁO CÁO SỰ CỐ & GIẢM TIẾN ĐỘ */}
      <Dialog open={openIncidentDialog} onClose={() => setOpenIncidentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Báo cáo sự cố & giảm tiến độ - {selectedTask?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Alert severity="error">
              Hành động này sẽ làm giảm tiến độ của công việc xuống. Bạn cần cung cấp lý do cụ thể và báo cáo này sẽ được gửi lên Giám đốc.
            </Alert>
            <TextField
              label="Tiến độ giảm về (%)"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0, max: (selectedTask?.progress || 100) - 1 }}
              value={incidentProgress}
              onChange={(e) => setIncidentProgress(Math.min(parseInt(e.target.value) || 0, (selectedTask?.progress || 100) - 1))}
            />
            <TextField
              label="Mô tả sự cố & Lý do giảm tiến độ"
              multiline
              rows={3}
              fullWidth
              required
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
              placeholder="ví dụ: Sự cố lún móng sau mưa lớn, cần tháo dỡ gia cố lại dầm chính..."
            />
            <TextField
              label="Hạn chót mới sau điều chỉnh (Gia hạn nếu cần)"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={incidentDeadline}
              onChange={(e) => setIncidentDeadline(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenIncidentDialog(false)}>Hủy</Button>
          <Button variant="contained" color="error" onClick={handleSaveIncident}>
            Lưu & Quyết định giảm tiến độ
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG ĐIỀU CHỈNH DEADLINE */}
      <Dialog open={openDelayDialog} onClose={() => setOpenDelayDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Gia hạn thời hạn hoàn thành (Delay)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Ngày hạn chót mới"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={delayNewDeadline}
              onChange={(e) => setDelayNewDeadline(e.target.value)}
            />
            <TextField
              label="Lý do chậm trễ / Gia hạn"
              multiline
              rows={3}
              fullWidth
              required
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelayDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveDelay}>
            Xác nhận gia hạn
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG NGHIỆM THU PHASE */}
      <Dialog open={openAcceptanceDialog} onClose={() => setOpenAcceptanceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nghiệm thu giai đoạn - {selectedPhase?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Các công việc thuộc giai đoạn này đã hoàn thành 100%. Vui lòng điền nội dung nghiệm thu thực tế (Tối thiểu 50 ký tự) để xuất biên bản.
            </Typography>

            <List>
              {selectedPhase && getPhaseTasks(selectedPhase.id).map((t) => (
                <ListItem key={t.id} dense>
                  <ListItemText
                    primary={t.name}
                    secondary={`Kỹ sư phụ trách: ${t.assigneeName} | Tiến độ: 100%`}
                  />
                  <Chip label="Đạt yêu cầu" color="success" size="small" />
                </ListItem>
              ))}
            </List>

            <TextField
              label="Báo cáo nghiệm thu chi tiết"
              multiline
              rows={4}
              fullWidth
              required
              value={acceptanceReport}
              onChange={(e) => setAcceptanceReport(e.target.value)}
              placeholder="Nhập tối thiểu 50 ký tự mô tả kết quả kiểm tra chất lượng tại công trường..."
              helperText={`Đã nhập: ${acceptanceReport.length} ký tự`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAcceptanceDialog(false)}>Hủy</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmAcceptance}
            disabled={acceptanceReport.length < 50}
          >
            Ký duyệt & Nghiệm thu
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG HỦY NGHIỆM THU */}
      <Dialog open={openCancelAcceptanceDialog} onClose={() => setOpenCancelAcceptanceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Hủy nghiệm thu giai đoạn - {selectedPhase?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Alert severity="warning">
              Hành động này sẽ chuyển trạng thái của Phase về đang thi công và mở khóa các công việc liên quan.
            </Alert>
            <TextField
              label="Lý do hủy nghiệm thu"
              multiline
              rows={3}
              fullWidth
              required
              value={cancelAcceptanceReason}
              onChange={(e) => setCancelAcceptanceReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelAcceptanceDialog(false)}>Hủy</Button>
          <Button variant="contained" color="warning" onClick={handleConfirmCancelAcceptance}>
            Xác nhận hủy
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG KHAI BÁO ĐỊNH MỨC QUOTA */}
      <Dialog open={openQuotaDialog} onClose={() => setOpenQuotaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Khai báo định mức vật tư cho dự án</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Chọn vật tư"
              fullWidth
              required
              value={quotaMaterialId}
              onChange={(e) => setQuotaMaterialId(e.target.value)}
            >
              {MATERIALS.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Định mức Quota tối đa"
              type="number"
              fullWidth
              required
              value={quotaQuantity}
              onChange={(e) => setQuotaQuantity(parseInt(e.target.value) || 0)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenQuotaDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveQuota}>
            Xác nhận định mức
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
