import { useState } from 'react';
import {
  Box,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
  Badge,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Inventory as InventoryIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Engineering as EngineeringIcon,
  Warehouse as WarehouseIcon,
  PendingActions as PendingActionsIcon,
  LocalShipping as LocalShippingIcon,
} from '@mui/icons-material';
import { ThemeProvider } from '@mui/material/styles';
import { muiTheme } from '@/styles/muiTheme';

// Import context và các component
import { AppProvider, useApp } from '@/context/AppContext';
import Dashboard from '@/pages/dashboard/Dashboard';
import ProjectManagement from '@/pages/projects/ProjectManagement';
import DailyLog from '@/pages/daily-log/DailyLog';
import MaterialControl from '@/pages/materials/MaterialControl';
import Inventory from '@/pages/inventory/Inventory';
import PurchaseOrders from '@/pages/purchase-orders/PurchaseOrders';
import Reports from '@/pages/reports/Reports';
import Login from '@/pages/login/Login';
import { Toaster } from '@/components/ui/sonner';

const drawerWidth = 260;

function AppContent() {
  const { currentUser, setCurrentUser, users, isAuthenticated, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (menu: string) => {
    setSelectedMenu(menu);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, key: 'dashboard' },
    { text: 'Quản lý dự án', icon: <FolderIcon />, key: 'projects' },
    { text: 'Nhật ký công trường', icon: <EngineeringIcon />, key: 'daily-log' },
    { text: 'Kiểm soát vật tư', icon: <InventoryIcon />, key: 'materials' },
    { text: 'Kho & Tồn kho', icon: <WarehouseIcon />, key: 'inventory' },
    { text: 'Đơn đặt hàng (PO)', icon: <LocalShippingIcon />, key: 'purchase-orders' },
    { text: 'Báo cáo', icon: <AssessmentIcon />, key: 'reports' },
    { text: 'Cài đặt', icon: <SettingsIcon />, key: 'settings' },
  ];

  const getPageTitle = () => {
    const item = menuItems.find((item) => item.key === selectedMenu);
    return item ? item.text : 'Tổng quan hệ thống';
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: '64px' }}>
        <Box sx={{ 
          p: 0.8, 
          bgcolor: 'secondary.main', 
          borderRadius: 1.5, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
        }}>
          <EngineeringIcon sx={{ color: '#0f172a', fontSize: '22px' }} />
        </Box>
        <Typography 
          variant="h6" 
          noWrap 
          component="div" 
          sx={{ 
            fontWeight: 800, 
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            letterSpacing: '-0.5px',
            color: '#ffffff' 
          }}
        >
          BPG Construction
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <List sx={{ px: 1, py: 1.5 }}>
        {menuItems.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={selectedMenu === item.key}
              onClick={() => handleMenuClick(item.key)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: selectedMenu === item.key ? 600 : 500
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  // Function để render content dựa trên menu được chọn
  const renderContent = () => {
    switch (selectedMenu) {
      case 'projects':
        return <ProjectManagement />;
      case 'daily-log':
        return <DailyLog />;
      case 'materials':
        return <MaterialControl />;
      case 'inventory':
        return <Inventory />;
      case 'purchase-orders':
        return <PurchaseOrders />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return (
          <Box>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Cài đặt
            </Typography>
            <Typography color="text.secondary">
              Chức năng đang được phát triển...
            </Typography>
          </Box>
        );
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          color: '#0f172a',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {getPageTitle()}
          </Typography>
          
          {/* Role Switcher */}
          <Box sx={{ mr: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
              Giả lập vai trò
            </Typography>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const selected = users.find(u => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                outline: 'none',
                color: '#0f172a',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s',
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === 'TPKT' ? 'Trưởng phòng KT' : u.role === 'Kỹ sư' ? 'Kỹ sư công trường' : u.role === 'Kế toán' ? 'Kế toán vật tư' : u.role === 'Giám đốc' ? 'Giám đốc' : u.role})
                </option>
              ))}
            </select>
          </Box>

          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={5} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton color="inherit" onClick={handleProfileMenuOpen}>
            <AccountCircleIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={handleProfileMenuClose}>Thông tin cá nhân</MenuItem>
            <MenuItem onClick={handleProfileMenuClose}>Đổi mật khẩu</MenuItem>
            <Divider />
            <MenuItem onClick={() => {
              handleProfileMenuClose();
              logout();
            }}>Đăng xuất</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Container maxWidth="xl">{renderContent()}</Container>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeProvider theme={muiTheme}>
        <AppContent />
      </ThemeProvider>
      <Toaster position="top-right" closeButton richColors />
    </AppProvider>
  );
}
