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
import { FieldTaskList } from './pages/FieldTaskList';
import { isPWAMode } from './utils/pwaHelpers';
import { DesktopOnlyGuard } from './components/DesktopOnlyGuard';
import { RoleGroup } from './auth/roles';

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
  allowedRoles?: readonly string[];
  noLayout?: boolean;
}> = ({ children, allowedRoles, noLayout }) => {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();

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

  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return noLayout ? <>{children}</> : <Layout>{children}</Layout>;
};

const ProjectRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { projectId } = useParams();

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

const ProjectOrRoleRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: readonly string[];
}> = ({ children, allowedRoles }) => {
  const { hasAnyRole } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  if (projectId) {
    return <>{children}</>;
  }

  if (!hasAnyRole(allowedRoles)) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

// Route wrapper for redirecting authenticated users away from Login page
const FIELD_ROLES = ['technicalmanager', 'siteengineer'] as const;

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--bg-main))' }}>
        <h3 style={{ color: 'hsl(var(--text-primary))' }}>Đang tải...</h3>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isPWAMode() && user?.role && (FIELD_ROLES as readonly string[]).includes(user.role)) {
      return <Navigate to="/field?standalone=true" replace />;
    }
    if (hasAnyRole(RoleGroup.AdminOnly)) {
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
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
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
                  <ProtectedRoute allowedRoles={FIELD_ROLES}>
                    <FieldWorkbench />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/field/tasks"
                element={
                  <ProtectedRoute allowedRoles={FIELD_ROLES}>
                    <FieldTaskList />
                  </ProtectedRoute>
                }
              />

              <Route 
                path="/users" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.AdminOnly}>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/suppliers" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.SupplierViewers}>
                    <SupplierManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/units" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.MasterData}>
                    <UnitManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/categories" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.MasterData}>
                    <CategoryManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/materials" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.MasterData}>
                    <MaterialManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/materials-control" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Procurement}>
                    <MaterialControl />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <ProjectLayoutHub />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/logs" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <ProjectDailyLogs />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/tasks/:taskId/logs" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <ProjectDailyLogs />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/boq" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <PhaseBOQ />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/acceptance" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <PhaseAcceptance />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/gantt" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <DesktopOnlyGuard>
                        <GanttChart />
                      </DesktopOnlyGuard>
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/drawing" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <ProjectDrawing />
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Reports}>
                    <DesktopOnlyGuard>
                      <ReportsHub />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                } 
              />

              <Route
                path="/incidents"
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <GlobalIncidents />
                  </ProtectedRoute>
                }
              />

              <Route 
                path="/projects/:projectId/reports/boq" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectRoute>
                      <DesktopOnlyGuard>
                        <BoqVsActualReport />
                      </DesktopOnlyGuard>
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/reports/cost" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Reports}>
                    <ProjectRoute>
                      <DesktopOnlyGuard>
                        <CostReferenceReport />
                      </DesktopOnlyGuard>
                    </ProjectRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/tasks/:taskId" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <TaskDetailSE />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Procurement}>
                    <PurchaseOrderList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders/new" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Procurement}>
                    <ProjectOrRoleRoute
                      allowedRoles={RoleGroup.Procurement}
                    >
                      <CreatePOPage />
                    </ProjectOrRoleRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/purchase-orders/:id" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <PODetailPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/direct-purchases" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <DirectPurchaseList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/system-config" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.AdminOnly}>
                    <DesktopOnlyGuard>
                      <SystemConfigPage />
                    </DesktopOnlyGuard>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/phase-acceptances" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <ProjectOrRoleRoute
                      allowedRoles={RoleGroup.Reports}
                    >
                      <PhaseAcceptances />
                    </ProjectOrRoleRoute>
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/inventory-adjustments" 
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
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

