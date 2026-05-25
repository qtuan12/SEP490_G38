import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  PendingActions as PendingActionsIcon,
} from '@mui/icons-material';
import { useApp } from '@/context/AppContext';

export default function Dashboard() {
  const { projects, materialRequests, dailyLogs } = useApp();

  const activeProjects = projects.filter((p) => p.status === 'active');
  const completedThisMonth = projects.filter((p) => p.status === 'completed').length;
  const pendingRequests = materialRequests.filter((r) => r.status !== 'approved' && r.status !== 'rejected');
  const overQuotaRequests = pendingRequests.filter((r) => r.isOverQuota);
  const lateProjects = projects.filter((p) => {
    const deadline = new Date(p.endDate);
    const today = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = ((today.getTime() - new Date(p.startDate).getTime()) /
      (deadline.getTime() - new Date(p.startDate).getTime())) * 100;
    return p.progress < expectedProgress && p.status === 'active';
  });

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

  const getAlertLevel = (project: any) => {
    const deadline = new Date(project.endDate);
    const today = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = ((today.getTime() - new Date(project.startDate).getTime()) /
      (deadline.getTime() - new Date(project.startDate).getTime())) * 100;

    if (today > deadline && project.progress < 100) return 'danger';
    if (project.progress < expectedProgress - 10) return 'warning';
    return 'none';
  };

  return (
    <>
      {/* Thống kê tổng quan */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 3,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FolderIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Dự án đang thi công
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold">
              {activeProjects.length}
            </Typography>
            <Typography variant="caption" color="success.main">
              <TrendingUpIcon sx={{ fontSize: 14 }} /> Tổng {projects.length} dự án
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <WarningIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Cảnh báo trễ hạn
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="error">
              {lateProjects.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cần xử lý gấp
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <PendingActionsIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Yêu cầu vật tư chờ duyệt
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {pendingRequests.length}
            </Typography>
            <Typography variant="caption" color="error.main">
              {overQuotaRequests.length} vượt định mức
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Hoàn thành tháng này
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {completedThisMonth}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tỷ lệ {projects.length > 0 ? ((completedThisMonth / projects.length) * 100).toFixed(0) : 0}%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Danh sách dự án */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Dự án đang thực hiện
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã dự án</TableCell>
                  <TableCell>Tên dự án</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Tiến độ</TableCell>
                  <TableCell>Deadline</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeProjects.slice(0, 5).map((project) => {
                  const alertLevel = getAlertLevel(project);
                  return (
                    <TableRow key={project.id} hover>
                      <TableCell>{project.id}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {alertLevel === 'danger' && (
                            <WarningIcon color="error" sx={{ mr: 1, fontSize: 18 }} />
                          )}
                          {alertLevel === 'warning' && (
                            <WarningIcon color="warning" sx={{ mr: 1, fontSize: 18 }} />
                          )}
                          {project.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(project.status)}
                          color={getStatusColor(project.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={project.progress}
                            sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                            color={
                              alertLevel === 'danger'
                                ? 'error'
                                : alertLevel === 'warning'
                                ? 'warning'
                                : 'primary'
                            }
                          />
                          <Typography variant="caption">{project.progress}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{project.endDate}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Yêu cầu vật tư chờ duyệt */}
        <Box>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Yêu cầu vật tư chờ duyệt
            </Typography>
            <List>
              {pendingRequests.slice(0, 5).map((request) => (
                <ListItem
                  key={request.id}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: request.isOverQuota ? '#fff3e0' : '#fff',
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {request.material}
                      </Typography>
                      {request.isOverQuota && (
                        <Chip
                          label="Vượt định mức"
                          color="error"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {request.project}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SL: {request.quantity} | {request.id}
                    </Typography>
                  </Box>
                  <Chip
                    label={
                      request.status === 'pending'
                        ? 'Chờ duyệt'
                        : request.status === 'accountant-review'
                        ? 'KT kiểm tra'
                        : 'Chờ GĐ'
                    }
                    color="warning"
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Thông báo gần đây */}
          <Paper sx={{ p: 2, mt: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Nhật ký gần đây
            </Typography>
            <List>
              {dailyLogs.slice(0, 3).map((log) => (
                <ListItem key={log.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      {log.author[0]}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={log.task}
                    secondary={`${log.project} - ${log.date}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip label={`${log.progress}%`} size="small" color="primary" />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
