import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { useAuthStore } from '../store/authStore';
import { useSeedData } from './hooks/useSeedData';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPengajar from '../pages/pengajar/DashboardPengajar';
import ScanPage from '../pages/pengajar/ScanPage';
import SessionActivePage from '../pages/pengajar/SessionActivePage';
import KonfirmasiPresensi from '../pages/pengajar/KonfirmasiPresensi';
import RiwayatPage from '../pages/pengajar/RiwayatPage';
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
              <Navigate to={user?.role === 'pengajar' ? '/pengajar/dashboard' : '/admin/dashboard'} replace />
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
              <Navigate to={user?.role === 'pengajar' ? '/pengajar/dashboard' : '/admin/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Teacher routes */}
        <Route path="/pengajar/dashboard" element={<ProtectedRoute allowedRoles={['pengajar']}><DashboardPengajar /></ProtectedRoute>} />
        <Route path="/pengajar/scan" element={<ProtectedRoute allowedRoles={['pengajar']}><ScanPage /></ProtectedRoute>} />
        <Route path="/pengajar/session/:sessionId" element={<ProtectedRoute allowedRoles={['pengajar']}><SessionActivePage /></ProtectedRoute>} />
        <Route path="/pengajar/konfirmasi" element={<ProtectedRoute allowedRoles={['pengajar']}><KonfirmasiPresensi /></ProtectedRoute>} />
        <Route path="/pengajar/riwayat" element={<ProtectedRoute allowedRoles={['pengajar']}><RiwayatPage /></ProtectedRoute>} />

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
