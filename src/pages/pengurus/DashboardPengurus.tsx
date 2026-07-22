import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, BarChart2, QrCode, Users, Clock, TrendingUp, User, FileText, CheckCircle, XCircle, History } from 'lucide-react';
import { toast } from 'sonner';
import { useIzinStore } from '../../store/izinStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '../../app/components/ui/button';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useTPAStore } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { useRealtimeSessions } from '../../app/hooks/useRealtimeSessions';
import { formatTime, isSameDay, formatDayName, formatDateIdShort, formatDateId, toJakartaMonth } from '../../lib/date-utils';
import { computeInactiveAlert } from '../../lib/computeInactiveAlert';

export default function DashboardPengurus() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);
  const tpas = useTPAStore((s) => s.tpas);
  const users = useUsersStore((s) => s.users);

  useRealtimeSessions();

  const { pendingIzins, approveIzin, rejectIzin, fetchPendingIzins } = useIzinStore();

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
        'Tepat Waktu': dayAttendances.filter((a) => !a.isLate).length,
        Terlambat: dayAttendances.filter((a) => a.isLate).length,
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
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 px-2 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-semibold text-[22px] tracking-tight">Monitoring Presensi</h1>
            <p className="text-[13px] text-[#A3A39D] flex items-center gap-1.5 mt-0.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Realtime Overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-10 rounded-[16px] border-[#EAEAE7] hover:bg-[#F7F7F5] text-[13px]" onClick={() => navigate('/pengurus/pengaturan')}>
              <QrCode className="w-4 h-4 mr-2 text-[#6B6B66]" strokeWidth={1.5} />
              <span className="hidden sm:inline">Setup QR</span>
            </Button>
            <Button variant="outline" className="h-10 rounded-[16px] border-[#EAEAE7] hover:bg-[#F7F7F5] text-[13px]" onClick={() => navigate('/pengurus/laporan')}>
              <BarChart2 className="w-4 h-4 mr-2 text-[#6B6B66]" strokeWidth={1.5} />
              <span className="hidden sm:inline">Laporan</span>
            </Button>
            <Button variant="outline" className="h-10 rounded-[16px] border-[#EAEAE7] hover:bg-[#F7F7F5] text-[13px]" onClick={() => navigate('/pengurus/kelola-pengajar')}>
              <Users className="w-4 h-4 mr-2 text-[#6B6B66]" strokeWidth={1.5} />
              <span className="hidden sm:inline">Pengajar</span>
            </Button>
            
            <div className="w-[1px] h-6 bg-[#EAEAE7] mx-1"></div>
            
            <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center text-[#6B6B66] hover:text-[#1A1A18] transition-colors">
              <User className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center text-[#6B6B66] hover:text-[#1A1A18] transition-colors">
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-12 mt-8 flex flex-col gap-8">
        
        {/* HERO ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card A: Green Mesh */}
          <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] bg-gradient-to-br from-[#8FE388] via-[#C8F06B] to-[#F4F08A] min-h-[180px] flex flex-col justify-between">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
            
            <div className="flex justify-between items-start z-10">
              <p className="text-[13px] font-medium text-black/60 uppercase tracking-wider">Hadir Hari Ini</p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/30 text-black/80 backdrop-blur-sm">
                On Track
              </span>
            </div>
            
            <div className="z-10 mt-4">
              <p className="text-[56px] font-light leading-[1.1] tracking-tighter text-black/90">
                {todayAttendances.length}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[13px] text-black/60">{lateToday.length} terlambat</span>
              </div>
            </div>
            
            {/* Dot matrix motif */}
            <div className="absolute bottom-4 right-4 flex gap-1 opacity-20">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="w-1 h-1 rounded-full bg-black"></div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Card B: Orange Mesh */}
          <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] bg-gradient-to-br from-[#F6A15E] via-[#F2665A] to-[#F0899E] min-h-[180px] flex flex-col justify-between">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
            
            <div className="flex justify-between items-start z-10">
              <p className="text-[13px] font-medium text-white/80 uppercase tracking-wider">Sesi Aktif</p>
              {activeSessions.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/20 text-white backdrop-blur-sm">
                  Live
                </span>
              )}
            </div>
            
            <div className="z-10 mt-4">
              <p className="text-[56px] font-light leading-[1.1] tracking-tighter text-white">
                {activeSessions.length}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[13px] text-white/70">Dari {tpas.length} Lokasi TPA</span>
              </div>
            </div>
            
            {/* Sparkline motif */}
            <div className="absolute bottom-6 right-6 opacity-30">
              <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                <path d="M0 15 Q 10 5, 20 12 T 40 8 T 60 2" stroke="white" strokeWidth="1.5" strokeDasharray="4 2" fill="none"/>
              </svg>
            </div>
          </div>

          {/* Card C: White Glass */}
          <div className="relative overflow-hidden rounded-[32px] p-6 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] min-h-[180px] flex flex-col justify-between border border-[#EAEAE7]">
            <div className="flex justify-between items-start">
              <p className="text-[13px] font-medium text-[#6B6B66] uppercase tracking-wider">Izin Pending</p>
              {pendingIzins.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0F0EC] text-[#5C5C57]">
                  Menunggu
                </span>
              )}
            </div>
            
            <div className="mt-4">
              <p className="text-[56px] font-light leading-[1.1] tracking-tighter text-[#1A1A18]">
                {pendingIzins.length}
              </p>
              <p className="text-[13px] text-[#A3A39D] mt-1">Permintaan izin masuk</p>
            </div>
            
            <button 
              onClick={() => navigate('/pengurus/riwayat-izin')}
              className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-[#F7F7F5] flex items-center justify-center text-[#6B6B66] hover:bg-[#EAEAE7] hover:text-[#1A1A18] transition-colors"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* CHART SECTION */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] p-6 border border-[#EAEAE7]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <h2 className="text-[15px] font-medium tracking-tight">Tren Kehadiran (7 Hari Terakhir)</h2>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFFFC2] text-[#1A1A18] ring-1 ring-inset ring-[#D7FF3D]/30">
              Bulan ini: {totalThisMonth} sesi
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyChartData} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EC" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#A3A39D' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#A3A39D' }}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 16,
                  border: '1px solid #EAEAE7',
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}
                cursor={{ fill: '#F7F7F5', radius: 8 }}
              />
              <Bar dataKey="Tepat Waktu" stackId="a" fill="#6FCB6A" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Terlambat" stackId="a" fill="#F2B84B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* STATUS TPA SECTION */}
        <div>
          <h2 className="text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider mb-4 px-1">
            Cabang TPA — {tpas.length} Lokasi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tpas.map((tpa) => {
              const { activeSession, presentCount } = getTPAStats(tpa.id);
              return (
                <button
                  key={tpa.id}
                  onClick={() => navigate(`/pengurus/tpa/${tpa.id}`)}
                  className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all border border-[#EAEAE7] hover:border-[#D7FF3D] group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[15px] tracking-tight group-hover:text-primary transition-colors pr-16 leading-tight">
                      {tpa.name}
                    </p>
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${
                        activeSession
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                          : 'bg-[#F0F0EC] text-[#5C5C57] ring-transparent'
                      }`}
                    >
                      {activeSession ? 'Aktif' : 'Tutup'}
                    </span>
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
                className="text-[11px] font-medium text-[#6B6B66] hover:text-[#1A1A18] flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" strokeWidth={1.5} />
                Riwayat
              </button>
            </div>
          </div>
          {pendingIzins.length > 0 ? (
            <ul className="divide-y divide-[#EAEAE7]">
              {pendingIzins.map((izin) => (
                  <li key={izin.id} className="px-6 py-4 hover:bg-[#F7F7F5] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[#1A1A18]">{izin.userName}</p>
                        <p className="text-[12px] text-[#A3A39D] mt-0.5">
                          {formatDateIdShort(izin.startDate)} – {formatDateId(izin.endDate)}
                        </p>
                        <p className="text-[12px] text-[#6B6B66] mt-1 line-clamp-2">{izin.alasan}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-9 rounded-[12px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#C5E835] text-[12px] font-medium"
                          onClick={async () => {
                            const r = await approveIzin(izin.id);
                            if (r.valid) toast.success(r.message);
                            else toast.error(r.message);
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                          Setujui
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-[12px] border-[#EAEAE7] text-[#6B6B66] hover:border-[#D7FF3D] hover:text-[#1A1A18] text-[12px] font-medium"
                          onClick={async () => {
                            const r = await rejectIzin(izin.id);
                            if (r.valid) toast.success(r.message);
                            else toast.error(r.message);
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                          Tolak
                        </Button>
                      </div>
                    </div>
                  </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <FileText className="w-10 h-10 mx-auto text-[#EAEAE7] mb-2" strokeWidth={1.5} />
              <p className="text-[13px] text-[#A3A39D]">Tidak ada izin pending</p>
            </div>
          )}
        </div>

        {/* REKAP PENGAJAR SECTION */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <h2 className="text-[15px] font-medium tracking-tight">Rekap Pengajar (90 hari)</h2>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0F0EC] text-[#5C5C57]">
              {teacherStats.length} pengajar
            </span>
          </div>
          <div className="p-4 sm:p-6">
            {teacherStats.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-12 h-12 mx-auto text-[#EAEAE7] mb-3" strokeWidth={1.5} />
                <p className="text-[14px] text-[#6B6B66]">Belum ada data presensi 90 hari terakhir</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teacherStats.map(({ teacher, total, onTime, late, rate, status }) => (
                  <button
                    key={teacher.id}
                    onClick={() => navigate(`/pengurus/pengajar/${teacher.id}`)}
                    className="w-full bg-[#F7F7F5] rounded-[20px] p-4 hover:bg-[#F0F0EC] transition-colors text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8FE388] to-[#C8F06B] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-[14px] text-[#1A1A18]">{teacher.name}</p>
                        <p className="text-[11px] text-[#A3A39D]">{teacher.nim}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#A3A39D]">Total:</span>
                        <span className="font-semibold text-[#1A1A18] tabular-nums">{total}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#6FCB6A] font-medium">{onTime}</span>
                        <span className="text-[#A3A39D]">Tepat</span>
                      </div>
                      {late > 0 && (
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="text-[#F2B84B] font-medium">{late}</span>
                          <span className="text-[#A3A39D]">Terlambat</span>
                        </div>
                      )}
                      
                      {/* Status Pill */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${
                        status.isInactive
                          ? 'bg-rose-50 text-rose-700 ring-rose-600/10'
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                      }`}>
                        {status.isInactive 
                          ? (status.daysSince !== null ? `${status.daysSince} hr tidak hadir` : 'Baru tidak hadir')
                          : 'Aktif'
                        }
                      </span>
                      
                      {/* Compliance Ring */}
                      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <svg width="40" height="40" viewBox="0 0 40 40">
                          <circle
                            cx="20" cy="20" r="16"
                            stroke="#F0F0EC" strokeWidth="4" fill="none"
                          />
                          <circle
                            cx="20" cy="20" r="16"
                            stroke={rate >= 90 ? '#6FCB6A' : rate >= 75 ? '#F2B84B' : '#E8615A'}
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={`${(rate / 100) * 100.5} 100.5`}
                            strokeLinecap="round"
                            transform="rotate(-90 20 20)"
                            style={{ transition: 'stroke-dasharray 0.6s ease' }}
                          />
                        </svg>
                        <span className={`absolute text-[10px] font-semibold tabular-nums ${rate >= 90 ? 'text-[#6FCB6A]' : rate >= 75 ? 'text-[#F2B84B]' : 'text-[#E8615A]'}`}>
                          {rate}%
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/pengurus/laporan')}
            className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all border border-[#EAEAE7] hover:border-[#D7FF3D] flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-[16px] bg-gradient-to-br from-[#8FE388] to-[#C8F06B] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A18]">Laporan</p>
              <p className="text-[12px] text-[#A3A39D]">CSV / Excel / PDF</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/pengurus/pengaturan')}
            className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] text-left hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all border border-[#EAEAE7] hover:border-[#D7FF3D] flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-[16px] bg-gradient-to-br from-[#F6A15E] to-[#F2665A] flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A18]">Setup QR</p>
              <p className="text-[12px] text-[#A3A39D]">Cetak QR statis TPA</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
