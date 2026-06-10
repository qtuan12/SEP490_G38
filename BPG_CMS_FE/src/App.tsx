import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UserManagement } from './pages/UserManagement';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Profile } from './pages/Profile';
import { ProjectList } from './pages/ProjectList';
import { ProjectLayoutHub } from './pages/ProjectLayoutHub';
import { TaskDetailSE } from './pages/TaskDetailSE';
import { PhaseAcceptance } from './pages/PhaseAcceptance';
import { GanttChart } from './pages/GanttChart';
import { ProjectDrawing } from './pages/ProjectDrawing';
import { ProjectDailyLogs } from './pages/ProjectDailyLogs';
import { TaskIncidents } from './pages/TaskIncidents';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
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

  return <Layout>{children}</Layout>;
};

// Route wrapper for redirecting authenticated users away from Login page
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Let the protected route handle loading state
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
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
            path="/users" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <ProjectList />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <ProjectLayoutHub />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId/logs" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <ProjectDailyLogs />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId/tasks/:taskId/incidents" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <TaskIncidents />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId/phases/:phaseId/acceptance" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt']}>
                <PhaseAcceptance />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId/gantt" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <GanttChart />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/projects/:projectId/drawing" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư', 'giám đốc']}>
                <ProjectDrawing />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/tasks/:taskId" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'tpkt', 'kỹ sư']}>
                <TaskDetailSE />
              </ProtectedRoute>
            } 
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
