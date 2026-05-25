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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  LocalShipping as LocalShippingIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useApp, MATERIALS } from '@/context/AppContext';

interface POItemForm {
  materialId: string;
  material: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export default function PurchaseOrders() {
  const { purchaseOrders, projects, addPurchaseOrder, recordReceipt, currentUser } = useApp();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [formData, setFormData] = useState({
    projectId: '',
    supplier: '',
    orderDate: '',
    expectedDate: '',
  });

  const [poItems, setPoItems] = useState<POItemForm[]>([]);
  const [receiptQuantities, setReceiptQuantities] = useState<{ [key: string]: number }>({});

  const handleOpenDialog = () => {
    setFormData({
      projectId: '',
      supplier: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: '',
    });
    setPoItems([]);
    setOpenDialog(true);
  };

  const handleAddItem = () => {
    setPoItems([
      ...poItems,
      {
        materialId: '',
        material: '',
        quantity: 0,
        unit: '',
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...poItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'materialId') {
      const mat = MATERIALS.find((m) => m.id === value);
      if (mat) {
        newItems[index].material = mat.name;
        newItems[index].unit = mat.unit;
      }
    }

    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].totalPrice = newItems[index].quantity * newItems[index].unitPrice;
    }

    setPoItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleSubmitPO = () => {
    if (!formData.projectId || !formData.supplier || !formData.orderDate || !formData.expectedDate) {
      setSnackbar({ open: true, message: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    if (poItems.length === 0) {
      setSnackbar({ open: true, message: 'Vui lòng thêm ít nhất một vật tư!' });
      return;
    }

    const project = projects.find((p) => p.id === formData.projectId);
    if (!project) return;

    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);

    addPurchaseOrder({
      projectId: formData.projectId,
      project: project.name,
      supplier: formData.supplier,
      orderDate: formData.orderDate,
      expectedDate: formData.expectedDate,
      items: poItems.map((item) => ({
        materialId: item.materialId,
        material: item.material,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      totalAmount,
    });

    setSnackbar({ open: true, message: 'Tạo đơn đặt hàng thành công!' });
    setOpenDialog(false);
  };

  const handleOpenReceipt = (poId: string) => {
    setSelectedPO(poId);
    setReceiptQuantities({});
    setReceiptDialog(true);
  };

  const handleRecordReceipt = () => {
    if (!selectedPO) return;

    const po = purchaseOrders.find((p) => p.id === selectedPO);
    if (!po) return;

    const totalReceived = Object.values(receiptQuantities).reduce((sum, qty) => sum + qty, 0);
    if (totalReceived === 0) {
      setSnackbar({ open: true, message: 'Vui lòng nhập số lượng nhận hàng!' });
      return;
    }

    // Record receipt in PO (context recordReceipt now handles transaction + inventory update automatically)
    recordReceipt(selectedPO, receiptQuantities);

    setSnackbar({ open: true, message: 'Ghi nhận nhận hàng thành công!' });
    setReceiptDialog(false);
    setSelectedPO(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'partial':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Đã gửi';
      case 'partial':
        return 'Nhận một phần';
      case 'completed':
        return 'Hoàn thành';
      default:
        return 'Đã gửi';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const selectedPOData = purchaseOrders.find((po) => po.id === selectedPO);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Đơn đặt hàng (PO)
        </Typography>
        {currentUser.role === 'Kế toán' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
            Tạo đơn đặt hàng
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Số PO</TableCell>
                <TableCell>Dự án</TableCell>
                <TableCell>Nhà cung cấp</TableCell>
                <TableCell>Ngày đặt</TableCell>
                <TableCell>Ngày giao dự kiến</TableCell>
                <TableCell align="right">Tổng giá trị</TableCell>
                <TableCell align="right">Đã nhận</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="center">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalShippingIcon color="primary" fontSize="small" />
                      <Typography variant="body2" fontWeight="bold">
                        {po.poNumber}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{po.project}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{po.supplier}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{po.orderDate}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{po.expectedDate}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(po.totalAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(po.receivedAmount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({po.totalAmount > 0 ? ((po.receivedAmount / po.totalAmount) * 100).toFixed(0) : 0}%)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(po.status)}
                      color={getStatusColor(po.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => setSelectedPO(po.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    {po.status !== 'completed' && currentUser.role === 'Kỹ sư' && (
                      <IconButton size="small" color="success" onClick={() => handleOpenReceipt(po.id)}>
                        <LocalShippingIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {purchaseOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">Chưa có đơn đặt hàng nào</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog tạo PO */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Tạo đơn đặt hàng</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="Số PO" fullWidth placeholder="Tự động tạo" disabled />
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
            </Box>
            <TextField
              label="Tên nhà cung cấp"
              fullWidth
              required
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Ngày đặt hàng"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
              />
              <TextField
                label="Ngày giao hàng dự kiến"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
              />
            </Box>

            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Chi tiết vật tư
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Vật tư</TableCell>
                    <TableCell>Số lượng</TableCell>
                    <TableCell>Đơn vị</TableCell>
                    <TableCell>Đơn giá</TableCell>
                    <TableCell>Thành tiền</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {poItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={item.materialId}
                          onChange={(e) => handleUpdateItem(index, 'materialId', e.target.value)}
                        >
                          {MATERIALS.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                              {m.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          sx={{ width: 100 }}
                          value={item.quantity || ''}
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" sx={{ width: 80 }} value={item.unit} disabled />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          sx={{ width: 120 }}
                          value={item.unitPrice || ''}
                          onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {poItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Chưa có vật tư nào
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddItem}>
              Thêm vật tư
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Typography variant="h6">
                Tổng cộng:{' '}
                <strong>{formatCurrency(poItems.reduce((sum, item) => sum + item.totalPrice, 0))}</strong>
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmitPO}>
            Tạo đơn
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog xem chi tiết PO */}
      <Dialog open={selectedPO !== null && !receiptDialog} onClose={() => setSelectedPO(null)} maxWidth="md" fullWidth>
        {selectedPOData && (
          <>
            <DialogTitle>Chi tiết đơn đặt hàng - {selectedPOData.poNumber}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Dự án
                    </Typography>
                    <Typography variant="body1">{selectedPOData.project}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Nhà cung cấp
                    </Typography>
                    <Typography variant="body1">{selectedPOData.supplier}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ngày đặt hàng
                    </Typography>
                    <Typography variant="body1">{selectedPOData.orderDate}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ngày giao dự kiến
                    </Typography>
                    <Typography variant="body1">{selectedPOData.expectedDate}</Typography>
                  </Box>
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
                  Chi tiết vật tư
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vật tư</TableCell>
                        <TableCell align="right">Số lượng</TableCell>
                        <TableCell align="right">Đơn giá</TableCell>
                        <TableCell align="right">Thành tiền</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPOData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.material}</TableCell>
                          <TableCell align="right">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <strong>Tổng cộng:</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(selectedPOData.totalAmount)}</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPO(null)}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog ghi nhận nhận hàng */}
      <Dialog open={receiptDialog} onClose={() => { setReceiptDialog(false); setSelectedPO(null); }} maxWidth="md" fullWidth>
        {selectedPOData && (
          <>
            <DialogTitle>Ghi nhận nhận hàng - {selectedPOData.poNumber}</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Nhập số lượng thực tế nhận được cho từng vật tư
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Vật tư</TableCell>
                        <TableCell align="right">Số lượng đặt</TableCell>
                        <TableCell align="right">Đã nhận</TableCell>
                        <TableCell align="right">Nhận lần này</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPOData.items.map((item, index) => {
                        const received = selectedPOData.receivedItems?.[item.materialId] || 0;
                        const remaining = item.quantity - received;
                        return (
                          <TableRow key={index}>
                            <TableCell>{item.material}</TableCell>
                            <TableCell align="right">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell align="right">
                              {received} {item.unit}
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                sx={{ width: 120 }}
                                inputProps={{ min: 0, max: remaining }}
                                value={receiptQuantities[item.materialId] || 0}
                                onChange={(e) =>
                                  setReceiptQuantities({
                                    ...receiptQuantities,
                                    [item.materialId]: Math.min(parseFloat(e.target.value) || 0, remaining),
                                  })
                                }
                                helperText={`Còn lại: ${remaining} ${item.unit}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setReceiptDialog(false); setSelectedPO(null); }}>Hủy</Button>
              <Button variant="contained" color="success" onClick={handleRecordReceipt}>
                Xác nhận nhận hàng
              </Button>
            </DialogActions>
          </>
        )}
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
