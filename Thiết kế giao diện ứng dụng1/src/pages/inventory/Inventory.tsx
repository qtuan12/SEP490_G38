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
  TextField,
  MenuItem,
  Tabs,
  Tab,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  SwapHoriz as SwapHorizIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useApp, MATERIALS } from '@/context/AppContext';

export default function Inventory() {
  const { inventory, transactions, projects, addTransaction, currentUser } = useApp();
  const [tabValue, setTabValue] = useState(0);
  const [selectedProject, setSelectedProject] = useState('');
  const [openDialog, setOpenDialog] = useState<'in' | 'out' | 'transfer' | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [formData, setFormData] = useState({
    materialId: '',
    quantity: 0,
    from: '',
    to: '',
    note: '',
  });

  const handleOpenDialog = (type: 'in' | 'out' | 'transfer') => {
    setFormData({
      materialId: '',
      quantity: 0,
      from: type === 'in' ? '' : selectedProject || '',
      to: type === 'out' ? '' : selectedProject || '',
      note: '',
    });
    setOpenDialog(type);
  };

  const handleSubmit = () => {
    if (!formData.materialId || !formData.quantity || formData.quantity <= 0) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    let materialName = '';
    let materialUnit = '';
    let currentInStock = 0;

    if (openDialog === 'in') {
      const mat = MATERIALS.find((m) => m.id === formData.materialId);
      if (!mat) return;
      materialName = mat.name;
      materialUnit = mat.unit;
    } else {
      const projectId = openDialog === 'out' ? selectedProject : formData.from;
      const invItem = inventory.find(
        (item) => item.projectId === projectId && item.materialId === formData.materialId
      );
      if (!invItem) {
        setSnackbar({ open: true, message: 'Vật tư không tồn tại trong kho dự án này!' });
        return;
      }
      materialName = invItem.material;
      materialUnit = invItem.unit;
      currentInStock = invItem.inStock;
    }

    if (openDialog === 'out' || openDialog === 'transfer') {
      if (currentInStock < formData.quantity) {
        setSnackbar({ open: true, message: 'Số lượng trong kho không đủ!' });
        return;
      }
    }

    const projId = openDialog === 'in' ? selectedProject : (openDialog === 'out' ? selectedProject : formData.from);

    addTransaction({
      type: openDialog as 'in' | 'out' | 'transfer',
      materialId: formData.materialId,
      material: materialName,
      quantity: formData.quantity,
      unit: materialUnit,
      from: openDialog === 'in' ? formData.from : (openDialog === 'transfer' ? formData.from : selectedProject),
      to: openDialog === 'out' ? formData.to : (openDialog === 'transfer' ? formData.to : selectedProject),
      note: formData.note,
      projectId: projId || '',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    setSnackbar({
      open: true,
      message:
        openDialog === 'in'
          ? 'Nhập kho thành công!'
          : openDialog === 'out'
          ? 'Xuất kho thành công!'
          : 'Chuyển kho thành công!',
    });
    setOpenDialog(null);
  };

  const getStockStatus = (inStock: number, minStock: number) => {
    if (inStock < minStock) {
      return { color: 'error', text: 'Tồn kho thấp' };
    }
    if (inStock < minStock * 1.5) {
      return { color: 'warning', text: 'Cần bổ sung' };
    }
    return { color: 'success', text: 'Đủ' };
  };

  const filteredInventory = selectedProject
    ? inventory.filter((item) => item.projectId === selectedProject)
    : inventory;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Kho & Tồn kho
        </Typography>
        <TextField
          select
          label="Dự án"
          size="small"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          sx={{ minWidth: 250 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Tồn kho hiện tại" />
          <Tab label="Lịch sử nhập/xuất" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <Paper sx={{ p: 2 }}>
          {currentUser.role !== 'Kế toán' && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('in')} disabled={!selectedProject}>
                Nhập kho
              </Button>
              <Button variant="outlined" startIcon={<RemoveIcon />} onClick={() => handleOpenDialog('out')} disabled={!selectedProject}>
                Xuất kho
              </Button>
              <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => handleOpenDialog('transfer')}>
                Chuyển kho
              </Button>
            </Box>
          )}

          {!selectedProject && tabValue === 0 && currentUser.role !== 'Kế toán' && (
            <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
              * Chọn một dự án cụ thể để Nhập kho hoặc Xuất kho.
            </Typography>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vật tư</TableCell>
                  <TableCell align="right">Tồn kho</TableCell>
                  <TableCell align="right">Tồn kho tối thiểu</TableCell>
                  <TableCell>Tình trạng</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Cập nhật</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item.inStock, item.minStock);
                  const stockPercent = (item.inStock / (item.minStock * 2)) * 100;
                  return (
                    <TableRow key={`${item.projectId}-${item.materialId}`} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon color="primary" fontSize="small" />
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {item.material}
                            </Typography>
                            {!selectedProject && (
                              <Typography variant="caption" color="text.secondary">
                                Dự án: {item.project}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {item.inStock} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {item.minStock} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(stockPercent, 100)}
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                            color={item.inStock < item.minStock ? 'error' : item.inStock < item.minStock * 1.5 ? 'warning' : 'success'}
                          />
                          <Typography variant="caption">{stockPercent.toFixed(0)}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={status.text} color={status.color as any} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {item.lastUpdate}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredInventory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">Chưa có dữ liệu tồn kho</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mã GD</TableCell>
                  <TableCell>Ngày giờ</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Vật tư</TableCell>
                  <TableCell align="right">Số lượng</TableCell>
                  <TableCell>Từ</TableCell>
                  <TableCell>Đến</TableCell>
                  <TableCell>Ghi chú</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions
                  .filter((tx) => !selectedProject || tx.projectId === selectedProject || tx.from === selectedProject || tx.to === selectedProject)
                  .map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>{tx.id}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{new Date(tx.date).toLocaleString('vi-VN')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            tx.type === 'in'
                              ? 'Nhập kho'
                              : tx.type === 'out'
                              ? 'Xuất kho'
                              : 'Chuyển kho'
                          }
                          color={tx.type === 'in' ? 'success' : tx.type === 'out' ? 'error' : 'info'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{tx.material}</TableCell>
                      <TableCell align="right">
                        {tx.quantity} {tx.unit}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {tx.from}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {tx.to}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {tx.note}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">Chưa có giao dịch nào</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog nhập/xuất/chuyển kho */}
      <Dialog open={openDialog !== null} onClose={() => setOpenDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {openDialog === 'in' ? 'Nhập kho' : openDialog === 'out' ? 'Xuất kho' : 'Chuyển kho'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {openDialog === 'transfer' && (
              <>
                <TextField
                  select
                  label="Từ dự án"
                  fullWidth
                  required
                  value={formData.from}
                  onChange={(e) => setFormData({ ...formData, from: e.target.value, materialId: '' })}
                >
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Đến dự án"
                  fullWidth
                  required
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                >
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id} disabled={p.id === formData.from}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}

            <TextField
              select
              label="Vật tư"
              fullWidth
              required
              value={formData.materialId}
              onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
              disabled={openDialog === 'transfer' && !formData.from}
            >
              {openDialog === 'in'
                ? MATERIALS.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))
                : inventory
                    .filter((item) => item.projectId === (openDialog === 'out' ? selectedProject : formData.from) && item.inStock > 0)
                    .map((item) => (
                      <MenuItem key={item.materialId} value={item.materialId}>
                        {item.material} ({item.inStock} {item.unit} trong kho)
                      </MenuItem>
                    ))}
            </TextField>
            <TextField
              label="Số lượng"
              type="number"
              fullWidth
              required
              inputProps={{ min: 0.1 }}
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            />
            {openDialog === 'in' && (
              <TextField
                label="Từ (PO/Nhà cung cấp)"
                fullWidth
                required
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              />
            )}
            {openDialog === 'out' && (
              <TextField
                label="Đến (Công việc/Mục đích)"
                fullWidth
                required
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              />
            )}
            <TextField
              label="Ghi chú"
              multiline
              rows={2}
              fullWidth
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Xác nhận
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
