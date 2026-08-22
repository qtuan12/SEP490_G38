import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { LoadingProvider } from './context/LoadingContext';
import { FullScreenLoading } from './components/ui/FullScreenLoading';
import { Layout } from './components/layout/MainLayout';
import { isPWAMode, isPWAOptimizedRole } from './utils/pwaHelpers';
import { PWAProvider } from './context/PWAContext';
import { DesktopOnlyGuard } from './components/DesktopOnlyGuard';
import { RoleGroup } from './auth/roles';
import { useProjectAccess } from './hooks/useProjectAccess';
import { NotificationProvider } from './context/NotificationContext';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './context/ThemeContext';


// ─── Lazy-loaded page components ──────────────────────────────────────────────
// Auth pages (small, loaded early but still split)
const Login           = lazy(() => import('./pages/Auth/Login').then(m => ({ default: m.Login })));
const ForgotPassword  = lazy(() => import('./pages/Auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword   = lazy(() => import('./pages/Auth/ResetPassword').then(m => ({ default: m.ResetPassword })));

// Core app pages
const Dashboard       = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Profile         = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const NotificationsList = lazy(() => import('./pages/Notifications').then(m => ({ default: m.NotificationsList })));

// Field / PWA pages (critical for site engineers — loaded in a separate chunk)
const FieldWorkbench  = lazy(() => import('./pages/FieldWorkbench').then(m => ({ default: m.FieldWorkbench })));
const FieldTaskList   = lazy(() => import('./pages/FieldTaskList').then(m => ({ default: m.FieldTaskList })));

// User & master data management
const UserManagement      = lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const SupplierManagement  = lazy(() => import('./pages/SupplierManagement').then(m => ({ default: m.SupplierManagement })));
const UnitManagement      = lazy(() => import('./pages/MasterData/Units').then(m => ({ default: m.UnitManagement })));
const CategoryManagement  = lazy(() => import('./pages/MasterData/Categories').then(m => ({ default: m.CategoryManagement })));
const MaterialManagement  = lazy(() => import('./pages/MasterData/Materials').then(m => ({ default: m.MaterialManagement })));
const MaterialControl     = lazy(() => import('./pages/MaterialControl').then(m => ({ default: m.MaterialControl })));
const SystemConfigPage    = lazy(() => import('./pages/SystemConfig').then(m => ({ default: m.SystemConfigPage })));

// Project pages (largest chunk — split per page)
const ProjectList      = lazy(() => import('./pages/ProjectList').then(m => ({ default: m.ProjectList })));
const ProjectLayoutHub = lazy(() => import('./pages/ProjectLayoutHub').then(m => ({ default: m.ProjectLayoutHub })));
const ProjectDailyLogs = lazy(() => import('./pages/ProjectDailyLogs').then(m => ({ default: m.ProjectDailyLogs })));
const PhaseBOQ         = lazy(() => import('./pages/PhaseBOQ').then(m => ({ default: m.PhaseBOQ })));
const PhaseAcceptance  = lazy(() => import('./pages/PhaseAcceptance').then(m => ({ default: m.PhaseAcceptance })));
const PhaseAcceptances = lazy(() => import('./pages/PhaseAcceptances').then(m => ({ default: m.PhaseAcceptances })));
const GanttChart       = lazy(() => import('./pages/GanttChart').then(m => ({ default: m.GanttChart })));
const ProjectDrawing   = lazy(() => import('./pages/ProjectDrawing').then(m => ({ default: m.ProjectDrawing })));
const TaskDetailSE     = lazy(() => import('./pages/TaskDetailSE').then(m => ({ default: m.TaskDetailSE })));

// Purchase / Procurement
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrders').then(m => ({ default: m.PurchaseOrderList })));
const CreatePOPage      = lazy(() => import('./pages/PurchaseOrders/CreatePOPage').then(m => ({ default: m.CreatePOPage })));
const PODetailPage      = lazy(() => import('./pages/PurchaseOrders/PODetailPage').then(m => ({ default: m.PODetailPage })));
const DirectPurchaseList = lazy(() => import('./pages/DirectPurchases').then(m => ({ default: m.DirectPurchaseList })));

// Reports (heavyweight — desktop only, large charts)
const ReportsHub          = lazy(() => import('./pages/ReportsHub').then(m => ({ default: m.ReportsHub })));
const BoqVsActualReport   = lazy(() => import('./pages/Reports/BoqVsActualReport').then(m => ({ default: m.BoqVsActualReport })));
const CostReferenceReport = lazy(() => import('./pages/Reports/CostReferenceReport').then(m => ({ default: m.CostReferenceReport })));

// Misc
const InventoryAdjustmentsPage = lazy(() => import('./pages/InventoryAdjustments').then(m => ({ default: m.InventoryAdjustmentsPage })));

// ─── Route-level fallback spinner ─────────────────────────────────────────────
const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center gap-3 text-sm text-slate-500">
    <svg className="h-5 w-5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span>Đang tải trang...</span>
  </div>
);

// ─── Route Guards ─────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: readonly string[];
  noLayout?: boolean;
}> = ({ children, allowedRoles, noLayout }) => {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return <FullScreenLoading message="Đang kết nối hệ thống..." />;
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
  const { canViewProject, isLoading, isFetched } = useProjectAccess(projectId);

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isFetched && !canViewProject) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">
          Truy cập bị từ chối
        </h2>
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mb-6">
          Bạn không có quyền truy cập vào dự án này. Chỉ các thành viên thuộc dự án hoặc người có thẩm quyền mới có thể xem thông tin dự án.
        </p>
        <button
          onClick={() => window.location.href = '/projects'}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow transition-colors cursor-pointer"
        >
          Quay lại danh sách dự án
        </button>
      </div>
    );
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
  const { canViewProject, isLoading, isFetched } = useProjectAccess(projectId);

  if (projectId) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    if (isFetched && !canViewProject) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-[hsl(var(--text-primary))] mb-2">
            Truy cập bị từ chối
          </h2>
          <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mb-6">
            Bạn không có quyền truy cập vào dự án này.
          </p>
          <button
            onClick={() => window.location.href = '/projects'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow transition-colors cursor-pointer"
          >
            Quay lại danh sách dự án
          </button>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (!hasAnyRole(allowedRoles)) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
};

