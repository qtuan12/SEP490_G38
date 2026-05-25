import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  LocalShipping as LocalShippingIcon,
  Payment as PaymentIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useApp, MATERIALS } from '@/context/AppContext';

const PHASES = [
  { id: 'PHASE001', name: 'Phase 1: Móng' },
  { id: 'PHASE002', name: 'Phase 2: Thô tầng 1' },
  { id: 'PHASE003', name: 'Phase 3: Hoàn thiện' },
];

export default function MaterialControl() {
  const {
    projects,
    materialRequests,
    addMaterialRequest,
    updateMaterialRequestStatus,
    excessProposals,
    addExcessProposal,
    updateExcessProposal,
    inventoryAdjustments,
    addInventoryAdjustment,
    updateInventoryAdjustment,
    inventory,
    currentUser,
  } = useApp();

  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // Dialogs
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [openExcessDialog, setOpenExcessDialog] = useState(false);
  const [openAdjustmentDialog, setOpenAdjustmentDialog] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedExcess, setSelectedExcess] = useState<any>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; type: 'req' | 'exc' | 'adj'; id: string | null }>({
    open: false,
    type: 'req',
    id: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');

  const [accountantNoteDialog, setAccountantNoteDialog] = useState<{ open: boolean; type: 'req' | 'exc' | 'adj'; item: any | null }>({
    open: false,
    type: 'req',
    item: null,
  });
  const [accountantNote, setAccountantNote] = useState('');

  const [refundDialog, setRefundDialog] = useState<{ open: boolean; item: any | null }>({
    open: false,
    item: null,
  });
  const [refundAmount, setRefundAmount] = useState(0);

  // Form states
  // Form 1: Yêu cầu mua
  const [reqProjectId, setReqProjectId] = useState('');
  const [reqPhaseId, setReqPhaseId] = useState('');
  const [reqMaterialId, setReqMaterialId] = useState('');
  const [reqQuantity, setReqQuantity] = useState(0);
  const [reqReason, setReqReason] = useState('');

  // Form 2: Xử lý vật tư thừa
  const [excProjectId, setExcProjectId] = useState('');
  const [excMaterialId, setExcMaterialId] = useState('');
  const [excQuantity, setExcQuantity] = useState(0);
  const [excType, setExcType] = useState<'return-ncc' | 'transfer-project'>('return-ncc');
  const [excDestProjectId, setExcDestProjectId] = useState('');
  const [excReason, setExcReason] = useState('');

  // Form 3: Điều chỉnh giảm tồn đặc biệt
  const [adjProjectId, setAdjProjectId] = useState('');
  const [adjMaterialId, setAdjMaterialId] = useState('');
  const [adjQuantity, setAdjQuantity] = useState(0);
  const [adjType, setAdjType] = useState<'wastage' | 'theft' | 'wrong-execution' | 'shortage'>('wastage');
  const [adjIncidentId, setAdjIncidentId] = useState('');
  const [adjDescription, setAdjDescription] = useState('');

  const isEngineer = currentUser.role === 'Kỹ sư';
  const isTPKT = currentUser.role === 'TPKT';
  const isAccountant = currentUser.role === 'Kế toán';
  const isDirector = currentUser.role === 'Giám đốc';

  const calculateUsageInfo = (materialId: string, projectId: string) => {
    const relatedRequests = materialRequests.filter(
      (r) => r.materialId === materialId && r.projectId === projectId && r.status === 'approved'
    );
    const used = relatedRequests.reduce((sum, r) => sum + r.quantity, 0);
    const material = MATERIALS.find((m) => m.id === materialId);
    const quota = material?.defaultQuota || 0;
    return { used, quota };
  };

  // Nộp form yêu cầu mua vật tư
  const handleSubmitRequest = () => {
    if (!reqProjectId || !reqPhaseId || !reqMaterialId || reqQuantity <= 0 || !reqReason) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    const project = projects.find((p) => p.id === reqProjectId);
    const material = MATERIALS.find((m) => m.id === reqMaterialId);
    const phase = PHASES.find((p) => p.id === reqPhaseId);

    if (!project || !material || !phase) return;

    const { used, quota } = calculateUsageInfo(reqMaterialId, reqProjectId);
    const newTotal = used + reqQuantity;
    const isOverQuota = newTotal > quota;

    addMaterialRequest({
      projectId: reqProjectId,
      project: project.name,
      materialId: reqMaterialId,
      material: material.name,
      phaseId: reqPhaseId,
      phase: phase.name,
      quantity: reqQuantity,
      unit: material.unit,
      quota,
      used,
      isOverQuota,
      reason: reqReason,
      requesterId: currentUser.id,
      requester: currentUser.name,
    });

    setSnackbar({ open: true, message: 'Tạo yêu cầu vật tư thành công!' });
    setOpenRequestDialog(false);
  };

  // Nộp form xử lý vật tư thừa
  const handleSubmitExcess = () => {
    if (!excProjectId || !excMaterialId || excQuantity <= 0 || !excReason) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    if (excType === 'transfer-project' && !excDestProjectId) {
      setSnackbar({ open: true, message: 'Vui lòng chọn dự án đích!' });
      return;
    }

    const project = projects.find((p) => p.id === excProjectId);
    const material = MATERIALS.find((m) => m.id === excMaterialId);
    const destProject = projects.find((p) => p.id === excDestProjectId);

    if (!project || !material) return;

    // Kiểm tra tồn kho thực tế
    const invItem = inventory.find((item) => item.projectId === excProjectId && item.materialId === excMaterialId);
    if (!invItem || invItem.inStock < excQuantity) {
      setSnackbar({ open: true, message: 'Số lượng vật tư thừa vượt quá lượng tồn kho thực tế!' });
      return;
    }

    addExcessProposal({
      projectId: excProjectId,
      project: project.name,
      materialId: excMaterialId,
      material: material.name,
      quantity: excQuantity,
      unit: material.unit,
      type: excType,
      destProjectId: excType === 'transfer-project' ? excDestProjectId : undefined,
      destProjectName: excType === 'transfer-project' ? destProject?.name : undefined,
      reason: excReason,
      proposerId: currentUser.id,
      proposerName: currentUser.name,
    });

    setSnackbar({ open: true, message: 'Gửi đề xuất xử lý vật tư thừa thành công!' });
    setOpenExcessDialog(false);
  };

  // Nộp form điều chỉnh giảm tồn đặc biệt
  const handleSubmitAdjustment = () => {
    if (!adjProjectId || !adjMaterialId || adjQuantity <= 0 || !adjDescription) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    if (adjType === 'wrong-execution' && !adjIncidentId) {
      setSnackbar({ open: true, message: 'Thi công sai bắt buộc phải nhập ID Báo cáo sự cố!' });
      return;
    }

    const project = projects.find((p) => p.id === adjProjectId);
    const material = MATERIALS.find((m) => m.id === adjMaterialId);

    if (!project || !material) return;

    // Kiểm tra tồn kho thực tế
    const invItem = inventory.find((item) => item.projectId === adjProjectId && item.materialId === adjMaterialId);
    if (!invItem || invItem.inStock < adjQuantity) {
      setSnackbar({ open: true, message: 'Số lượng điều chỉnh giảm vượt quá lượng tồn kho thực tế!' });
      return;
    }

    addInventoryAdjustment({
      projectId: adjProjectId,
      project: project.name,
      materialId: adjMaterialId,
      material: material.name,
      quantity: adjQuantity,
      unit: material.unit,
      type: adjType,
      incidentId: adjType === 'wrong-execution' ? adjIncidentId : undefined,
      description: adjDescription,
      proposerId: currentUser.id,
      proposerName: currentUser.name,
    });

    setSnackbar({ open: true, message: 'Gửi phiếu điều chỉnh tồn kho thành công!' });
    setOpenAdjustmentDialog(false);
  };

  // Luồng duyệt 3 bước: Kế toán kiểm tra & ghi chú
  const handleOpenAccountantNote = (type: 'req' | 'exc' | 'adj', item: any) => {
    setAccountantNote('');
    setAccountantNoteDialog({ open: true, type, item });
  };

  const handleAccountantSubmit = () => {
    const { type, item } = accountantNoteDialog;
    if (!item) return;

    if (type === 'req') {
      // Yêu cầu mua: Nếu trong định mức, Kế toán kiểm tra OK tự động Duyệt (approved). Nếu vượt định mức, trình Giám đốc duyệt (director-review).
      const status: any = item.isOverQuota ? 'director-review' : 'approved';
      updateMaterialRequestStatus(item.id, status);
      // Ghi chú của kế toán
      item.rejectionReason = accountantNote ? `KT ghi chú: ${accountantNote}` : undefined;
      setSnackbar({ open: true, message: status === 'approved' ? 'Yêu cầu trong định mức, đã tự động duyệt!' : 'Đã chuyển yêu cầu lên Giám đốc duyệt!' });
    } else if (type === 'exc') {
      updateExcessProposal(item.id, {
        status: 'approved', // Trong MVP cho phép trình duyệt tự động chuyển sang approved hoặc Giám đốc duyệt.
        accountantNote: accountantNote,
      });
      setSnackbar({ open: true, message: 'Kế toán đã kiểm tra và trình đề xuất thừa!' });
    } else if (type === 'adj') {
      updateInventoryAdjustment(item.id, {
        status: 'accountant-checked',
        accountantNote: accountantNote,
      });
      setSnackbar({ open: true, message: 'Kế toán đã kiểm tra và trình phiếu điều chỉnh giảm tồn!' });
    }

    setAccountantNoteDialog({ open: false, type: 'req', item: null });
  };

  // Giám đốc duyệt
  const handleDirectorApprove = (type: 'req' | 'exc' | 'adj', id: string) => {
    if (type === 'req') {
      updateMaterialRequestStatus(id, 'approved');
      setSnackbar({ open: true, message: 'Giám đốc đã duyệt yêu cầu mua vật tư!' });
    } else if (type === 'exc') {
      updateExcessProposal(id, { status: 'approved' });
      setSnackbar({ open: true, message: 'Giám đốc đã phê duyệt phiếu xử lý thừa!' });
    } else if (type === 'adj') {
      // update status sang approved sẽ tự trừ kho và hoàn tất trong Context
      updateInventoryAdjustment(id, { status: 'approved' });
      setSnackbar({ open: true, message: 'Giám đốc đã phê duyệt phiếu điều chỉnh tồn đặc biệt!' });
    }
  };

  // Từ chối (Rejection)
  const handleOpenReject = (type: 'req' | 'exc' | 'adj', id: string) => {
    setRejectionReason('');
    setRejectDialog({ open: true, type, id });
  };

  const handleConfirmReject = () => {
    const { type, id } = rejectDialog;
    if (!id || !rejectionReason.trim()) return;

    if (type === 'req') {
      updateMaterialRequestStatus(id, 'rejected', rejectionReason);
    } else if (type === 'exc') {
      updateExcessProposal(id, { status: 'rejected', rejectionReason });
    } else if (type === 'adj') {
      updateInventoryAdjustment(id, { status: 'rejected', rejectionReason });
    }

    setSnackbar({ open: true, message: 'Đã từ chối phiếu yêu cầu!' });
    setRejectDialog({ open: false, type: 'req', id: null });
  };

  // Kế toán xác nhận nhận tiền Trả NCC
  const handleOpenRefund = (item: any) => {
    setRefundAmount(item.quantity * 80000); // Giả định giá
    setRefundDialog({ open: true, item });
  };

  const handleConfirmRefund = () => {
    const { item } = refundDialog;
    if (!item) return;

    updateExcessProposal(item.id, {
      status: 'completed',
      refundAmount: refundAmount,
    });

    setSnackbar({ open: true, message: 'Xác nhận trả NCC và hoàn lại tiền thành công!' });
    setRefundDialog({ open: false, item: null });
  };

  // Kỹ sư xác nhận Giao/Nhận chuyển kho
  const handleConfirmDispatch = (id: string) => {
    updateExcessProposal(id, { isDispatched: true });
    setSnackbar({ open: true, message: 'Xác nhận đã xuất kho chuyển hàng đi!' });
  };

  const handleConfirmReceive = (id: string) => {
    updateExcessProposal(id, { isReceived: true });
    setSnackbar({ open: true, message: 'Xác nhận đã nhận hàng chuyển đến công trình!' });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Chờ Kế toán soát';
      case 'pending':
        return 'Chờ Kế toán soát';
      case 'accountant-review':
        return 'Kế toán đã duyệt';
      case 'accountant-checked':
        return 'Chờ Giám đốc duyệt';
      case 'director-review':
        return 'Chờ Giám đốc duyệt';
      case 'approved':
        return 'Đã phê duyệt';
      case 'rejected':
        return 'Đã từ chối';
      case 'completed':
        return 'Đã hoàn thành';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'info';
      case 'completed':
        return 'success';
      case 'rejected':
        return 'error';
      case 'director-review':
      case 'accountant-checked':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Kiểm soát vật tư & Phê duyệt
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(isEngineer || isTPKT) && tabValue === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenRequestDialog(true)}>
              Tạo yêu cầu vật tư
            </Button>
          )}
          {(isEngineer || isTPKT) && tabValue === 1 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenExcessDialog(true)}>
              Đề xuất xử lý vật tư thừa
            </Button>
          )}
          {(isEngineer || isAccountant) && tabValue === 2 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAdjustmentDialog(true)}>
              Phiếu điều chỉnh giảm kho
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, nv) => setTabValue(nv)}>
          <Tab label="Yêu cầu mua vật tư" />
          <Tab label="Xử lý vật tư thừa" />
          <Tab label="Điều chỉnh tồn đặc biệt" />
        </Tabs>
      </Paper>

      {/* TAB 0: YÊU CẦU MUA VẬT TƯ */}
      {tabValue === 0 && (
        <Paper sx={{ p: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã YC</TableCell>
                  <TableCell>Dự án</TableCell>
                  <TableCell>Vật tư</TableCell>
                  <TableCell align="right">SL yêu cầu</TableCell>
                  <TableCell align="right">Định mức</TableCell>
                  <TableCell align="right">Đã dùng</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Người yêu cầu</TableCell>
                  <TableCell align="center">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materialRequests.map((request) => (
                  <TableRow
                    key={request.id}
                    hover
                    sx={{ backgroundColor: request.isOverQuota ? '#fff3e0' : 'inherit' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {request.isOverQuota && <WarningIcon color="error" fontSize="small" />}
                        {request.id}
                      </Box>
                    </TableCell>
                    <TableCell>{request.project}</TableCell>
                    <TableCell fontWeight="bold">{request.material}</TableCell>
                    <TableCell align="right">
                      {request.quantity} {request.unit}
                    </TableCell>
                    <TableCell align="right">
                      {request.quota} {request.unit}
                    </TableCell>
                    <TableCell align="right">
                      {request.used} {request.unit}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(request.status)}
                        color={getStatusColor(request.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{request.requester}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {request.requestDate}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="primary" onClick={() => setSelectedRequest(request)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>

                        {/* Quyền kiểm tra của Kế toán */}
                        {isAccountant && (request.status === 'pending' || request.status === 'submitted') && (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              onClick={() => handleOpenAccountantNote('req', request)}
                            >
                              Soát & Trình
                            </Button>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('req', request.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}

                        {/* Quyền duyệt của Giám đốc (Duyệt vượt định mức) */}
                        {isDirector && request.status === 'director-review' && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleDirectorApprove('req', request.id)}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('req', request.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB 1: XỬ LÝ VẬT TƯ THỪA */}
      {tabValue === 1 && (
        <Paper sx={{ p: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã đề xuất</TableCell>
                  <TableCell>Dự án nguồn</TableCell>
                  <TableCell>Vật tư</TableCell>
                  <TableCell align="right">Số lượng thừa</TableCell>
                  <TableCell>Phương án xử lý</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Giao / Nhận</TableCell>
                  <TableCell align="center">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {excessProposals.map((prop) => (
                  <TableRow key={prop.id} hover>
                    <TableCell>{prop.id}</TableCell>
                    <TableCell>{prop.project}</TableCell>
                    <TableCell fontWeight="bold">{prop.material}</TableCell>
                    <TableCell align="right">
                      {prop.quantity} {prop.unit}
                    </TableCell>
                    <TableCell>
                      {prop.type === 'return-ncc' ? (
                        <Chip label="Trả lại NCC" color="secondary" size="small" />
                      ) : (
                        <Box>
                          <Chip label="Chuyển công trình" color="primary" size="small" />
                          <Typography variant="caption" display="block" color="text.secondary">
                            Đến: {prop.destProjectName}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(prop.status)}
                        color={getStatusColor(prop.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {prop.type === 'transfer-project' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip
                            label={prop.isDispatched ? 'Đã xuất' : 'Chưa xuất'}
                            color={prop.isDispatched ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={prop.isReceived ? 'Đã nhận' : 'Chưa nhận'}
                            color={prop.isReceived ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}
                      {prop.type === 'return-ncc' && prop.status === 'completed' && (
                        <Typography variant="caption" color="success.main" fontWeight="bold">
                          Hoàn tiền: {prop.refundAmount?.toLocaleString()}đ
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="primary" onClick={() => setSelectedExcess(prop)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>

                        {/* Kế toán kiểm soát */}
                        {isAccountant && prop.status === 'submitted' && (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              onClick={() => handleOpenAccountantNote('exc', prop)}
                            >
                              Soát & Trình
                            </Button>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('exc', prop.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}

                        {/* Giám đốc duyệt đề xuất thừa */}
                        {isDirector && prop.status === 'approved' && prop.type === 'return-ncc' && (
                          <Typography variant="caption" color="text.secondary">
                            Chờ Kế toán hoàn tiền
                          </Typography>
                        )}
                        {isDirector && prop.status === 'submitted' && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleDirectorApprove('exc', prop.id)}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('exc', prop.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}

                        {/* Kế toán hoàn tất nhận tiền NCC */}
                        {isAccountant && prop.status === 'approved' && prop.type === 'return-ncc' && (
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<PaymentIcon />}
                            onClick={() => handleOpenRefund(prop)}
                          >
                            Xác nhận hoàn tiền
                          </Button>
                        )}

                        {/* Kỹ sư xác nhận giao nhận Chuyển kho */}
                        {isEngineer && prop.status === 'approved' && prop.type === 'transfer-project' && (
                          <>
                            {!prop.isDispatched && prop.proposerId === currentUser.id && (
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<LocalShippingIcon />}
                                onClick={() => handleConfirmDispatch(prop.id)}
                              >
                                Xác nhận xuất
                              </Button>
                            )}
                            {prop.isDispatched && !prop.isReceived && currentUser.id !== prop.proposerId && (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleConfirmReceive(prop.id)}
                              >
                                Xác nhận nhận
                              </Button>
                            )}
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* TAB 2: ĐIỀU CHỈNH TỒN KHO ĐẶC BIỆT */}
      {tabValue === 2 && (
        <Paper sx={{ p: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã điều chỉnh</TableCell>
                  <TableCell>Dự án</TableCell>
                  <TableCell>Vật tư</TableCell>
                  <TableCell align="right">SL điều chỉnh giảm</TableCell>
                  <TableCell>Loại lý do</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Người đề xuất</TableCell>
                  <TableCell align="center">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryAdjustments.map((adj) => (
                  <TableRow key={adj.id} hover>
                    <TableCell>{adj.id}</TableCell>
                    <TableCell>{adj.project}</TableCell>
                    <TableCell fontWeight="bold">{adj.material}</TableCell>
                    <TableCell align="right" style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                      -{adj.quantity} {adj.unit}
                    </TableCell>
                    <TableCell>
                      {adj.type === 'wastage' && <Chip label="Hao hụt tự nhiên" color="warning" size="small" />}
                      {adj.type === 'theft' && <Chip label="Mất mát/Mất trộm" color="error" size="small" />}
                      {adj.type === 'wrong-execution' && (
                        <Box>
                          <Chip label="Thi công sai" color="error" size="small" variant="outlined" />
                          <Typography variant="caption" display="block" color="text.secondary">
                            Sự cố ID: {adj.incidentId}
                          </Typography>
                        </Box>
                      )}
                      {adj.type === 'shortage' && <Chip label="Kiểm kê thiếu" color="info" size="small" />}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(adj.status)}
                        color={getStatusColor(adj.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{adj.proposerName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {adj.requestDate}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="primary" onClick={() => setSelectedAdjustment(adj)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>

                        {/* Kế toán kiểm soát */}
                        {isAccountant && adj.status === 'submitted' && (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              onClick={() => handleOpenAccountantNote('adj', adj)}
                            >
                              Soát & Trình
                            </Button>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('adj', adj.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}

                        {/* Giám đốc phê duyệt điều chỉnh */}
                        {isDirector && adj.status === 'accountant-checked' && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleDirectorApprove('adj', adj.id)}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleOpenReject('adj', adj.id)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ========================================================================= */}
      {/* FORM DIALOGS */}

      {/* FORM 1: YÊU CẦU MUA VẬT TƯ */}
      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo yêu cầu mua vật tư mới</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Dự án"
              fullWidth
              required
              value={reqProjectId}
              onChange={(e) => setReqProjectId(e.target.value)}
            >
              {projects.filter((p) => p.status === 'active').map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Phase"
              fullWidth
              required
              value={reqPhaseId}
              onChange={(e) => setReqPhaseId(e.target.value)}
            >
              {PHASES.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Vật tư"
              fullWidth
              required
              value={reqMaterialId}
              onChange={(e) => setReqMaterialId(e.target.value)}
            >
              {MATERIALS.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Số lượng đặt mua"
              type="number"
              fullWidth
              required
              value={reqQuantity || ''}
              onChange={(e) => setReqQuantity(parseFloat(e.target.value) || 0)}
            />
            {reqMaterialId && reqProjectId && (
              <Alert severity="info">
                Định mức tối đa: {calculateUsageInfo(reqMaterialId, reqProjectId).quota} | Đã dùng:{' '}
                {calculateUsageInfo(reqMaterialId, reqProjectId).used}
              </Alert>
            )}
            <TextField
              label="Lý do yêu cầu chi tiết"
              multiline
              rows={3}
              fullWidth
              required
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmitRequest}>
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </Dialog>

      {/* FORM 2: ĐỀ XUẤT VẬT TƯ THỪA */}
      <Dialog open={openExcessDialog} onClose={() => setOpenExcessDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo phiếu đề xuất xử lý vật tư thừa</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Dự án phát sinh hàng thừa"
              fullWidth
              required
              value={excProjectId}
              onChange={(e) => setExcProjectId(e.target.value)}
            >
              {projects.filter((p) => p.status === 'active').map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Chọn vật tư thừa"
              fullWidth
              required
              value={excMaterialId}
              onChange={(e) => setExcMaterialId(e.target.value)}
              disabled={!excProjectId}
            >
              {inventory
                .filter((item) => item.projectId === excProjectId && item.inStock > 0)
                .map((item) => (
                  <MenuItem key={item.materialId} value={item.materialId}>
                    {item.material} (Tồn: {item.inStock} {item.unit})
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Số lượng thừa muốn xử lý"
              type="number"
              fullWidth
              required
              value={excQuantity || ''}
              onChange={(e) => setExcQuantity(parseFloat(e.target.value) || 0)}
            />

            <TextField
              select
              label="Phương án xử lý"
              fullWidth
              required
              value={excType}
              onChange={(e: any) => setExcType(e.target.value)}
            >
              <MenuItem value="return-ncc">Trả lại cho Nhà cung cấp (Hoàn tiền)</MenuItem>
              <MenuItem value="transfer-project">Chuyển sang công trình khác</MenuItem>
            </TextField>

            {excType === 'transfer-project' && (
              <TextField
                select
                label="Dự án đích nhận hàng"
                fullWidth
                required
                value={excDestProjectId}
                onChange={(e) => setExcDestProjectId(e.target.value)}
              >
                {projects
                  .filter((p) => p.status === 'active' && p.id !== excProjectId)
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
              </TextField>
            )}

            <TextField
              label="Lý do xử lý thừa (Bắt buộc)"
              multiline
              rows={3}
              fullWidth
              required
              value={excReason}
              onChange={(e) => setExcReason(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExcessDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmitExcess}>
            Gửi đề xuất
          </Button>
        </DialogActions>
      </Dialog>

      {/* FORM 3: ĐIỀU CHỈNH GIẢM TỒN KHO ĐẶC BIỆT */}
      <Dialog open={openAdjustmentDialog} onClose={() => setOpenAdjustmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Đề xuất điều chỉnh giảm tồn đặc biệt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Dự án"
              fullWidth
              required
              value={adjProjectId}
              onChange={(e) => setAdjProjectId(e.target.value)}
            >
              {projects.filter((p) => p.status === 'active').map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Chọn vật tư bị thất thoát/hao hụt"
              fullWidth
              required
              value={adjMaterialId}
              onChange={(e) => setAdjMaterialId(e.target.value)}
              disabled={!adjProjectId}
            >
              {inventory
                .filter((item) => item.projectId === adjProjectId && item.inStock > 0)
                .map((item) => (
                  <MenuItem key={item.materialId} value={item.materialId}>
                    {item.material} (Tồn: {item.inStock} {item.unit})
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Số lượng hao hụt"
              type="number"
              fullWidth
              required
              value={adjQuantity || ''}
              onChange={(e) => setAdjQuantity(parseFloat(e.target.value) || 0)}
            />

            <TextField
              select
              label="Lý do giảm kho"
              fullWidth
              required
              value={adjType}
              onChange={(e: any) => setAdjType(e.target.value)}
            >
              <MenuItem value="wastage">Hao hụt tự nhiên (Ẩm mốc, rơi vãi)</MenuItem>
              <MenuItem value="theft">Mất mát/Bị trộm cắp</MenuItem>
              <MenuItem value="wrong-execution">Hư hỏng do thi công sai (Đập bỏ làm lại)</MenuItem>
              {isAccountant && <MenuItem value="shortage">Kiểm kê cuối kỳ phát hiện thiếu</MenuItem>}
            </TextField>

            {adjType === 'wrong-execution' && (
              <TextField
                label="Mã biên bản sự cố / Quyết định điều chỉnh (%)"
                fullWidth
                required
                value={adjIncidentId}
                onChange={(e) => setAdjIncidentId(e.target.value)}
                placeholder="ví dụ: INCIDENT-TASK005"
              />
            )}

            <TextField
              label="Mô tả sự việc chi tiết & Giải trình"
              multiline
              rows={3}
              fullWidth
              required
              value={adjDescription}
              onChange={(e) => setAdjDescription(e.target.value)}
              placeholder="ví dụ: Mưa to ngập lán kho làm hỏng xi măng, có đính kèm ảnh..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdjustmentDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmitAdjustment}>
            Gửi đề xuất giảm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* WORKFLOW DETAILED VIEW DIALOGS */}

      {/* XEM CHI TIẾT YÊU CẦU MUA */}
      <Dialog open={selectedRequest !== null} onClose={() => setSelectedRequest(null)} maxWidth="sm" fullWidth>
        {selectedRequest && (
          <>
            <DialogTitle>Chi tiết yêu cầu mua vật tư - {selectedRequest.id}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Typography><strong>Dự án:</strong> {selectedRequest.project}</Typography>
                <Typography><strong>Vật tư:</strong> {selectedRequest.material}</Typography>
                <Typography><strong>Số lượng:</strong> {selectedRequest.quantity} {selectedRequest.unit}</Typography>
                <Typography><strong>Định mức dự án:</strong> {selectedRequest.quota} {selectedRequest.unit}</Typography>
                <Typography>
                  <strong>Trạng thái định mức:</strong>{' '}
                  {selectedRequest.isOverQuota ? (
                    <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>VƯỢT ĐỊNH MỨC</span>
                  ) : (
                    <span>Trong định mức</span>
                  )}
                </Typography>
                <Typography><strong>Lý do yêu cầu:</strong> {selectedRequest.reason}</Typography>
                {selectedRequest.rejectionReason && (
                  <Alert severity="error"><strong>Lý do từ chối:</strong> {selectedRequest.rejectionReason}</Alert>
                )}
                <Divider />
                <Typography><strong>Người yêu cầu:</strong> {selectedRequest.requester} ({selectedRequest.requestDate})</Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedRequest(null)}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* XEM CHI TIẾT PHIẾU THỪA */}
      <Dialog open={selectedExcess !== null} onClose={() => setSelectedExcess(null)} maxWidth="sm" fullWidth>
        {selectedExcess && (
          <>
            <DialogTitle>Chi tiết phiếu xử lý vật tư thừa - {selectedExcess.id}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Typography><strong>Dự án nguồn:</strong> {selectedExcess.project}</Typography>
                <Typography><strong>Vật tư:</strong> {selectedExcess.material}</Typography>
                <Typography><strong>Số lượng:</strong> {selectedExcess.quantity} {selectedExcess.unit}</Typography>
                <Typography><strong>Phương án:</strong> {selectedExcess.type === 'return-ncc' ? 'Trả lại NCC' : `Chuyển sang ${selectedExcess.destProjectName}`}</Typography>
                <Typography><strong>Lý do dư thừa:</strong> {selectedExcess.reason}</Typography>
                {selectedExcess.accountantNote && (
                  <Typography><strong>Ghi chú của Kế toán:</strong> {selectedExcess.accountantNote}</Typography>
                )}
                {selectedExcess.rejectionReason && (
                  <Alert severity="error"><strong>Lý do từ chối:</strong> {selectedExcess.rejectionReason}</Alert>
                )}
                <Divider />
                <Typography><strong>Người đề xuất:</strong> {selectedExcess.proposerName} ({selectedExcess.requestDate})</Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedExcess(null)}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* XEM CHI TIẾT ĐIỀU CHỈNH GIẢM TỒN */}
      <Dialog open={selectedAdjustment !== null} onClose={() => setSelectedAdjustment(null)} maxWidth="sm" fullWidth>
        {selectedAdjustment && (
          <>
            <DialogTitle>Chi tiết phiếu điều chỉnh giảm tồn đặc biệt - {selectedAdjustment.id}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Typography><strong>Dự án:</strong> {selectedAdjustment.project}</Typography>
                <Typography><strong>Vật tư:</strong> {selectedAdjustment.material}</Typography>
                <Typography><strong>Số lượng giảm:</strong> -{selectedAdjustment.quantity} {selectedAdjustment.unit}</Typography>
                <Typography>
                  <strong>Lý do điều chỉnh:</strong>{' '}
                  {selectedAdjustment.type === 'wastage' && 'Hao hụt tự nhiên'}
                  {selectedAdjustment.type === 'theft' && 'Mất mát / Mất trộm'}
                  {selectedAdjustment.type === 'wrong-execution' && `Thi công sai (ID sự cố: ${selectedAdjustment.incidentId})`}
                  {selectedAdjustment.type === 'shortage' && 'Kiểm kê cuối kỳ phát hiện thiếu'}
                </Typography>
                <Typography><strong>Giải trình chi tiết:</strong> {selectedAdjustment.description}</Typography>
                {selectedAdjustment.accountantNote && (
                  <Typography><strong>Ý kiến Kế toán soát:</strong> {selectedAdjustment.accountantNote}</Typography>
                )}
                {selectedAdjustment.rejectionReason && (
                  <Alert severity="error"><strong>Lý do từ chối:</strong> {selectedAdjustment.rejectionReason}</Alert>
                )}
                <Divider />
                <Typography><strong>Người đề xuất:</strong> {selectedAdjustment.proposerName} ({selectedAdjustment.requestDate})</Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedAdjustment(null)}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ========================================================================= */}
      {/* WORKFLOW ACTION DIALOGS */}

      {/* DIALOG GHI CHÚ KẾ TOÁN (SOÁT PHIẾU) */}
      <Dialog open={accountantNoteDialog.open} onClose={() => setAccountantNoteDialog({ open: false, type: 'req', item: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Kế toán kiểm soát & Trình phê duyệt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Vui lòng ghi nhận kết quả đối soát thực tế trước khi trình lên Giám đốc hoặc tự động duyệt.
            </Typography>
            <TextField
              label="Ý kiến kiểm tra / Ghi chú đối soát"
              multiline
              rows={3}
              fullWidth
              required
              value={accountantNote}
              onChange={(e) => setAccountantNote(e.target.value)}
              placeholder="ví dụ: Đã đối chiếu dự toán công trình, khớp ngân sách... / Đã gọi điện NCC Hoàng Long xác nhận nhận lại hàng..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountantNoteDialog({ open: false, type: 'req', item: null })}>Hủy</Button>
          <Button variant="contained" onClick={handleAccountantSubmit}>
            Xác nhận & Trình duyệt
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG LÝ DO TỪ CHỐI */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, type: 'req', id: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Nhập lý do từ chối phê duyệt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Lý do từ chối (Bắt buộc)"
              multiline
              rows={3}
              fullWidth
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Vui lòng nhập lý do từ chối cụ thể..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, type: 'req', id: null })}>Hủy</Button>
          <Button variant="contained" color="error" onClick={handleConfirmReject} disabled={!rejectionReason.trim()}>
            Xác nhận từ chối
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG KẾ TOÁN XÁC NHẬN HOÀN TIỀN (TRẢ NCC) */}
      <Dialog open={refundDialog.open} onClose={() => setRefundDialog({ open: false, item: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Xác nhận hoàn tiền từ Nhà cung cấp</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Nhà cung cấp đã xác nhận nhận lại hàng thừa. Nhập số tiền mặt thực tế đã nhận hoàn lại để ghi nhận giảm chi phí dự án.
            </Typography>
            <TextField
              label="Số tiền hoàn lại thực tế (VND)"
              type="number"
              fullWidth
              required
              value={refundAmount || ''}
              onChange={(e) => setRefundAmount(parseInt(e.target.value) || 0)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialog({ open: false, item: null })}>Hủy</Button>
          <Button variant="contained" color="success" onClick={handleConfirmRefund}>
            Xác nhận & Cập nhật kho
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
