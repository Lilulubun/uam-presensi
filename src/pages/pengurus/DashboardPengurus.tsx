import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, BarChart2, QrCode, Users, Clock, TrendingUp, User, FileText, CheckCircle, XCircle, History, ChevronRight, Home } from 'lucide-react';
import { toast } from 'sonner';
import { useIzinStore } from '../../store/izinStore';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../app/components/ui/line-chart';
import {
  LineChart,
  Line,
} from 'recharts';
import { Button } from '../../app/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../app/components/ui/alert-dialog';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useTPAStore } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { useRealtimeSessions } from '../../app/hooks/useRealtimeSessions';
import { formatTime, isSameDay, formatDayName, formatDateIdShort, formatDateId, toJakartaMonth } from '../../lib/date-utils';
import { computeInactiveAlert } from '../../lib/computeInactiveAlert';
import { AvatarOrb } from '../../lib/avatar-orb';

const chartConfig = {
  tepatWaktu: {
    label: "Tepat Waktu",
    color: "#6FCB6A",
  },
  terlambat: {
    label: "Terlambat",
    color: "#F2B84B",
  },
} satisfies ChartConfig;

const sidebarNav = [
  { href: '/pengurus', label: 'Dashboard', icon: BarChart2 },
  { href: '/pengurus/kelola-pengajar', label: 'Pengajar', icon: Users },
  { href: '/pengurus/laporan', label: 'Laporan', icon: FileText },
  { href: '/pengurus/pengaturan', label: 'Setup QR', icon: QrCode },
];

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-[#1A1A18]/10 ${className}`} />;
}

