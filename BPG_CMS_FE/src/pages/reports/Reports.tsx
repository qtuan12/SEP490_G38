import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Chip,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  AttachMoney as AttachMoneyIcon,
  Warehouse as WarehouseIcon,
  AutoAwesome as AutoAwesomeIcon,
  GetApp as GetAppIcon,
  ContentCopy as ContentCopyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useApp } from '@/context/AppContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const BUDGETS: { [key: string]: number } = {
  PRJ001: 5000000000, // 5 tỷ
  PRJ002: 2000000000, // 2 tỷ
  PRJ003: 1500000000, // 1.5 tỷ
};

const MATERIAL_PRICES: { [key: string]: number } = {
  MAT001: 95000,
  MAT002: 18000,
  MAT003: 350000,
  MAT004: 12000,
  MAT005: 16000,
  MAT006: 450000,
};

export default function Reports() {
  const {
    projects,
    tasks,
    phases,
    inventory,
    transactions,
    purchaseOrders,
    materialRequests,
    excessProposals,
    inventoryAdjustments,
    currentUser,
  } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tabValue, setTabValue] = useState<number>(0);

  // AI Summary states
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const handleTabChange = (_: any, newValue: number) => {
    setTabValue(newValue);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Filter WBS tasks
  const projectPhases = phases.filter((p) => p.projectId === selectedProjectId);
  const projectTasks = tasks.filter((t) => t.projectId === selectedProjectId && t.status !== 'obsolete');

  // Helper to parse dates into timestamp/percentages for Gantt Chart
  const getTimelinePosition = (taskStart: string, taskEnd: string) => {
    if (!selectedProject) return { left: 0, width: 100 };

    const projStart = new Date(selectedProject.startDate).getTime();
    const projEnd = new Date(selectedProject.endDate).getTime();
    const tStart = new Date(taskStart).getTime();
    const tEnd = new Date(taskEnd).getTime();

    const totalDuration = projEnd - projStart;
    if (totalDuration <= 0) return { left: 0, width: 100 };

    const left = Math.max(0, ((tStart - projStart) / totalDuration) * 100);
    const width = Math.max(5, ((tEnd - tStart) / totalDuration) * 100);

    return { left: Math.min(left, 95), width: Math.min(width, 100 - left) };
  };

  // Helper to get overall timeline ticks
  const getTimelineMonths = () => {
    if (!selectedProject) return [];
    const start = new Date(selectedProject.startDate);
    const end = new Date(selectedProject.endDate);
    const months = [];
    const curr = new Date(start.getFullYear(), start.getMonth(), 1);

    while (curr <= end) {
      months.push(
        curr.toLocaleString('vi-VN', { month: 'short', year: 'numeric' })
      );
      curr.setMonth(curr.getMonth() + 1);
    }
    return months;
  };

  // FINANCIAL DATA CALCULATIONS
  const getFinancialData = () => {
    if (!selectedProjectId) return { budget: 0, poCost: 0, lossCost: 0, netMargin: 0, poList: [] };

    const budget = BUDGETS[selectedProjectId] || 1000000000;

    // Actual spent: received PO item amount
    const projectPOs = purchaseOrders.filter((po) => po.projectId === selectedProjectId);
    const poCost = projectPOs.reduce((sum, po) => sum + po.receivedAmount, 0);

    // Wastage & Losses cost calculation
    const projectAdjustments = inventoryAdjustments.filter(
      (adj) => adj.projectId === selectedProjectId && adj.status === 'completed'
    );
    const lossCost = projectAdjustments.reduce((sum, adj) => {
      const price = MATERIAL_PRICES[adj.materialId] || 50000;
      return sum + adj.quantity * price;
    }, 0);

    const netMargin = budget - poCost - lossCost;

    return { budget, poCost, lossCost, netMargin, poList: projectPOs };
  };

  const financials = getFinancialData();

  // INVENTORY CALCULATIONS
  const getInventoryData = () => {
    const items = inventory.filter((item) => item.projectId === selectedProjectId);
    return items.map((item) => ({
      name: item.material,
      'Tồn thực tế': item.inStock,
      'Định mức': item.quota,
      'Mức an toàn': item.minStock,
    }));
  };

  const inventoryData = getInventoryData();

  // CATEGORY SPENDING PIE
  const getCategorySpending = () => {
    const itemsCost: { [key: string]: number } = {};
    purchaseOrders
      .filter((po) => po.projectId === selectedProjectId)
      .forEach((po) => {
        po.items.forEach((item) => {
          const cost = item.receivedQuantity * item.unitPrice;
          if (cost > 0) {
            itemsCost[item.material] = (itemsCost[item.material] || 0) + cost;
          }
        });
      });

    return Object.entries(itemsCost).map(([name, value]) => ({ name, value }));
  };

  const pieData = getCategorySpending();

  // TRANSACTIONS HISTORY
  const projectTransactions = transactions.filter((t) => t.projectId === selectedProjectId);

  // TRIGGER SIMULATED AI GENERATION
  const handleGenerateAIReport = () => {
    setAiLoading(true);
    setAiStep('Đang trích xuất nhật ký công trường...');

    setTimeout(() => {
      setAiStep('Thu thập dữ liệu hao hụt tồn kho & sự cố thi công...');
      setTimeout(() => {
        setAiStep('Phân tích tiến độ WBS và dự báo trễ hạn...');
        setTimeout(() => {
          setAiStep('Đang gọi mô hình Gemini Flash để tổng hợp báo cáo...');
          setTimeout(() => {
            // Generate report content dynamically based on current project data
            const avgProgress = selectedProject ? selectedProject.progress : 0;
            const completedCount = projectTasks.filter((t) => t.status === 'completed' || t.status === 'accepted').length;
            const totalCount = projectTasks.length;

            const incidentTasks = projectTasks.filter((t) => t.incidentLog && t.incidentLog.length > 0);
            const delayTasks = projectTasks.filter((t) => t.delayLog && t.delayLog.length > 0);

            // Check if there was a moisture incident
            const hasWastage = inventoryAdjustments.some(
              (adj) => adj.projectId === selectedProjectId && adj.type === 'wastage' && adj.status === 'completed'
            );

            let progressSummary = '';
            let riskSummary = '';
            let overallEval = 'Trung bình';

            if (avgProgress > 70) {
              overallEval = 'Tốt';
              progressSummary = `Dự án đang bám sát tiến độ rất tốt với tỷ lệ hoàn thành trung bình là ${avgProgress}%. Đã hoàn thành nghiệm thu ${completedCount}/${totalCount} công việc trọng tâm.`;
            } else if (avgProgress >= 40) {
              overallEval = 'Trung bình';
              progressSummary = `Tiến độ thi công đạt mức trung bình (${avgProgress}%). Một số hạng mục xây dựng thô đang tiếp tục được đẩy mạnh. Đã bàn giao ${completedCount}/${totalCount} công việc.`;
            } else {
              overallEval = 'Chậm';
              progressSummary = `Tiến độ dự án hiện tại tương đối chậm (${avgProgress}%). Cần chú ý huy động thêm nhân sự kỹ sư và chuẩn bị vật tư kịp thời để tránh dồn ứ đầu việc.`;
            }

            if (incidentTasks.length > 0 || hasWastage) {
              riskSummary = `Phát hiện rủi ro hao hụt vật tư do các tác động bên ngoài. ${
                hasWastage ? 'Hao hụt xi măng ẩm mốc đã được hạch toán giảm kho.' : ''
              } ${incidentTasks.map((t) => `Task "${t.name}" bị lùi tiến độ do sự cố`).join(', ')}.`;
            } else {
              riskSummary = 'Không có rủi ro lớn phát sinh về chất lượng thi công hay thất thoát vật tư trong tuần này. Hệ thống kho bãi hoạt động an toàn.';
            }

            const lateCount = projectTasks.filter((t) => {
              const deadline = new Date(t.endDate);
              const today = new Date();
              return today > deadline && t.progress < 100;
            }).length;

            setAiReport({
              projectName: selectedProject?.name || '',
              dateGenerated: new Date().toLocaleDateString('vi-VN'),
              evaluation: overallEval,
              progressPercent: avgProgress,
              progressText: progressSummary,
              risksText: riskSummary,
              alertsText: lateCount > 0 
                ? `Cảnh báo: Hiện đang có ${lateCount} hạng mục bị trễ hạn so với tiến độ cam kết. Cần lùi hạn hoặc bố trí làm tăng ca.`
                : 'Dự báo: Chưa phát hiện nguy cơ trễ hạn nghiêm trọng cho các hạng mục sắp tới.',
              suggestions: [
                'Gia cố che chắn lán bãi chứa xi măng và sắt thép trước mùa mưa.',
                'Ưu tiên giải ngân PO vật tư cát đá xây dựng cho Phase tiếp theo.',
                incidentTasks.length > 0 ? 'Tập trung giám sát chất lượng tại các task có nhật ký sự cố để đảm bảo nghiệm thu đạt chuẩn.' : 'Duy trì tần suất giám sát hiện trường 2 lần/ngày.',
              ],
            });
            setAiLoading(false);
          }, 600);
        }, 500);
      }, 500);
    }, 500);
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    const text = `BÁO CÁO TÓM TẮT TIẾN ĐỘ & VẬT TƯ AI - DỰ ÁN: ${aiReport.projectName}
Ngày lập: ${aiReport.dateGenerated}
Đánh giá chung: ${aiReport.evaluation} (Tiến độ: ${aiReport.progressPercent}%)

1. TIẾN ĐỘ THI CÔNG:
${aiReport.progressText}

2. RỦI RO & HAO HỤT VẬT TƯ:
${aiReport.risksText}

3. DỰ BÁO TRỄ HẠN:
${aiReport.alertsText}

4. KHUYẾN NGHỊ HÀNH ĐỘNG:
${aiReport.suggestions.map((s: string, i: number) => `- ${s}`).join('\n')}

--- BPG Construction AI Helper ---`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box>
      {/* Top Selector bar */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Báo cáo Phân tích & Thống kê
          </Typography>
        </Box>
        <Box sx={{ minWidth: 280 }}>
          <TextField
            select
            label="Chọn dự án phân tích"
            fullWidth
            size="small"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setAiReport(null); // Reset AI report when project changes
            }}
          >
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label="Tiến độ WBS (Gantt Chart)" />
          <Tab icon={<AttachMoneyIcon fontSize="small" />} iconPosition="start" label="Chi phí & Lãi lỗ" />
          <Tab icon={<WarehouseIcon fontSize="small" />} iconPosition="start" label="Tồn kho & Nhập xuất" />
          <Tab icon={<AutoAwesomeIcon fontSize="small" />} iconPosition="start" label="Trợ lý Báo cáo AI" />
        </Tabs>
      </Paper>

      {/* ==================== TAB 0: GANTT CHART ==================== */}
      {tabValue === 0 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Timeline tiến độ dự án (Gantt Chart mô phỏng)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
                *Biểu đồ thời gian hiển thị tỷ lệ phân phối từ ngày {selectedProject?.startDate} đến {selectedProject?.endDate}
              </Typography>

              {/* Gantt Area */}
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden', backgroundColor: '#fafafa', p: 2 }}>
                {/* Timeline Header Months */}
                <Box sx={{ display: 'flex', borderBottom: '1px solid #e0e0e0', pb: 1, mb: 2 }}>
                  <Box sx={{ width: '250px', fontWeight: 'bold', fontSize: '13px' }}>Công việc</Box>
                  <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', position: 'relative', px: 1 }}>
                    {getTimelineMonths().map((m, idx) => (
                      <Typography key={idx} variant="caption" fontWeight="bold" color="text.secondary">
                        {m}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                {/* Phases and Tasks */}
                {projectPhases.map((phase) => (
                  <Box key={phase.id} sx={{ mb: 2 }}>
                    {/* Phase line */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, backgroundColor: '#f0f4f8', borderRadius: 1, px: 1 }}>
                      <Box sx={{ width: '240px', fontWeight: 'bold', fontSize: '13px' }}>
                        {phase.name}
                      </Box>
                      <Box sx={{ flexGrow: 1, position: 'relative', height: '14px' }}>
                        {/* Timeline background representation for phase */}
                        <Box
                          sx={{
                            position: 'absolute',
                            ...getTimelinePosition(phase.startDate, phase.endDate),
                            backgroundColor: '#90caf9',
                            borderRadius: '4px',
                            height: '100%',
                            opacity: 0.7,
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Tasks line */}
                    {projectTasks
                      .filter((t) => t.phaseId === phase.id)
                      .map((task) => {
                        const { left, width } = getTimelinePosition(task.startDate, task.endDate);
                        const isLate = new Date() > new Date(task.endDate) && task.progress < 100;
                        return (
                          <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', py: 1, pl: 3, borderBottom: '1px dashed #eee' }}>
                            <Box sx={{ width: '220px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" noWrap>{task.name}</Typography>
                              {isLate && (
                                <Tooltip title="Trễ hạn!">
                                  <WarningIcon color="error" sx={{ fontSize: 16 }} />
                                </Tooltip>
                              )}
                            </Box>
                            <Box sx={{ flexGrow: 1, position: 'relative', height: '24px' }}>
                              {/* Task duration bar */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  backgroundColor: isLate ? '#ffebee' : '#e3f2fd',
                                  border: `1px solid ${isLate ? '#e57373' : '#64b5f6'}`,
                                  borderRadius: '6px',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                              >
                                {/* Progress inside bar */}
                                <Box
                                  sx={{
                                    width: `${task.progress}%`,
                                    backgroundColor: isLate ? '#ef5350' : '#42a5f5',
                                    height: '100%',
                                    transition: 'width 0.5s ease-in-out',
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    position: 'absolute',
                                    left: '8px',
                                    fontWeight: 'bold',
                                    color: task.progress > 40 ? '#fff' : '#1976d2',
                                    fontSize: '10px',
                                  }}
                                >
                                  {task.progress}% ({task.assigneeName})
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                  </Box>
                ))}

                {projectTasks.length === 0 && (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">Dự án này chưa được thiết lập kế hoạch WBS hoặc chưa có Task nào</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ==================== TAB 1: CHI PHÍ & LÃI LỖ ==================== */}
      {tabValue === 1 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            <Card sx={{ bgcolor: '#e8f5e9' }}>
              <CardContent>
                <Typography color="success.dark" variant="caption" fontWeight="bold">NGÂN SÁCH DỰ TOÁN</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                  {financials.budget.toLocaleString('vi-VN')} đ
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: '#ffebee' }}>
              <CardContent>
                <Typography color="error.dark" variant="caption" fontWeight="bold">CHI PHÍ VẬT TƯ THỰC CHI (PO)</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }} color="error.main">
                  {financials.poCost.toLocaleString('vi-VN')} đ
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: financials.netMargin >= 0 ? '#e3f2fd' : '#fff3e0' }}>
              <CardContent>
                <Typography color="primary.dark" variant="caption" fontWeight="bold">LỢI NHUẬN / DƯ CÒN LẠI</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }} color={financials.netMargin >= 0 ? 'primary.main' : 'warning.main'}>
                  {financials.netMargin.toLocaleString('vi-VN')} đ
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                So sánh tài chính thực tế
              </Typography>
              <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                <ResponsiveContainer>
                  <RechartsBarChart
                    data={[
                      {
                        name: 'Tài chính',
                        'Ngân sách': financials.budget,
                        'Đã chi (PO)': financials.poCost,
                        'Thất thoát': financials.lossCost,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toLocaleString()}M`} />
                    <ChartTooltip formatter={(value) => `${Number(value).toLocaleString()} đ`} />
                    <Legend />
                    <Bar dataKey="Ngân sách" fill="#4caf50" />
                    <Bar dataKey="Đã chi (PO)" fill="#f44336" />
                    <Bar dataKey="Thất thoát" fill="#ff9800" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Cơ cấu chi phí mua vật tư (%)
              </Typography>
              <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {pieData.length > 0 ? (
                  <ResponsiveContainer>
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(value) => `${Number(value).toLocaleString()} đ`} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">Chưa có chi phí vật tư nào được ghi nhận từ PO</Typography>
                )}
              </Box>
            </Paper>
          </Box>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Đơn hàng mua vật tư liên kết
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Mã PO</TableCell>
                    <TableCell>Nhà cung cấp</TableCell>
                    <TableCell>Ngày đặt</TableCell>
                    <TableCell align="right">Tổng giá trị đơn</TableCell>
                    <TableCell align="right">Đã nhận hàng (Giá trị)</TableCell>
                    <TableCell>Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {financials.poList.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>{po.poNumber}</TableCell>
                      <TableCell>{po.supplier}</TableCell>
                      <TableCell>{po.orderDate}</TableCell>
                      <TableCell align="right">{po.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                      <TableCell align="right">{po.receivedAmount.toLocaleString('vi-VN')}đ</TableCell>
                      <TableCell>
                        <Chip
                          label={po.status === 'completed' ? 'Nhận đủ' : po.status === 'partial' ? 'Nhận 1 phần' : 'Đang chuyển'}
                          color={po.status === 'completed' ? 'success' : po.status === 'partial' ? 'warning' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {financials.poList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">Chưa phát sinh đơn hàng PO nào cho dự án này</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ==================== TAB 2: TỒN KHO & NHẬP XUẤT ==================== */}
      {tabValue === 2 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              So sánh lượng tồn kho vs Định mức & Tồn an toàn
            </Typography>
            <Box sx={{ width: '100%', height: 320, mt: 2 }}>
              {inventoryData.length > 0 ? (
                <ResponsiveContainer>
                  <RechartsBarChart data={inventoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip />
                    <Legend />
                    <Bar dataKey="Tồn thực tế" fill="#0088FE" />
                    <Bar dataKey="Mức an toàn" fill="#FFBB28" />
                    <Bar dataKey="Định mức" fill="#8884d8" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">Không tìm thấy vật tư nào trong kho của dự án này</Typography>
                </Box>
              )}
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Lịch sử giao dịch nhập/xuất kho ảo dự án
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Thời gian</TableCell>
                    <TableCell>Loại</TableCell>
                    <TableCell>Vật tư</TableCell>
                    <TableCell align="right">Số lượng</TableCell>
                    <TableCell>Nguồn</TableCell>
                    <TableCell>Đích</TableCell>
                    <TableCell>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projectTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>
                        <Chip
                          label={tx.type === 'in' ? 'Nhập kho' : tx.type === 'out' ? 'Xuất kho' : 'Chuyển kho'}
                          color={tx.type === 'in' ? 'success' : tx.type === 'out' ? 'warning' : 'primary'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell fontWeight="bold">{tx.material}</TableCell>
                      <TableCell align="right">{tx.quantity} {tx.unit}</TableCell>
                      <TableCell>{tx.from}</TableCell>
                      <TableCell>{tx.to}</TableCell>
                      <TableCell>{tx.note}</TableCell>
                    </TableRow>
                  ))}
                  {projectTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">Chưa phát sinh giao dịch xuất nhập kho nào</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ==================== TAB 3: TRỢ LÝ BÁO CÁO AI ==================== */}
      {tabValue === 3 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Card sx={{ borderLeft: '5px solid #1976d2' }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                  <AutoAwesomeIcon color="primary" /> Trợ lý Báo cáo Tóm tắt Nhật ký Tuần
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Trí tuệ nhân tạo sẽ tự động tổng hợp hàng trăm bản ghi nhật ký, phiếu hao hụt tồn kho và sự cố thi công của tuần qua.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={aiLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={handleGenerateAIReport}
                disabled={aiLoading || (currentUser.role !== 'TPKT' && currentUser.role !== 'Giám đốc' && currentUser.role !== 'Admin')}
              >
                {aiLoading ? 'AI Đang phân tích...' : 'Tạo báo cáo tuần bằng AI'}
              </Button>
            </CardContent>
          </Card>

          {/* AI Loader */}
          {aiLoading && (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fbfbfb', border: '1px dashed #ccc' }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body1" fontWeight="bold" color="primary">{aiStep}</Typography>
              <Typography variant="caption" color="text.secondary">Cung cấp bởi Gemini 2.5 Flash API</Typography>
            </Paper>
          )}

          {/* Render AI Result Card */}
          {aiReport && !aiLoading && (
            <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2, background: 'linear-gradient(to bottom, #ffffff, #fdfdfd)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" color="primary">{aiReport.projectName}</Typography>
                  <Typography variant="caption" color="text.secondary">Báo cáo tuần - Lập ngày: {aiReport.dateGenerated}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight="bold">Đánh giá chung từ AI:</Typography>
                  <Chip
                    label={aiReport.evaluation}
                    color={aiReport.evaluation === 'Tốt' ? 'success' : aiReport.evaluation === 'Trung bình' ? 'warning' : 'error'}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'grid', gap: 2.5 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" display="flex" alignItems="center" gap={0.5}>
                    <CheckCircleIcon color="success" fontSize="small" /> 1. TIẾN ĐỘ THI CÔNG
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 3 }}>
                    {aiReport.progressText}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" display="flex" alignItems="center" gap={0.5}>
                    <WarningIcon color="warning" fontSize="small" /> 2. RỦI RO & HAO HỤT VẬT TƯ
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 3 }}>
                    {aiReport.risksText}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" display="flex" alignItems="center" gap={0.5}>
                    <TrendingDownIcon color="error" fontSize="small" /> 3. DỰ BÁO TRỄ HẠN
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 3 }}>
                    {aiReport.alertsText}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.primary" display="flex" alignItems="center" gap={0.5}>
                    <ArrowForwardIcon color="primary" fontSize="small" /> 4. KHUYẾN NGHỊ HÀNH ĐỘNG
                  </Typography>
                  <Box component="ul" sx={{ mt: 0.5, pl: 5, fontSize: '0.875rem', color: 'text.secondary' }}>
                    {aiReport.suggestions.map((s: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{s}</li>
                    ))}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopyReport}
                >
                  {copied ? 'Đã copy!' : 'Copy báo cáo'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<GetAppIcon />}
                  onClick={() => window.print()}
                >
                  Xuất bản in PDF
                </Button>
              </Box>
            </Paper>
          )}

          {!aiReport && !aiLoading && (
            <Paper sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc' }}>
              <Typography color="text.secondary">Chưa tạo báo cáo AI. Hãy bấm nút phía trên để tổng hợp nhật ký.</Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
