import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '../store/authStore';
import { useSessionStore } from '../store/sessionStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useTPAStore } from '../store/tpaStore';
import { useUsersStore } from '../store/userStore';
import { useShallow } from 'zustand/react/shallow';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import LoginPage from '../pages/LoginPage';
import DashboardPengajar from '../pages/pengajar/DashboardPengajar';
import ScanPage from '../pages/pengajar/ScanPage';
import SessionActivePage from '../pages/pengajar/SessionActivePage';
import KonfirmasiPresensi from '../pages/pengajar/KonfirmasiPresensi';
import RiwayatPage from '../pages/pengajar/RiwayatPage';
import IzinPage from '../pages/pengajar/IzinPage';
import DashboardPengurus from '../pages/pengurus/DashboardPengurus';
import TPADetailPage from '../pages/pengurus/TPADetailPage';
import DetailPengajar from '../pages/pengurus/DetailPengajar';
import LaporanPage from '../pages/pengurus/LaporanPage';
import PengaturanPage from '../pages/pengurus/PengaturanPage';
import KelolaPengajarPage from '../pages/pengurus/kelola-pengajar';
import ProfilePage from '../pages/profile';
import RiwayatIzinPengurus from '../pages/pengurus/RiwayatIzinPengurus';

export default function App() {
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    const safe = <T,>(p: Promise<T>) => p.catch((e) => console.error('store init:', e));
    // Auth harus selesai dulu sebelum store lain di-fetch
    // karena semua tabel pakai RLS auth.role() = 'authenticated'
    safe(useAuthStore.getState().init()).then(() =>
      Promise.all([
        safe(useTPAStore.getState().init()),
        safe(useSessionStore.getState().init()),
        safe(useAttendanceStore.getState().init()),
        safe(useUsersStore.getState().init()),
      ])
    ).then(() => setStoresReady(true));
  }, []);
  const { isAuthenticated, user } = useAuthStore(
    useShallow((s) => ({ isAuthenticated: s.isAuthenticated, user: s.user }))
  );

  // Re-fetch semua store data setiap kali isAuthenticated berubah jadi true
  // (login baru, session restore, atau tab refocus setelah logout-login)
  useEffect(() => {
    if (!isAuthenticated) return;
    const safe = <T,>(p: Promise<T>) => p.catch((e) => console.error('store refresh:', e));
    Promise.all([
      safe(useTPAStore.getState().init()),
      safe(useSessionStore.getState().init()),
      safe(useAttendanceStore.getState().init()),
      safe(useUsersStore.getState().init()),
    ]);
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />

      {!storesReady ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      ) : (
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard'} replace />
            ) : (
              <PageTransition><LoginPage /></PageTransition>
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
        <Route path="/pengajar/dashboard" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><DashboardPengajar /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/scan" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><ScanPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/session/:sessionId" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><SessionActivePage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/konfirmasi" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><KonfirmasiPresensi /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/riwayat" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><RiwayatPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengajar/izin" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><PageTransition><IzinPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/pengurus/dashboard" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><DashboardPengurus /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/tpa/:tpaId" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><TPADetailPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/pengajar/:userId" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><DetailPengajar /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/laporan" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><LaporanPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/pengaturan" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><PengaturanPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/kelola-pengajar" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><KelolaPengajarPage /></PageTransition></ErrorBoundary></ProtectedRoute>} />
        <Route path="/pengurus/riwayat-izin" element={<ProtectedRoute allowedRoles={['pengurus']}><ErrorBoundary><PageTransition><RiwayatIzinPengurus /></PageTransition></ErrorBoundary></ProtectedRoute>} />

        {/* Profile (both roles) */}
        <Route path="/profile" element={<ProtectedRoute allowedRoles={['pengajar', 'pengurus']}><ErrorBoundary><PageTransition><ProfilePage /></PageTransition></ErrorBoundary></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      )}
    </BrowserRouter>
  );
}
