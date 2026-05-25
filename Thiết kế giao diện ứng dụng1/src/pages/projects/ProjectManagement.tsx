import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import WbsManagement from './WbsManagement';

export default function ProjectManagement() {
  const { projects, addProject, updateProject, currentUser } = useApp();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [viewingWbsProjectId, setViewingWbsProjectId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  const handleOpenDialog = (projectId?: string) => {
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setFormData({
          name: project.name,
          address: project.address,
          type: project.type,
          startDate: project.startDate,
          endDate: project.endDate,
          description: project.description || '',
        });
        setEditingProject(projectId);
      }
    } else {
      setFormData({
        name: '',
        address: '',
        type: '',
        startDate: '',
        endDate: '',
        description: '',
      });
      setEditingProject(null);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProject(null);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.address || !formData.type || !formData.startDate || !formData.endDate) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    if (editingProject) {
      updateProject(editingProject, formData);
      setSnackbar({ open: true, message: 'Cập nhật dự án thành công!' });
    } else {
      addProject({
        ...formData,
        status: 'draft',
        progress: 0,
      });
      setSnackbar({ open: true, message: 'Tạo dự án mới thành công!' });
    }
    handleCloseDialog();
  };

  const handleStatusChange = (projectId: string, newStatus: 'active' | 'paused') => {
    updateProject(projectId, { status: newStatus });
    setSnackbar({
      open: true,
      message: newStatus === 'active' ? 'Đã kích hoạt dự án!' : 'Đã tạm dừng dự án!',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Đang thi công';
      case 'paused':
        return 'Tạm dừng';
      case 'completed':
        return 'Hoàn thành';
      default:
        return 'Bản nháp';
    }
  };

  if (viewingWbsProjectId) {
    return <WbsManagement projectId={viewingWbsProjectId} onBack={() => setViewingWbsProjectId(null)} />;
  }

  const isTPKTOrAdmin = currentUser.role === 'TPKT' || currentUser.role === 'Admin';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Quản lý dự án
        </Typography>
        {isTPKTOrAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Tạo dự án mới
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mã dự án</TableCell>
                <TableCell>Tên dự án</TableCell>
                <TableCell>Địa chỉ</TableCell>
                <TableCell>Loại dự án</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Tiến độ</TableCell>
                <TableCell>Thời gian</TableCell>
                <TableCell align="center">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} hover>
                  <TableCell>{project.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {project.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {project.address}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={project.type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(project.status)}
                      color={getStatusColor(project.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                      <LinearProgress
                        variant="determinate"
                        value={project.progress}
                        sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption">{project.progress}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">
                      {project.startDate}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      đến {project.endDate}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => setViewingWbsProjectId(project.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    {isTPKTOrAdmin && (
                      <>
                        <IconButton size="small" color="primary" onClick={() => handleOpenDialog(project.id)} disabled={project.status !== 'draft'}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {project.status === 'active' ? (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleStatusChange(project.id, 'paused')}
                          >
                            <PauseIcon fontSize="small" />
                          </IconButton>
                        ) : project.status !== 'completed' ? (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleStatusChange(project.id, 'active')}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog tạo/sửa dự án */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingProject ? 'Sửa dự án' : 'Tạo dự án mới'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Tên dự án"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Địa chỉ"
              fullWidth
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <TextField
              select
              label="Loại dự án"
              fullWidth
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <MenuItem value="Xây mới">Xây mới</MenuItem>
              <MenuItem value="Cải tạo">Cải tạo</MenuItem>
              <MenuItem value="Sửa chữa">Sửa chữa</MenuItem>
              <MenuItem value="Nội thất">Nội thất</MenuItem>
              <MenuItem value="Combo">Combo (Xây dựng + Nội thất)</MenuItem>
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Ngày bắt đầu"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </Box>
            <TextField
              label="Mô tả"
              multiline
              rows={3}
              fullWidth
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingProject ? 'Cập nhật' : 'Tạo dự án'}
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
