import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Divider,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Image as ImageIcon,
  Comment as CommentIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function DailyLog() {
  const { dailyLogs, projects, tasks, addDailyLog, addComment, currentUser } = useApp();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [formData, setFormData] = useState({
    projectId: '',
    taskId: '',
    progress: 0,
    description: '',
  });

  const getAvailableTasks = () => {
    if (!formData.projectId) return [];
    return tasks.filter((t) => {
      if (t.projectId !== formData.projectId) return false;
      if (t.status === 'accepted' || t.status === 'obsolete') return false;
      if (currentUser.role === 'Kỹ sư' && t.assigneeId !== currentUser.id) return false;
      return true;
    });
  };

  const [filterProject, setFilterProject] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const handleOpenDialog = () => {
    setFormData({
      projectId: '',
      taskId: '',
      progress: 0,
      description: '',
    });
    setOpenDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.projectId || !formData.taskId || !formData.description) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    const project = projects.find((p) => p.id === formData.projectId);
    const selectedTask = tasks.find((t) => t.id === formData.taskId);
    if (!project || !selectedTask) return;

    if (currentUser.role === 'Kỹ sư') {
      if (formData.progress < selectedTask.progress) {
        setSnackbar({
          open: true,
          message: `Không thể giảm tiến độ. Vui lòng báo cáo TPKT để xử lý sự cố. Tiến độ hiện tại của task này là ${selectedTask.progress}%`,
        });
        return;
      }
    }

    addDailyLog({
      date: new Date().toISOString().split('T')[0],
      projectId: formData.projectId,
      project: project.name,
      taskId: formData.taskId,
      task: selectedTask.name,
      progress: formData.progress,
      description: formData.description,
      images: [],
      authorId: currentUser.id,
      author: currentUser.name,
    });

    setSnackbar({ open: true, message: 'Tạo nhật ký thành công!' });
    setOpenDialog(false);
  };

  const handleAddComment = (logId: string) => {
    if (!commentText.trim()) return;

    addComment(logId, {
      author: currentUser.name,
      text: commentText,
      date: new Date().toISOString(),
    });

    setCommentText('');
    setSnackbar({ open: true, message: 'Đã thêm bình luận!' });
  };

  const filteredLogs = dailyLogs.filter((log) => {
    if (filterProject && log.projectId !== filterProject) return false;
    if (filterFromDate && log.date < filterFromDate) return false;
    if (filterToDate && log.date > filterToDate) return false;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Nhật ký công trường
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Tạo nhật ký mới
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField
            select
            label="Dự án"
            size="small"
            fullWidth
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Từ ngày"
            type="date"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={filterFromDate}
            onChange={(e) => setFilterFromDate(e.target.value)}
          />
          <TextField
            label="Đến ngày"
            type="date"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={filterToDate}
            onChange={(e) => setFilterToDate(e.target.value)}
          />
        </Box>
      </Paper>

      {/* Nhật ký entries */}
      <Box sx={{ display: 'grid', gap: 2 }}>
        {filteredLogs.map((log) => (
          <Card key={log.id}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {log.task}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip label={log.project} size="small" color="primary" variant="outlined" />
                    <Chip label={log.date} size="small" variant="outlined" />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {log.progress === 100 ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <Chip label={`${log.progress}%`} color="primary" size="small" />
                  )}
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {log.description}
              </Typography>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32 }}>{log.author[0]}</Avatar>
                  <Typography variant="body2" color="text.secondary">
                    {log.author}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small" onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}>
                    <CommentIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption">{log.comments.length}</Typography>
                </Box>
              </Box>

              {/* Comments section */}
              {selectedLog === log.id && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                  {log.comments.map((comment) => (
                    <Box key={comment.id} sx={{ mb: 2, display: 'flex', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24 }}>{comment.author[0]}</Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" fontWeight="bold">
                          {comment.author}
                        </Typography>
                        <Typography variant="body2">{comment.text}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(comment.date).toLocaleString('vi-VN')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Thêm bình luận..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment(log.id);
                        }
                      }}
                    />
                    <IconButton color="primary" onClick={() => handleAddComment(log.id)}>
                      <SendIcon />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredLogs.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Chưa có nhật ký nào</Typography>
          </Paper>
        )}
      </Box>

      {/* Dialog tạo nhật ký mới */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tạo nhật ký công trường</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Dự án"
              fullWidth
              required
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            >
              {projects.filter((p) => p.status === 'active').map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Công việc (Task)"
              fullWidth
              required
              value={formData.taskId}
              onChange={(e) => {
                const tId = e.target.value;
                const t = tasks.find(item => item.id === tId);
                setFormData({
                  ...formData,
                  taskId: tId,
                  progress: t ? t.progress : 0
                });
              }}
              disabled={!formData.projectId}
            >
              {getAvailableTasks().map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} (Hiện tại: {t.progress}%)
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tiến độ mới hoàn thành (%)"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0, max: 100 }}
              value={formData.progress}
              onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
              disabled={!formData.taskId}
            />
            <TextField
              label="Mô tả công việc"
              multiline
              rows={4}
              fullWidth
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Button variant="outlined" startIcon={<ImageIcon />} component="label">
              Tải lên ảnh (Tối đa 5 ảnh)
              <input type="file" hidden multiple accept="image/*" />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Lưu nhật ký
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
