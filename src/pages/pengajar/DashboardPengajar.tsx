import { useNavigate } from 'react-router-dom';
import { QrCode, History, LogOut, Clock, CheckCircle2, ScanLine } from 'lucide-react';
import { Button } from '../../app/components/ui/button';
import { LocationStatus } from '../../app/components/gps/LocationStatus';
import { useWatchLocation } from '../../app/hooks/useWatchLocation';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getTpaById } from '../../store/tpaStore';
import { formatTime, formatDate, isSameDay } from '../../lib/date-utils';

export default function DashboardPengajar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeSession = useSessionStore((s) => s.activeSession);
  const allAttendances = useAttendanceStore((s) => s.attendances);
  const { locationState, nearestTPA } = useWatchLocation(true);

  const today = new Date();

  const todayAttendances = allAttendances.filter((a) => {
    if (a.userId !== user?.id) return false;
    const scanTime = a.scanInTime ?? a.scanOutTime;
    return scanTime && isSameDay(new Date(scanTime), today);
  });

  const todayRecord = todayAttendances[0] ?? null;

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
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground p-2">
            <LogOut className="w-5 h-5" />
          </button>
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