export default function DashboardPengurus() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionStore((s) => s.sessions);
  const sessionLoading = useSessionStore((s) => s.loading);
  const attendances = useAttendanceStore((s) => s.attendances);
  const attendanceLoading = useAttendanceStore((s) => s.loading);
  const tpas = useTPAStore((s) => s.tpas);
  const tpaLoading = useTPAStore((s) => s.loading);
  const users = useUsersStore((s) => s.users);
  const userLoading = useUsersStore((s) => s.loading);

  useRealtimeSessions();

  const { pendingIzins, approveIzin, rejectIzin, fetchPendingIzins } = useIzinStore();
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingIzins();
  }, [fetchPendingIzins]);

  const today = new Date();

  const activeSessions = sessions.filter((s) => s.isActive);
  const todayAttendances = attendances.filter((a) => {
    const t = a.scanInTime ?? a.scanOutTime;
    return t && isSameDay(new Date(t), today);
  });
  const lateToday = todayAttendances.filter((a) => a.isLate);
  const isLoading = tpaLoading || sessionLoading || attendanceLoading || userLoading;

  const getTPAStats = (tpaId: string) => {
    const activeSession = sessions.find((s) => s.tpaId === tpaId && s.isActive);
    const todaySession = sessions.find(
      (s) => s.tpaId === tpaId && isSameDay(new Date(s.dateOpened), today)
    );
    const refSession = activeSession ?? todaySession;
    const presentCount = refSession
      ? attendances.filter((a) => a.sessionId === refSession.id && a.scanInTime).length
      : 0;
    return { activeSession, presentCount };
  };

  const weeklyChartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayAttendances = attendances.filter((a) => {
        const t = a.scanInTime;
        return t && isSameDay(new Date(t), d);
      });

      days.push({
        day: formatDayName(d),
        tepatWaktu: dayAttendances.filter((a) => !a.isLate).length,
        terlambat: dayAttendances.filter((a) => a.isLate).length,
      });
    }
    return days;
  }, [attendances]);

  const totalThisMonth = useMemo(() => {
    const currentMonth = toJakartaMonth(new Date());
    return attendances.filter((a) => {
      const t = a.scanInTime;
      if (!t) return false;
      return toJakartaMonth(new Date(t)) === currentMonth;
    }).length;
  }, [attendances]);

  const metricStats = useMemo(() => {
    const currentMonth = toJakartaMonth(new Date());
    const monthAtt = attendances.filter((a) => {
      const t = a.scanInTime;
      return t && toJakartaMonth(new Date(t)) === currentMonth;
    });
    const lateOnes = monthAtt.filter((a) => a.isLate && a.lateMinutes);
    const avgLate = lateOnes.length > 0
      ? Math.round(lateOnes.reduce((s, a) => s + (a.lateMinutes ?? 0), 0) / lateOnes.length)
      : 0;
    const onTimeRate = monthAtt.length > 0
      ? Math.round((monthAtt.filter((a) => !a.isLate).length / monthAtt.length) * 100)
      : 0;
    const activeTpaCount = tpas.filter((t) =>
      sessions.some((s) => s.tpaId === t.id && s.isActive)
    ).length;
    return { avgLate, onTimeRate, activeTpaCount };
  }, [attendances, tpas, sessions]);

  const teacherStats = useMemo(() => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recent = attendances.filter(
      (a) => a.scanInTime && new Date(a.scanInTime).getTime() > cutoff
    );
    const userMap = new Map(users.map((u) => [u.id, u]));
    const userIds = [...new Set(recent.map((a) => a.userId))];
    return userIds
      .map((id) => {
        const u = userMap.get(id);
        const myAttendances = recent.filter((a) => a.userId === id && a.scanInTime);
        const onTime = myAttendances.filter((a) => !a.isLate).length;
        const late = myAttendances.filter((a) => a.isLate).length;
        const total = myAttendances.length;
        const rate = total > 0 ? Math.round((onTime / total) * 100) : 0;
        const status = computeInactiveAlert(attendances, id, 14);
        return {
          teacher: { id, name: u?.name ?? '(tidak dikenal)', nim: u?.nim },
          total, onTime, late, rate, status,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [attendances, users]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18]">
      <header className="bg-white/80 backdrop-blur-[20px] border-b border-[#EAEAE7] sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto flex justify-between items-center gap-4 px-4 sm:px-6 lg:px-8 py-4">
          <div>
            <h1 className="font-semibold text-[22px] tracking-tight">Monitoring Presensi</h1>
            <p className="text-[13px] text-[#A3A39D] flex items-center gap-1.5 mt-0.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Realtime Overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Nav buttons: mobile only — sidebar handles desktop */}
            <div className="flex items-center gap-2 lg:hidden">
              {location.pathname !== '/pengurus' && (
                <Button variant="outline" className="h-9 w-9 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] p-0" onClick={() => navigate('/pengurus')}>
                  <Home className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
                </Button>
              )}
              <Button variant="outline" className="h-9 w-9 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] p-0" onClick={() => navigate('/pengurus/pengaturan')}>
                <QrCode className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              </Button>
              <Button variant="outline" className="h-9 w-9 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] p-0" onClick={() => navigate('/pengurus/laporan')}>
                <BarChart2 className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              </Button>
              <Button variant="outline" className="h-9 w-9 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] p-0" onClick={() => navigate('/pengurus/kelola-pengajar')}>
                <Users className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              </Button>
            </div>

            <div className="w-[1px] h-6 bg-[#EAEAE7] mx-1"></div>

            <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center text-[#6B6B66] hover:text-[#1A1A18] transition-colors active:scale-[0.97] transition-transform duration-100 ease-out">
              <User className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center text-[#6B6B66] hover:text-[#1A1A18] transition-colors active:scale-[0.97] transition-transform duration-100 ease-out">
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-[1440px] mx-auto">
        {/* Sidebar — lg+ only, full height, flush left */}
        <aside className="hidden lg:flex flex-col w-[220px] shrink-0 pt-6 px-3 pb-12 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto shadow-[1px_0_0_0_#EAEAE7] bg-white/80 backdrop-blur-[20px] backdrop-saturate-[180%]">
          <nav className="flex flex-col gap-0.5">
            {sidebarNav.map(({ href, label, icon: Icon }) => {
              const active = location.pathname === href || (href !== '/pengurus' && location.pathname.startsWith(href));
              const badge =
                href === '/pengurus' ? todayAttendances.length :
                href === '/pengurus/kelola-pengajar' ? pendingIzins.length :
                null;
              return (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-[13px] font-medium transition-colors active:scale-[0.97] transition-transform duration-100 ease-out text-left w-full ${
                    active
                      ? 'bg-[#EAEAE7] text-[#1A1A18]'
                      : 'text-[#6B6B66] hover:bg-[#F4F4F2] hover:text-[#1A1A18]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{label}</span>
                  {badge !== null && badge > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D7FF3D] text-[#1A1A18] leading-none">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-10 pt-8 pb-12 flex flex-col gap-8">
        
        {/* HERO ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card A: Green Mesh */}
          <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] min-h-[180px] flex flex-col justify-between border border-[#EAEAE7]" style={{ background: 'radial-gradient(circle at 30% 20%, #C8F06B, #8FE388 55%, #F4F08A)' }}>
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>

            <div className="flex justify-between items-start z-10">
              <p className="text-[13px] font-medium text-[#1A1A18]/60">Hadir hari ini</p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/60 text-[#1A1A18]">
                On Track
              </span>
            </div>

            <div className="z-10 mt-4">
              <p className="text-[40px] sm:text-[52px] font-light leading-[1.1] tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>
                {isLoading ? <SkeletonPulse className="w-16 h-10 mt-1" /> : todayAttendances.length}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {isLoading ? <SkeletonPulse className="w-20 h-3.5" /> : <span className="text-[13px] text-[#1A1A18]/55">{lateToday.length} terlambat</span>}
              </div>
            </div>

            {/* Dot matrix motif */}
            <div
              className="absolute bottom-0 right-0 w-28 h-28 opacity-[0.12] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #1A1A18 1px, transparent 1px)',
                backgroundSize: '10px 10px'
              }}
            />
          </div>

          {/* Card B: Powder Blue Mesh */}
          <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] min-h-[180px] flex flex-col justify-between border border-[#EAEAE7]" style={{ background: 'radial-gradient(circle at 70% 20%, #BFDBFE, #BAE6FD 50%, #A5F3FC)' }}>
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>

            <div className="flex justify-between items-start z-10">
              <p className="text-[13px] font-medium text-[#1A1A18]/70">Sesi aktif</p>
              {activeSessions.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#1A1A18]/10 text-[#1A1A18]">
                  Live
                </span>
              )}
            </div>

            <div className="z-10 mt-4">
              <p className="text-[40px] sm:text-[52px] font-light leading-[1.1] tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>
                {isLoading ? <SkeletonPulse className="w-10 h-10 mt-1" /> : activeSessions.length}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[13px] text-[#1A1A18]/60">Dari {tpas.length} Lokasi TPA</span>
              </div>
            </div>

            {/* Sparkline motif */}
            <div className="absolute bottom-6 right-6 opacity-30">
              <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                <path d="M0 15 Q 10 5, 20 12 T 40 8 T 60 2" stroke="#1A1A18" strokeWidth="1.5" strokeDasharray="4 2" fill="none"/>
              </svg>
            </div>
          </div>

          {/* Card C: Blush Rose Glass */}
          <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] min-h-[180px] flex flex-col justify-between border border-[#EAEAE7]" style={{ background: 'radial-gradient(circle at 70% 30%, #FFF1F2, #FFE4E6 50%, #FECDD3)' }}>
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>

            <div className="flex justify-between items-start z-10">
              <p className="text-[13px] font-medium text-[#1A1A18]/65">Izin pending</p>
              {pendingIzins.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1A1A18]/10 text-[#1A1A18]">
                  Menunggu
                </span>
              )}
            </div>
            
            <div className="z-10 mt-4">
              <p className="text-[40px] sm:text-[52px] font-light leading-[1.1] tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>
                {isLoading ? <SkeletonPulse className="w-10 h-10 mt-1" /> : pendingIzins.length}
              </p>
              <p className="text-[13px] text-[#1A1A18]/55 mt-1">Permintaan izin masuk</p>
            </div>
            
            <button 
              onClick={() => navigate('/pengurus/riwayat-izin')}
              className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-[#1A1A18]/5 hover:bg-[#1A1A18]/10 flex items-center justify-center text-[#1A1A18] transition-colors active:scale-[0.97] transition-transform duration-100 ease-out z-10"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* IZIN PENDING SECTION */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#D7FF3D]" strokeWidth={1.5} />
              <h2 className="text-[15px] font-medium tracking-tight">Izin Pending</h2>
            </div>
            <div className="flex items-center gap-3">
              {pendingIzins.length > 0 && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EFFFC2] text-[#1A1A18] ring-1 ring-inset ring-[#D7FF3D]/30">
                  {pendingIzins.length} menunggu
                </span>
              )}
              <button
                onClick={() => navigate('/pengurus/riwayat-izin')}
                className="text-[11px] font-medium text-[#6B6B66] hover:text-[#1A1A18] flex items-center gap-1 active:scale-[0.97] transition-transform duration-100 ease-out"
              >
                <History className="w-3.5 h-3.5" strokeWidth={1.5} />
                Riwayat
              </button>
            </div>
          </div>
          {pendingIzins.length > 0 ? (
            <ul className="divide-y divide-[#EAEAE7]">
              {pendingIzins.map((izin) => (
                  <li key={izin.id} className="px-6 py-4 hover:bg-[#F7F7F5] transition-colors motion-safe:starting:opacity-0 motion-safe:starting:translate-y-2 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[#1A1A18]">{izin.userName}</p>
                        <p className="text-[12px] text-[#A3A39D] mt-0.5">
                          {formatDateIdShort(izin.startDate)} – {formatDateId(izin.endDate)}
                        </p>
                        <p className="text-[12px] text-[#6B6B66] mt-1 line-clamp-2">{izin.alasan}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              className="h-9 rounded-[12px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#C5E835] text-[12px] font-medium"
                              disabled={processingId !== null}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                              Setujui
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Setujui izin?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Izin dari {izin.userName} akan disetujui. Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={processingId !== null}>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={processingId !== null}
                                onClick={async () => {
                                  setProcessingId(izin.id);
                                  const r = await approveIzin(izin.id);
                                  setProcessingId(null);
                                  if (r.valid) toast.success(r.message);
                                  else toast.error(r.message);
                                }}
                              >
                                Setujui
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-[12px] border-[#EAEAE7] text-[#6B6B66] hover:border-[#D7FF3D] hover:text-[#1A1A18] text-[12px] font-medium"
                              disabled={processingId !== null}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                              Tolak
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Tolak izin ini?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Izin dari {izin.userName} akan ditolak. Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={processingId !== null}>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={processingId !== null}
                                className="bg-rose-500 hover:bg-rose-600 text-white"
                                onClick={async () => {
                                  setProcessingId(izin.id);
                                  const r = await rejectIzin(izin.id);
                                  setProcessingId(null);
                                  if (r.valid) toast.success(r.message);
                                  else toast.error(r.message);
                                }}
                              >
                                Tolak
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <FileText className="w-8 h-8 mx-auto text-[#D0D0CB] mb-3" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#6B6B66]">Tidak ada izin pending</p>
              <p className="text-[12px] text-[#A3A39D] mt-1">Semua izin sudah diproses</p>
            </div>
          )}
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Avg Keterlambatan */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-[#6B6B66]">Rata-rata Keterlambatan</p>
            </div>
            <p className="text-[32px] font-light leading-none tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>
              {metricStats.avgLate}
            </p>
            <p className="text-[11px] text-[#A3A39D] mt-1.5">menit (bulan ini)</p>
          </div>

          {/* On-Time Rate */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-[#6B6B66]">Kehadiran Tepat Waktu</p>
            </div>
            <p className="text-[32px] font-light leading-none tracking-tighter text-emerald-600" style={{fontFamily: "'Doto', monospace"}}>
              {metricStats.onTimeRate}%
            </p>
            <p className="text-[11px] text-[#A3A39D] mt-1.5">dari total hadir</p>
          </div>

          {/* Active TPA */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-[#6B6B66]">TPA Aktif Hari Ini</p>
            </div>
            <p className="text-[32px] font-light leading-none tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>
              {metricStats.activeTpaCount}
            </p>
            <p className="text-[11px] text-[#A3A39D] mt-1.5">dari {tpas.length} TPA</p>
          </div>
        </div>

        {/* CHART SECTION */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] p-6 border border-[#EAEAE7]">
          <div className="flex items-start justify-between mb-6 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-[#6B6B66] shrink-0" strokeWidth={1.5} />
              <h2 className="text-[14px] font-semibold tracking-tight">Tren kehadiran (7 hari terakhir)</h2>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EFFFC2] text-[#1A1A18] ring-1 ring-inset ring-[#D7FF3D]/30 shrink-0 whitespace-nowrap">
              Bulan ini: {totalThisMonth} sesi
            </span>
          </div>
          {weeklyChartData.every(d => d.tepatWaktu === 0 && d.terlambat === 0) ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-2">
              <TrendingUp className="w-8 h-8 text-[#D0D0CB]" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#6B6B66]">Belum ada data kehadiran</p>
              <p className="text-[12px] text-[#A3A39D]">Data akan muncul setelah sesi pertama dibuka</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
              <LineChart data={weeklyChartData}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Line
                  type="monotone"
                  dataKey="tepatWaktu"
                  stroke="var(--color-tepatWaktu)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, stroke: 'var(--color-tepatWaktu)', strokeWidth: 1.5, fill: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="terlambat"
                  stroke="var(--color-terlambat)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, stroke: 'var(--color-terlambat)', strokeWidth: 1.5, fill: '#fff' }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>

        {/* STATUS TPA SECTION */}
        <div>
          <h2 className="text-[13px] font-semibold text-[#6B6B66] mb-4 px-1">
            Cabang TPA — {tpas.length} lokasi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tpas.map((tpa, idx) => {
              const { activeSession, presentCount } = getTPAStats(tpa.id);
              return (
                <button
                  key={tpa.id}
                  onClick={() => navigate(`/pengurus/tpa/${tpa.id}`)}
                  className="motion-safe:animate-fade-in-up bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all active:scale-[0.97] border border-[#EAEAE7] hover:border-[#D7FF3D] group relative overflow-hidden"
                  style={{ animationDelay: `${idx * 40}ms`, animation: 'fadeUp 280ms cubic-bezier(0.23,1,0.32,1) forwards' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[15px] tracking-tight group-hover:text-primary transition-colors leading-tight">
                      {tpa.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${
                          activeSession
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                            : 'bg-[#F0F0EC] text-[#5C5C57] ring-transparent'
                        }`}
                      >
                        {activeSession ? 'Aktif' : 'Tutup'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#A3A39D] group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={1.5} />
                    </div>
                  </div>

                  {activeSession ? (
                    <div className="mt-4 space-y-1.5 text-[13px] text-[#6B6B66]">
                      <p className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#A3A39D]" strokeWidth={1.5} />
                        <span>{presentCount} pengajar aktif</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#A3A39D]" strokeWidth={1.5} />
                        <span>Sejak {formatTime(new Date(activeSession.dateOpened))}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-[13px] text-[#A3A39D]">Sesi belum dibuka hari ini</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* REKAP PENGAJAR SECTION */}
        <div>
          <h2 className="text-[13px] font-semibold text-[#6B6B66] mb-4 px-1">
            Rekap pengajar (90 hari)
          </h2>
          {teacherStats.length === 0 ? (
            <div className="bg-white rounded-[32px] p-10 text-center border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <Users className="w-8 h-8 mx-auto text-[#D0D0CB] mb-3" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#6B6B66]">Belum ada data presensi</p>
              <p className="text-[12px] text-[#A3A39D] mt-1">Data akan muncul setelah 90 hari pertama</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {teacherStats.map(({ teacher, total, onTime, late, rate, status }, idx) => {
                return (
                  <button
                    key={teacher.id}
                    onClick={() => navigate(`/pengurus/pengajar/${teacher.id}`)}
                    className="w-full motion-safe:starting:opacity-0 motion-safe:starting:translate-y-2 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-[box-shadow,border-color] duration-200 active:scale-[0.97] border border-[#EAEAE7] hover:border-[#D7FF3D] text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <AvatarOrb name={teacher.name} size="md" />
                      <div>
                        <p className="font-semibold text-[14px] text-[#1A1A18]">{teacher.name}</p>
                        <p className="text-[11px] text-[#A3A39D] mt-0.5">{teacher.nim}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-end gap-3.5 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <span className="text-[#A3A39D]">Total:</span>
                        <span className="font-semibold text-[#1A1A18] tabular-nums">{total}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <span className="text-[#6FCB6A] font-semibold tabular-nums">{onTime}</span>
                        <span className="text-[#A3A39D]">Tepat</span>
                      </div>
                      {late > 0 && (
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <span className="text-[#F2B84B] font-semibold tabular-nums">{late}</span>
                          <span className="text-[#A3A39D]">Terlambat</span>
                        </div>
                      )}
                      
                      {/* Status Pill */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        status.isInactive
                          ? 'bg-[#F0F0EC] text-[#5C5C57]'
                          : 'bg-[#EFFFC2] text-[#1A1A18]'
                      }`}>
                        {status.isInactive 
                          ? (status.daysSince !== null ? `${status.daysSince} hari tidak hadir` : 'Baru tidak hadir')
                          : 'Aktif'
                        }
                      </span>
                      
                      {/* Plain text rate percentage */}
                      <div className="text-right shrink-0 min-w-[45px]">
                        <span className="text-[14px] font-light text-[#1A1A18]">{rate}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/pengurus/laporan')}
            className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all active:scale-[0.97] border border-[#EAEAE7] hover:border-[#D7FF3D] flex items-center gap-4 group"
          >
            <div className="w-11 h-11 rounded-full bg-[#F7F7F5] flex items-center justify-center border border-[#EAEAE7] group-hover:border-[#D7FF3D] transition-colors shrink-0">
              <TrendingUp className="w-5 h-5 text-[#6B6B66]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A18]">Laporan</p>
              <p className="text-[12px] text-[#A3A39D] mt-0.5">CSV / Excel / PDF</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/pengurus/pengaturan')}
            className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all active:scale-[0.97] border border-[#EAEAE7] hover:border-[#D7FF3D] flex items-center gap-4 group"
          >
            <div className="w-11 h-11 rounded-full bg-[#F7F7F5] flex items-center justify-center border border-[#EAEAE7] group-hover:border-[#D7FF3D] transition-colors shrink-0">
              <QrCode className="w-5 h-5 text-[#6B6B66]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A18]">Setup QR</p>
              <p className="text-[12px] text-[#A3A39D] mt-0.5">Cetak QR statis TPA</p>
            </div>
          </button>
        </div>
      </main>
      </div>
    </div>
  );
}
