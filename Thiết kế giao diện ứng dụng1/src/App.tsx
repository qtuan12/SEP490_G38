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
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          BPG Construction
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.key} disablePadding>
            <ListItemButton
              selected={selectedMenu === item.key}
              onClick={() => handleMenuClick(item.key)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
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
          backgroundColor: '#fff',
          color: '#1a1a1a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getPageTitle()}
          </Typography>
          
          {/* Role Switcher */}
          <Box sx={{ mr: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px', mb: 0.2 }}>
              Đang giả lập vai trò
            </Typography>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const selected = users.find(u => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: '#f8f9fa',
                cursor: 'pointer',
                outline: 'none',
                color: '#1a1a1a',
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
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
          backgroundColor: '#f5f5f5',
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
      <AppContent />
      <Toaster position="top-right" closeButton richColors />
    </AppProvider>
  );
}
