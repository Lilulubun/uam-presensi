import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useShallow } from 'zustand/react/shallow';
import { getTpaById } from '../../store/tpaStore';
import { formatDate, formatTime } from '../../lib/date-utils';
import { isEarlyExit } from '../../lib/attendance-utils';

export default function RiwayatPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore(
    useShallow((s) =>
      s.attendances
        .filter((a) => a.userId === user?.id && a.scanInTime)
        .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())
    )
  );

  const getTPAName = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return '—';
    return getTpaById(session.tpaId)?.name ?? '—';
  };

  const onTime = attendances.filter((a) => !a.isLate).length;
  const late = attendances.filter((a) => a.isLate).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Riwayat Presensi</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        {/* Summary */}
        {attendances.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl p-3 shadow-sm text-center">
              <p className="text-xl font-bold">{attendances.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-sm text-center">
              <p className="text-xl font-bold text-green-600">{onTime}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tepat Waktu</p>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-sm text-center">
              <p className="text-xl font-bold text-orange-500">{late}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Terlambat</p>
            </div>
          </div>
        )}

        {/* List */}
        {attendances.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground bg-card rounded-xl shadow-sm">
            Belum ada riwayat presensi
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <ul className="divide-y">
              {attendances.map((attendance) => {
                const session = sessions.find((s) => s.id === attendance.sessionId);
                const earlyExit = isEarlyExit(attendance, session);

                return (
                  <li key={attendance.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0">
                      {earlyExit ? (
                        <XCircle className="w-5 h-5 text-red-400" />
                      ) : attendance.scanOutTime ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{getTPAName(attendance.sessionId)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {attendance.scanInTime ? formatDate(new Date(attendance.scanInTime)) : '—'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm tabular-nums">
                        {attendance.scanInTime ? formatTime(new Date(attendance.scanInTime)) : '—'}
                        {attendance.scanOutTime && ` – ${formatTime(new Date(attendance.scanOutTime))}`}
                      </p>
                      <p className={`text-xs mt-0.5 ${attendance.isLate ? 'text-orange-500' : 'text-green-600'}`}>
                        {earlyExit
                          ? 'Pulang awal'
                          : attendance.isLate
                          ? `Terlambat ${attendance.lateMinutes}m`
                          : 'Tepat waktu'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
