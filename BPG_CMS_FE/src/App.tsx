import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { Layout } from './components/layout/MainLayout';
import { Login } from './pages/Auth/Login';
import { PhaseAcceptances } from './pages/PhaseAcceptances';
import { Dashboard } from './pages/Dashboard';
import { UserManagement } from './pages/UserManagement';
import { SupplierManagement } from './pages/SupplierManagement';
import { ForgotPassword } from './pages/Auth/ForgotPassword';
import { ResetPassword } from './pages/Auth/ResetPassword';
import { Profile } from './pages/Profile';
import { ProjectList } from './pages/ProjectList';
import { ProjectLayoutHub } from './pages/ProjectLayoutHub';
import { TaskDetailSE } from './pages/TaskDetailSE';
import { PhaseAcceptance } from './pages/PhaseAcceptance';
import { PhaseBOQ } from './pages/PhaseBOQ';
import { UnitManagement } from './pages/MasterData/Units';
import { CategoryManagement } from './pages/MasterData/Categories';
import { MaterialManagement } from './pages/MasterData/Materials';
import { GanttChart } from './pages/GanttChart';
import { ProjectDrawing } from './pages/ProjectDrawing';
import { ProjectDailyLogs } from './pages/ProjectDailyLogs';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationsList } from './pages/Notifications';
import { InventoryAdjustmentsPage } from './pages/InventoryAdjustments';
import { BoqVsActualReport } from './pages/Reports/BoqVsActualReport';
import { CostReferenceReport } from './pages/Reports/CostReferenceReport';
import { GlobalIncidents } from './pages/GlobalIncidents';
import { MaterialControl } from './pages/MaterialControl';
import { PurchaseOrderList } from './pages/PurchaseOrders';
import { CreatePOPage } from './pages/PurchaseOrders/CreatePOPage';
import { PODetailPage } from './pages/PurchaseOrders/PODetailPage';
import { SystemConfigPage } from './pages/SystemConfig';
import { DirectPurchaseList } from './pages/DirectPurchases';
import { ReportsHub } from './pages/ReportsHub';
import { FieldWorkbench } from './pages/FieldWorkbench';
import { isPWAMode } from './utils/pwaHelpers';
import { DesktopOnlyGuard } from './components/DesktopOnlyGuard';
import { ProjectPermission, SystemPermission } from './auth/permissions';
import type { ProjectPermissionValue, SystemPermissionValue } from './auth/permissions';
import { useProjectAccess } from './hooks/useProjectAccess';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Guard
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredPermission?: SystemPermissionValue;
  noLayout?: boolean;
}> = ({ children, requiredPermission, noLayout }) => {
  const { isAuthenticated, isLoading, hasSystemPermission } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'hsl(var(--bg-main))',
        color: 'hsl(var(--text-primary))'
      }}>
        <h3>Đang tải phiên làm việc...</h3>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasSystemPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return noLayout ? <>{children}</> : <Layout>{children}</Layout>;
};

const ProjectPermissionRoute: React.FC<{
  children: React.ReactNode;
  permission?: ProjectPermissionValue;
}> = ({ children, permission = ProjectPermission.View }) => {
  const { projectId } = useParams();
  const { isLoading, isError, hasProjectPermission } = useProjectAccess(projectId);

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <span>Đang tải quyền dự án...</span>
      </div>
    );
  }

  if (!projectId || isError || !hasProjectPermission(permission)) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