const FIELD_ROLES = ['technicalmanager', 'siteengineer'] as const;

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return <FullScreenLoading message="Đang tải dữ liệu..." />;
  }

  if (isAuthenticated) {
    if (isPWAMode()) {
      return <Navigate to={isPWAOptimizedRole(user?.role) ? '/field?standalone=true' : '/profile'} replace />;
    }
    if (hasAnyRole(RoleGroup.AdminOnly)) {
      return <Navigate to="/users" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CompanyProvider>
          <LoadingProvider>
          <AuthProvider>
            <NotificationProvider>
          <Router>
            <PWAProvider>
            {/* Global Error Boundary prevents White Screen of Death on render errors */}
            <GlobalErrorBoundary>
              {/* All page components are lazy-loaded — Suspense provides a fallback while the chunk downloads */}
              <Suspense fallback={<PageFallback />}>
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

              {/* Public routes */}
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
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <UnitManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/categories"
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
                    <CategoryManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/materials"
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.ProjectViewers}>
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
                element={<Navigate to="/projects" replace />}
              />

              <Route
                path="/projects/:projectId/reports/boq"
                element={
                  <ProtectedRoute allowedRoles={RoleGroup.Reports}>
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
                  <ProtectedRoute allowedRoles={RoleGroup.Accounting}>
                    <ProjectOrRoleRoute allowedRoles={RoleGroup.Accounting}>
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
                    <ProjectOrRoleRoute allowedRoles={RoleGroup.Reports}>
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
            </Suspense>
            </GlobalErrorBoundary>
            </PWAProvider>
          </Router>
        </NotificationProvider>
          </AuthProvider>
          </LoadingProvider>
        </CompanyProvider>
      </ThemeProvider>
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '12px',
            background: 'hsl(var(--bg-card, #ffffff))',
            color: 'hsl(var(--text-primary, #1e293b))',
            border: '1px solid hsl(var(--border, #e2e8f0))',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '12px 16px',
            maxWidth: '450px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#16a34a',
              secondary: '#ffffff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
