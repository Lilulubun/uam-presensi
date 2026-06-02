import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getUserById } from '../../lib/mock-data';
import { formatDate, formatTime } from '../../lib/date-utils';
import { isEarlyExit } from '../../lib/attendance-utils';

export default function DetailPengajar() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);

  const teacher = getUserById(userId ?? '');

  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Pengajar tidak ditemukan</p>
          <button onClick={() => navigate('/pengurus/dashboard')} className="mt-4 text-primary text-sm underline">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const myAttendances = attendances.filter((a) => a.userId === userId && a.scanInTime);
  const total = myAttendances.length;
  const onTime = myAttendances.filter((a) => !a.isLate).length;
  const late = myAttendances.filter((a) => a.isLate).length;
  const earlyExitCount = myAttendances.filter((a) => {
    const session = sessions.find((s) => s.id === a.sessionId);
    return isEarlyExit(a, session);
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{teacher.name}</h1>
          <p className="text-xs text-muted-foreground">{teacher.email}{teacher.nim ? ` · ${teacher.nim}` : ''}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-green-600">{onTime}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tepat</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-orange-500">{late}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Telat</p>
          </div>
          <div className="bg-card rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-red-500">{earlyExitCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Awal</p>
          </div>
        </div>

        {/* Attendance list grouped by session */}
        {myAttendances.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground bg-card rounded-xl shadow-sm">
            Belum ada riwayat presensi
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myAttendances.map((a) => {
              const session = sessions.find((s) => s.id === a.sessionId);
              const earlyExit = isEarlyExit(a, session);

              return (
                <div key={a.id} className="bg-card rounded-xl shadow-sm p-4 flex items-center gap-3">
                  <div className="shrink-0">
                    {earlyExit ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : a.scanOutTime ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {a.scanInTime ? formatDate(new Date(a.scanInTime)) : '—'}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      {a.scanInTime && <span>Masuk {formatTime(new Date(a.scanInTime))}</span>}
                      {a.scanOutTime && <span>· Keluar {formatTime(new Date(a.scanOutTime))}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {a.isLate && (
                      <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                        +{a.lateMinutes}m
                      </span>
                    )}
                    {earlyExit && (
                      <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                        Pulang awal
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
