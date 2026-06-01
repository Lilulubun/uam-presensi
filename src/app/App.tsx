import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { useAuthStore } from '../store/authStore';
import { useSeedData } from './hooks/useSeedData';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import TeacherDashboard from '../pages/teacher/TeacherDashboard';
import ScanQRPage from '../pages/teacher/ScanQRPage';
import ActiveSessionPage from '../pages/teacher/ActiveSessionPage';
import AttendanceConfirmation from '../pages/teacher/AttendanceConfirmation';
import AttendanceHistoryPage from '../pages/teacher/AttendanceHistoryPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import TPADetailPage from '../pages/admin/TPADetailPage';
import ReportsPage from '../pages/admin/ReportsPage';
import SetupPage from '../pages/admin/SetupPage';

export default function App() {
  useSeedData();
  const { isAuthenticated, user } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />

      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'pengajar' ? '/teacher/dashboard' : '/admin/dashboard'} replace />
            ) : (
              <LoginPage />
            )
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'pengajar' ? '/teacher/dashboard' : '/admin/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Teacher routes */}
        <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['pengajar']}><TeacherDashboard /></ProtectedRoute>} />
        <Route path="/teacher/scan" element={<ProtectedRoute allowedRoles={['pengajar']}><ScanQRPage /></ProtectedRoute>} />
        <Route path="/teacher/session/:sessionId" element={<ProtectedRoute allowedRoles={['pengajar']}><ActiveSessionPage /></ProtectedRoute>} />
        <Route path="/teacher/confirmation" element={<ProtectedRoute allowedRoles={['pengajar']}><AttendanceConfirmation /></ProtectedRoute>} />
        <Route path="/teacher/history" element={<ProtectedRoute allowedRoles={['pengajar']}><AttendanceHistoryPage /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['pengurus']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/tpa/:tpaId" element={<ProtectedRoute allowedRoles={['pengurus']}><TPADetailPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['pengurus']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/admin/setup" element={<ProtectedRoute allowedRoles={['pengurus']}><SetupPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
