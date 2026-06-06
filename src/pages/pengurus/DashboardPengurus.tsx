import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, BarChart2, QrCode, Users, Clock, TrendingUp, AlertCircle, User, FileText, CheckCircle, XCircle } from 'lucide-react';
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
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '../../app/components/ui/button';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useTPAStore } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { useRealtimeSessions } from '../../app/hooks/useRealtimeSessions';
import { formatTime, isSameDay } from '../../lib/date-utils';
import { computeInactiveAlert } from '../../lib/computeInactiveAlert';

export default function DashboardPengurus() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);
  const tpas = useTPAStore((s) => s.tpas);
  const users = useUsersStore((s) => s.users);

  useRealtimeSessions();

  const { pendingIzins, approveIzin, rejectIzin, fetchPendingIzins } = useIzinStore();

  useEffect(() => {
    fetchPendingIzins();
  }, []);

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
        day: format(d, 'EEE', { locale: localeId }),
        'Tepat Waktu': dayAttendances.filter((a) => !a.isLate).length,
        Terlambat: dayAttendances.filter((a) => a.isLate).length,
      });
    }
    return days;
  }, [attendances]);

  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return attendances.filter((a) => {
      const t = a.scanInTime;
      if (!t) return false;
      const d = new Date(t);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
          <div>
            <h1 className="font-bold text-lg">Monitoring Presensi</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Langsung (Realtime)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/pengurus/pengaturan')}>
              <QrCode className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Setup QR</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/pengurus/laporan')}>
              <BarChart2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Laporan</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/pengurus/kelola-pengajar')}>
              <Users className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Pengajar</span>
            </Button>
            <button onClick={() => navigate('/profile')} className="text-muted-foreground hover:text-foreground p-2">
              <User className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground p-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">Halo, {user?.name}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{activeSessions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sesi Aktif</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{todayAttendances.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Hadir Hari Ini</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-orange-500">{lateToday.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Terlambat</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">{totalThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Bulan Ini</p>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Kehadiran 7 Hari Terakhir</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyChartData} barSize={24} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
                cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar dataKey="Tepat Waktu" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Terlambat" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Status TPA — {tpas.length} Lokasi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tpas.map((tpa) => {
              const { activeSession, presentCount } = getTPAStats(tpa.id);
              return (
                <button
                  key={tpa.id}
                  onClick={() => navigate(`/pengurus/tpa/${tpa.id}`)}
                  className="bg-card rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-all border border-transparent hover:border-primary/20 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                      {tpa.name}
                    </p>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        activeSession
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {activeSession ? 'Aktif' : 'Tutup'}
                    </span>
                  </div>

                  {activeSession ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {presentCount} pengajar hadir
                      </p>
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sejak {formatTime(new Date(activeSession.dateOpened))}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Tidak ada sesi aktif</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold">Izin Pending</h2>
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              {pendingIzins.length}
            </span>
          </div>
          {pendingIzins.length > 0 ? (
            <ul className="divide-y">
              {pendingIzins.map((izin) => (
                  <li key={izin.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{izin.userName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(izin.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          {' – '}
                          {new Date(izin.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{izin.alasan}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const r = await approveIzin(izin.id);
                            if (r.valid) toast.success(r.message);
                            else toast.error(r.message);
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Setujui
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={async () => {
                            const r = await rejectIzin(izin.id);
                            if (r.valid) toast.success(r.message);
                            else toast.error(r.message);
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Tolak
                        </Button>
                      </div>
                    </div>
                  </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Tidak ada izin pending</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Rekap Pengajar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Pengajar</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tepat Waktu</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Terlambat</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Kepatuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teacherStats.map(({ teacher, total, onTime, late, rate, status }) => (
                  <tr key={teacher.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/pengurus/pengajar/${teacher.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground">{teacher.nim}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{total}</td>
                    <td className="px-4 py-3 text-center text-green-600">{onTime}</td>
                    <td className="px-4 py-3 text-center text-orange-500">
                      {late > 0 ? (
                        <span className="flex items-center justify-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {late}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {status.isInactive ? (
                        <span className="text-xs text-red-500 font-medium">
                          {status.daysSince !== null ? `${status.daysSince} hr` : 'Baru'}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Aktif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-orange-500' : 'text-red-500'}`}>
                          {rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {teacherStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Belum ada data presensi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/pengurus/laporan')}
            className="bg-card rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-all border border-transparent hover:border-primary/20 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Laporan</p>
              <p className="text-xs text-muted-foreground">CSV / Excel</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/pengurus/pengaturan')}
            className="bg-card rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-all border border-transparent hover:border-primary/20 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Setup QR</p>
              <p className="text-xs text-muted-foreground">Cetak QR statis</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
