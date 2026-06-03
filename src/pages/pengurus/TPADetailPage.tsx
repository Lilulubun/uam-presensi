import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Users, Clock, CheckCircle2, AlertCircle, XCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getTpaById } from '../../store/tpaStore';
import { getUserById } from '../../store/userStore';
import { formatDateTime, formatTime, formatDate, isSameDay } from '../../lib/date-utils';
import { isEarlyExit } from '../../lib/attendance-utils';
import { logEvent } from '../../lib/log-event';
import { Button } from '../../app/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../app/components/ui/alert-dialog';
import type { Attendance, Session } from '../../types';

export default function TPADetailPage() {
  const { tpaId } = useParams<{ tpaId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);
  const forceCloseSession = useSessionStore((s) => s.forceCloseSession);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forceClosing, setForceClosing] = useState(false);

  const tpa = getTpaById(tpaId ?? '');

  if (!tpa) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">TPA tidak ditemukan</p>
          <button onClick={() => navigate('/pengurus/dashboard')} className="mt-4 text-primary text-sm underline">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const tpaSessions = sessions
    .filter((s) => s.tpaId === tpa.id)
    .sort((a, b) => new Date(b.dateOpened).getTime() - new Date(a.dateOpened).getTime());

  const activeSession = tpaSessions.find((s) => s.isActive);
  const today = new Date();
  const isPengurus = user?.role === 'pengurus';

  const handleForceClose = async () => {
    if (!activeSession) return;
    setForceClosing(true);
    try {
      const result = await forceCloseSession(activeSession.id);
      if (result.valid) {
        toast.success('Sesi berhasil ditutup');
        logEvent('admin_force_close', activeSession.id);
        setDialogOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Gagal menutup sesi');
    } finally {
      setForceClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{tpa.name}</h1>
          <p className="text-xs text-muted-foreground">{tpa.staticQRCode} · Radius {tpa.location.radius}m</p>
        </div>
        {activeSession && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Aktif</span>
        )}
      </header>

      <main className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        {activeSession && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800 mb-1">Sesi Berlangsung</p>
            <p className="text-xs text-green-700">
              Dibuka {formatDateTime(new Date(activeSession.dateOpened))}
            </p>
            <SessionAttendees sessionId={activeSession.id} attendances={attendances} session={activeSession} />

            {isPengurus && (
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="mt-3" disabled={forceClosing}>
                    <LogOut className="w-4 h-4 mr-1" />
                    {forceClosing ? 'Menutup...' : 'Tutup Sesi (Admin)'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tutup sesi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menutup paksa sesi yang sedang berlangsung. QR presensi keluar akan diaktifkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceClose}>Tutup Sesi</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Riwayat Sesi ({tpaSessions.length})
          </h2>

          {tpaSessions.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-xl">
              Belum ada sesi di TPA ini
            </div>
          )}

          <div className="flex flex-col gap-3">
            {tpaSessions.map((session) => {
              const sessionAttendances = attendances.filter((a) => a.sessionId === session.id);
              const presentCount = sessionAttendances.filter((a) => a.scanInTime).length;
              const lateCount = sessionAttendances.filter((a) => a.isLate).length;
              const earlyExitCount = sessionAttendances.filter(
                (a) => isEarlyExit(a, session)
              ).length;
              const firstTeacher = getUserById(session.firstTeacherId);
              const isToday = isSameDay(new Date(session.dateOpened), today);

              return (
                <div key={session.id} className="bg-card rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {isToday ? 'Hari Ini' : formatDate(new Date(session.dateOpened))}
                        {' · '}
                        {formatTime(new Date(session.dateOpened))}
                        {session.dateClosed && ` – ${formatTime(new Date(session.dateClosed))}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pengajar pertama: {firstTeacher?.name ?? session.firstTeacherId}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        session.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {session.isActive ? 'Aktif' : 'Selesai'}
                    </span>
                  </div>

                  <div className="px-4 py-2 flex gap-4 text-xs text-muted-foreground border-b">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {presentCount} hadir
                    </span>
                    {lateCount > 0 && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <Clock className="w-3 h-3" /> {lateCount} terlambat
                      </span>
                    )}
                    {earlyExitCount > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="w-3 h-3" /> {earlyExitCount} pulang awal
                      </span>
                    )}
                  </div>

                  <SessionAttendees sessionId={session.id} attendances={attendances} session={session} />
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function SessionAttendees({
  sessionId,
  attendances,
  session,
}: {
  sessionId: string;
  attendances: Attendance[];
  session: Session;
}) {
  const navigate = useNavigate();
  const sessionAttendances = attendances.filter((a) => a.sessionId === sessionId && a.scanInTime);

  if (sessionAttendances.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Belum ada presensi</p>;
  }

  return (
    <ul className="divide-y">
      {sessionAttendances.map((a) => {
        const teacher = getUserById(a.userId);
        const earlyExit = isEarlyExit(a, session);

        return (
          <li key={a.id} className="px-4 py-2.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
              {teacher?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                <button
                  className="hover:underline text-left"
                  onClick={() => navigate(`/pengurus/pengajar/${a.userId}`)}
                >
                  {teacher?.name ?? a.userId}
                </button>
              </p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {a.scanInTime && <span>Masuk {formatTime(new Date(a.scanInTime))}</span>}
                {a.scanOutTime && <span>· Keluar {formatTime(new Date(a.scanOutTime))}</span>}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {a.isLate && (
                <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                  +{a.lateMinutes}m
                </span>
              )}
              {earlyExit ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : a.scanOutTime ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-primary" />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