const ProjectOrSystemPermissionRoute: React.FC<{
  children: React.ReactNode;
  systemPermission: SystemPermissionValue;
  projectPermission: ProjectPermissionValue;
}> = ({ children, systemPermission, projectPermission }) => {
  const { hasSystemPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const hasSystemAccess = hasSystemPermission(systemPermission);
  const { isLoading, isError, hasProjectPermission } = useProjectAccess(projectId);

  if (projectId && isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <span>Đang tải quyền dự án...</span>
      </div>
    );
  }

  if (projectId) {
    return isError || !hasProjectPermission(projectPermission)
      ? <Navigate to="/projects" replace />
      : <>{children}</>;
  }

  if (!hasSystemAccess) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

// Route wrapper for redirecting authenticated users away from Login page
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, hasSystemPermission } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--bg-main))' }}>
        <h3 style={{ color: 'hsl(var(--text-primary))' }}>Đang tải...</h3>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isPWAMode()) {
      return <Navigate to="/field?standalone=true" replace />;
    }
    if (hasSystemPermission(SystemPermission.UsersManage)) {
      return <Navigate to="/users" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              {/* Root route */}
              <Route 
                path="/" 
                element={
                  <PublicRoute>
                    <Navigate to="/field?standalone=true" replace />
                  </PublicRoute>
                } 
              />

              {/* Public login route */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />

              <Route 
                path="/forgot-password" 
                element={
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                } 
              />

              <Route 
                path="/reset-password" 
                element={
                  <PublicRoute>
                    <ResetPassword />
                  </PublicRoute>
                } 
              />

              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />

              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsList />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/field"
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ProjectsList}>
                    <FieldWorkbench />
                  </ProtectedRoute>
                }
              />

              <Route 
                path="/users" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.UsersManage}>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/suppliers" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.SuppliersView}>
                    <SupplierManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/units" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.MasterDataManage}>
                    <UnitManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/categories" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.MasterDataManage}>
                    <CategoryManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/materials" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.MasterDataManage}>
                    <MaterialManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/materials-control" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ProcurementManage}>
                    <MaterialControl />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ProjectsList}>
                    <ProjectList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <ProjectLayoutHub />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/logs" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <ProjectDailyLogs />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/tasks/:taskId/logs" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <ProjectDailyLogs />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/boq" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <PhaseBOQ />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/acceptance" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <PhaseAcceptance />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/gantt" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <DesktopOnlyGuard>
                        <GanttChart />
                      </DesktopOnlyGuard>
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/drawing" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute>
                      <ProjectDrawing />
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ReportsView}>
                    <DesktopOnlyGuard>
                      <ReportsHub />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/incidents" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ReportsView}>
                    <GlobalIncidents />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/reports/boq" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute permission={ProjectPermission.ReportsView}>
                      <DesktopOnlyGuard>
                        <BoqVsActualReport />
                      </DesktopOnlyGuard>
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/reports/cost" 
                element={
                  <ProtectedRoute>
                    <ProjectPermissionRoute permission={ProjectPermission.ReportsView}>
                      <DesktopOnlyGuard>
                        <CostReferenceReport />
                      </DesktopOnlyGuard>
                    </ProjectPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/tasks/:taskId" 
                element={
                  <ProtectedRoute>
                    <TaskDetailSE />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ProcurementManage}>
                    <PurchaseOrderList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders/new" 
                element={
                  <ProtectedRoute>
                    <ProjectOrSystemPermissionRoute
                      systemPermission={SystemPermission.ProcurementManage}
                      projectPermission={ProjectPermission.AccountingManage}
                    >
                      <CreatePOPage />
                    </ProjectOrSystemPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders/:id" 
                element={
                  <ProtectedRoute>
                    <PODetailPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/direct-purchases" 
                element={
                  <ProtectedRoute>
                    <DirectPurchaseList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/system-config" 
                element={
                  <ProtectedRoute requiredPermission={SystemPermission.ConfigurationManage}>
                    <DesktopOnlyGuard>
                      <SystemConfigPage />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/phase-acceptances" 
                element={
                  <ProtectedRoute>
                    <ProjectOrSystemPermissionRoute
                      systemPermission={SystemPermission.ReportsView}
                      projectPermission={ProjectPermission.View}
                    >
                      <PhaseAcceptances />
                    </ProjectOrSystemPermissionRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/inventory-adjustments" 
                element={
                  <ProtectedRoute>
                    <InventoryAdjustmentsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
      </CompanyProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
