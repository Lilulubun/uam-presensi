import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Users, Clock, CheckCircle2, LogOut } from 'lucide-react';
import { getCurrentLocation } from '../../lib/gps-utils';
import { QRDisplay } from '../../app/components/qr/QRDisplay';
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
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useShallow } from 'zustand/react/shallow';
import { getTpaById } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { formatTime, formatDateTime } from '../../lib/date-utils';
import { useRealtimeSessions } from '../../app/hooks/useRealtimeSessions';

export default function SessionActivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const closeSession = useSessionStore((s) => s.closeSession);
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const attendances = useAttendanceStore(
    useShallow((s) => s.attendances.filter((a) => a.sessionId === sessionId))
  );
  const users = useUsersStore((s) => s.users);
  const pengajarByTPA = useUsersStore((s) => s.pengajarByTPA);
  const fetchPengajarByTPA = useUsersStore((s) => s.fetchPengajarByTPA);
  const [closing, setClosing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  useRealtimeSessions();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Sesi tidak ditemukan</p>
          <Button className="mt-4" onClick={() => navigate('/pengajar/dashboard')}>
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const tpa = getTpaById(session.tpaId);
  const isFirstTeacher = user?.id === session.firstTeacherId;

  const handleCloseSession = async () => {
    if (!sessionId) return;
    setClosing(true);
    try {
      let location;
      try {
        location = await getCurrentLocation();
      } catch {
        // close without location if GPS unavailable
      }
      const result = await closeSession(sessionId, location, notes || undefined);
      if (result.valid) {
        setNotes('');
        toast.success('Sesi berhasil ditutup! QR presensi keluar aktif.');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Gagal menutup sesi');
    } finally {
      setClosing(false);
    }
  };

  useEffect(() => {
    if (session.tpaId && !pengajarByTPA[session.tpaId]) {
      fetchPengajarByTPA(session.tpaId);
    }
  }, [session.tpaId, pengajarByTPA, fetchPengajarByTPA]);

  const effectiveTPAUsers = session.isActive ? [] : (pengajarByTPA[session.tpaId] ?? []);
  const attendingUserIds = new Set(attendances.filter((a) => a.scanInTime).map((a) => a.userId));
  const absentUsers = effectiveTPAUsers.filter((u) => !attendingUserIds.has(u.id));

  const checkedInCount = attendances.filter((a) => a.scanInTime).length;
  const checkedOutCount = attendances.filter((a) => a.scanOutTime).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{tpa?.name ?? 'Sesi Aktif'}</h1>
          <p className="text-xs text-muted-foreground">
            Dibuka {session.dateOpened ? formatDateTime(session.dateOpened) : '—'}
          </p>
        </div>
        {/* Status badge */}
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            session.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {session.isActive ? 'Aktif' : 'Ditutup'}
        </span>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
        {/* QR Display */}
        <div className="bg-card rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2">
          {session.isActive ? (
            <>
              <p className="font-semibold text-center mb-1">QR Presensi Masuk</p>
              <p className="text-xs text-muted-foreground text-center mb-3">
                Tampilkan ke pengajar lain untuk scan presensi masuk
              </p>
              <QRDisplay sessionId={session.id} type="in" />
            </>
          ) : (
            <>
              <p className="font-semibold text-center mb-1">QR Presensi Keluar</p>
              <p className="text-xs text-muted-foreground text-center mb-3">
                Tampilkan ke pengajar untuk scan presensi keluar
              </p>
              <QRDisplay sessionId={session.id} type="out" />
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{checkedInCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Presensi Masuk</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{checkedOutCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Presensi Keluar</p>
          </div>
        </div>

        {/* Attendee list */}
        {attendances.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Daftar Kehadiran</p>
            </div>
            <ul className="divide-y">
              {attendances.map((attendance) => {
                const teacher =
                  users.find((u) => u.id === attendance.userId) ||
                  (pengajarByTPA[session.tpaId] ?? []).find((u) => u.id === attendance.userId);
                return (
                  <li key={attendance.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {teacher?.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {teacher?.name ?? '(pengajar tidak ditemukan)'}
                        {attendance.userId === session.firstTeacherId && (
                          <span className="ml-1.5 text-xs text-primary">(Pertama)</span>
                        )}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {attendance.scanInTime && (
                          <span>Masuk: {formatTime(attendance.scanInTime)}</span>
                        )}
                        {attendance.scanOutTime && (
                          <span>Keluar: {formatTime(attendance.scanOutTime)}</span>
                        )}
                        {attendance.isLate && (
                          <span className="text-orange-500">Terlambat {attendance.lateMinutes}m</span>
                        )}
                      </div>
                    </div>
                    {attendance.scanOutTime ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : attendance.scanInTime ? (
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Absent users — shown after session is closed */}
        {!session.isActive && absentUsers.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden border border-red-100">
            <div className="px-4 py-3 border-b flex items-center gap-2 bg-red-50">
              <Users className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium text-red-700">Tidak Hadir ({absentUsers.length})</p>
            </div>
            <ul className="divide-y">
              {absentUsers.map((u) => (
                <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs font-semibold">
                    {u.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.nim && (
                      <p className="text-xs text-muted-foreground">{u.nim}</p>
                    )}
                  </div>
                  <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded">
                    Tidak Masuk
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Close session button — only for first teacher while session is active */}
        {isFirstTeacher && session.isActive && (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={closing}>
                <LogOut className="w-4 h-4 mr-2" />
                {closing ? 'Menutup Sesi...' : 'Tutup Sesi'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tutup sesi?</AlertDialogTitle>
                <AlertDialogDescription>
                  QR presensi keluar akan aktif. Sesi yang ditutup tidak bisa dibuka kembali.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-6 py-2">
                   <textarea
                     placeholder="Materi yang diberikan hari ini (opsional) — misal: Surat Al-Fatihah ayat 1-7"
                     value={notes}
                     onChange={(e) => setNotes(e.target.value)}
                     className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                     rows={3}
                     disabled={closing}
                   />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseSession}>Tutup Sesi</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!session.isActive && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/pengajar/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        )}
      </main>
    </div>
  );
}
