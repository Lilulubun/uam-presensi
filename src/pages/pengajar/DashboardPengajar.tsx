import { useNavigate } from 'react-router-dom';
import { QrCode, History, LogOut, Clock, CheckCircle2, ScanLine, Flame, CalendarDays, User, FileText } from 'lucide-react';
import { Button } from '../../app/components/ui/button';
import { LocationStatus } from '../../app/components/gps/LocationStatus';
import { useWatchLocation } from '../../app/hooks/useWatchLocation';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getTpaById } from '../../store/tpaStore';
import { formatTime, formatDate, isSameDay, jakartaNow } from '../../lib/date-utils';
import { computeStreak } from '../../lib/computeStreak';
import { computeMonthlySummary } from '../../lib/computeMonthlySummary';
import { useIzinStore } from '../../store/izinStore';
import { useEffect } from 'react';

export default function DashboardPengajar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeSession = useSessionStore((s) => s.activeSession);
  const allSessions = useSessionStore((s) => s.sessions);
  const allAttendances = useAttendanceStore((s) => s.attendances);
  const { locationState, nearestTPA } = useWatchLocation(true);
  const pendingIzins = useIzinStore((s) => s.myIzins.filter((i) => i.status === 'pending').length);
  const fetchMyIzins = useIzinStore((s) => s.fetchMyIzins);

  useEffect(() => {
    fetchMyIzins();
  }, []);

  const today = new Date();

  const todayAttendances = allAttendances.filter((a) => {
    if (a.userId !== user?.id) return false;
    const scanTime = a.scanInTime ?? a.scanOutTime;
    return scanTime && isSameDay(new Date(scanTime), today);
  });

  const todayRecord = todayAttendances[0] ?? null;

  const myAttendances = allAttendances.filter((a) => a.userId === user?.id);
  const myTpaIds = new Set(
    myAttendances
      .map((a) => allSessions.find((s) => s.id === a.sessionId)?.tpaId)
      .filter((id): id is string => id != null),
  );
  const mySessions = allSessions.filter((s) => myTpaIds.has(s.tpaId));
  const streak = computeStreak(myAttendances, mySessions);
  const { year: jkYear, month: jkMonth } = jakartaNow();
  const monthSummary = computeMonthlySummary(myAttendances, jkYear, jkMonth + 1);

  const recentAttendances = allAttendances
    .filter((a) => a.userId === user?.id && a.scanInTime)
    .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())
    .slice(0, 5);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusInfo = () => {
    if (!todayRecord) {
      return { label: 'Belum melakukan presensi', color: 'text-muted-foreground', icon: <QrCode className="w-5 h-5" /> };
    }
    if (todayRecord.scanInTime && !todayRecord.scanOutTime) {
      return { label: `Masuk ${formatTime(todayRecord.scanInTime)}`, color: 'text-primary', icon: <Clock className="w-5 h-5 text-primary" /> };
    }
    if (todayRecord.scanInTime && todayRecord.scanOutTime) {
      return { label: 'Presensi selesai', color: 'text-green-600', icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> };
    }
    return { label: 'Belum melakukan presensi', color: 'text-muted-foreground', icon: <QrCode className="w-5 h-5" /> };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg">Presensi UAM</h1>
            <p className="text-sm text-muted-foreground">Halo, {user?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/profile')} className="text-muted-foreground hover:text-foreground p-2">
              <User className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground p-2">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24 flex flex-col gap-4">
        {/* Today's status card */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Status Hari Ini</p>
          <div className="flex items-center gap-3">
            {statusInfo.icon}
            <div>
              <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
              {todayRecord?.isLate && (
                <p className="text-xs text-orange-500">Terlambat {todayRecord.lateMinutes} menit</p>
              )}
            </div>
          </div>
          {todayRecord?.scanOutTime && (
            <p className="text-xs text-muted-foreground mt-2">
              Keluar pukul {formatTime(todayRecord.scanOutTime)}
            </p>
          )}
        </div>

        {/* Streak card */}
        {streak > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3">
            <Flame className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                🔥 {streak} Hari Berturut-turut
              </p>
              <p className="text-xs text-muted-foreground">
                Terakhir{' '}
                {myAttendances
                  .filter((a) => a.scanInTime)
                  .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())[0]
                  ?.scanInTime
                  ? formatDate(
                      myAttendances
                        .filter((a) => a.scanInTime)
                        .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())[0]
                        .scanInTime!
                    )
                  : ''}
              </p>
            </div>
          </div>
        )}

        {/* Monthly summary card */}
        {monthSummary.total > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ringkasan Bulan Ini
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-primary">{monthSummary.total}</p>
                <p className="text-xs text-muted-foreground">Hadir</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{monthSummary.percentage}%</p>
                <p className="text-xs text-muted-foreground">Tepat Waktu</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-500">{monthSummary.late}</p>
                <p className="text-xs text-muted-foreground">Terlambat</p>
              </div>
            </div>
          </div>
        )}

        {/* GPS Location Status */}
        <div className="bg-card rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
          <LocationStatus locationState={locationState} nearestTPA={nearestTPA} compact />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3">
          <Button className="w-full h-14 text-base" onClick={() => navigate('/pengajar/scan')}>
            <ScanLine className="w-5 h-5 mr-2" />
            Scan QR Presensi
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base relative"
            onClick={() => navigate('/pengajar/izin')}
          >
            <FileText className="w-5 h-5 mr-2" />
            Ajukan Izin
            {pendingIzins > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {pendingIzins}
              </span>
            )}
          </Button>

          {/* If user is the first teacher of an active session, show manage button */}
          {activeSession && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/pengajar/session/${activeSession.id}`)}
            >
              <Clock className="w-4 h-4 mr-2" />
              Kelola Sesi Aktif — {getTpaById(activeSession.tpaId)?.name ?? 'TPA'}
            </Button>
          )}
        </div>

        {/* Recent attendance history */}
        {recentAttendances.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Riwayat Presensi</p>
            </div>
            <ul className="divide-y">
              {recentAttendances.map((attendance) => (
                  <li key={attendance.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">
                          {attendance.scanInTime ? formatDate(attendance.scanInTime) : '—'}
                        </p>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                          {attendance.scanInTime && (
                            <span>Masuk {formatTime(attendance.scanInTime)}</span>
                          )}
                          {attendance.scanOutTime && (
                            <span>· Keluar {formatTime(attendance.scanOutTime)}</span>
                          )}
                        </div>
                      </div>
                      {attendance.isLate ? (
                        <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                          Terlambat
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Tepat Waktu
                        </span>
                      )}
                    </div>
                  </li>
              ))}
            </ul>
          </div>
        )}

        {recentAttendances.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Belum ada riwayat presensi
          </div>
        )}

        {recentAttendances.length > 0 && (
          <button
            onClick={() => navigate('/pengajar/riwayat')}
            className="text-sm text-primary underline underline-offset-2 text-center w-full"
          >
            Lihat semua riwayat
          </button>
        )}
      </main>
    </div>
  );
}
