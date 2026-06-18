import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/MainLayout';
import { Login } from './pages/Auth/Login';
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
import { UnitManagement } from './pages/MasterData/Units';
import { CategoryManagement } from './pages/MasterData/Categories';
import { MaterialManagement } from './pages/MasterData/Materials';
import { GanttChart } from './pages/GanttChart';
import { ProjectDrawing } from './pages/ProjectDrawing';
import { ProjectDailyLogs } from './pages/ProjectDailyLogs';
import { TaskIncidents } from './pages/TaskIncidents';
import { PhaseMaterialRequests } from './pages/MaterialRequests';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationsList } from './pages/Notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[]; noLayout?: boolean }> = ({ children, allowedRoles, noLayout }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

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

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If not authorized for this specific route, send to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return noLayout ? <>{children}</> : <Layout>{children}</Layout>;
};

// Route wrapper for redirecting authenticated users away from Login page
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--bg-main))' }}>
        <h3 style={{ color: 'hsl(var(--text-primary))' }}>Đang tải...</h3>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
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
                path="/users" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/suppliers" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SupplierManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/units" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager']}>
                    <UnitManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/categories" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager']}>
                    <CategoryManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/materials" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'projectleader', 'siteengineer', 'director', 'accountant']}>
                    <MaterialManagement />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <ProjectList />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <ProjectLayoutHub />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/logs" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <ProjectDailyLogs />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/tasks/:taskId/logs" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <ProjectDailyLogs />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/tasks/:taskId/incidents" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <TaskIncidents />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/material-requests" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director', 'accountant']} noLayout>
                    <PhaseMaterialRequests />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/phases/:phaseId/acceptance" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager']}>
                    <PhaseAcceptance />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/gantt" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <GanttChart />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/projects/:projectId/drawing" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer', 'director']}>
                    <ProjectDrawing />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/tasks/:taskId" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'technicalmanager', 'siteengineer']}>
                    <TaskDetailSE />
                  </ProtectedRoute>
                } 
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
