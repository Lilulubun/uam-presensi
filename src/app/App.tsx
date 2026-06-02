import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { useAuthStore } from '../store/authStore';
import { useSessionStore } from '../store/sessionStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useTPAStore } from '../store/tpaStore';
import { useShallow } from 'zustand/react/shallow';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from '../pages/LoginPage';
import DashboardPengajar from '../pages/pengajar/DashboardPengajar';
import ScanPage from '../pages/pengajar/ScanPage';
import SessionActivePage from '../pages/pengajar/SessionActivePage';
import KonfirmasiPresensi from '../pages/pengajar/KonfirmasiPresensi';
import RiwayatPage from '../pages/pengajar/RiwayatPage';
import DashboardPengurus from '../pages/pengurus/DashboardPengurus';
import TPADetailPage from '../pages/pengurus/TPADetailPage';
import LaporanPage from '../pages/pengurus/LaporanPage';
import PengaturanPage from '../pages/pengurus/PengaturanPage';

export default function App() {
  useEffect(() => {
    useAuthStore.getState().init();
    useTPAStore.getState().init();
    useSessionStore.getState().init();
    useAttendanceStore.getState().init();
  }, []);
  const { isAuthenticated, user } = useAuthStore(
    useShallow((s) => ({ isAuthenticated: s.isAuthenticated, user: s.user }))
  );

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />

      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard'} replace />
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
              <Navigate to={user?.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Teacher routes */}
        <Route path="/pengajar/dashboard" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><DashboardPengajar /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/scan" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><ScanPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/session/:sessionId" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><SessionActivePage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/konfirmasi" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><KonfirmasiPresensi /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/riwayat" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><RiwayatPage /></ErrorBoundary></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/pengurus/dashboard" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><DashboardPengurus /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/tpa/:tpaId" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><TPADetailPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/laporan" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><LaporanPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/pengaturan" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PengaturanPage /></ErrorBoundary></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
