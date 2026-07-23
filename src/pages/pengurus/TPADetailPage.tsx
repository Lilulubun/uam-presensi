import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, CheckCircle2, LogOut, XSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getTpaById } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { useIzinStore } from '../../store/izinStore';
import { formatDateTime, formatTime, formatDate, isSameDay, toJakartaDate } from '../../lib/date-utils';
import { logEvent } from '../../lib/log-event';
import { AvatarOrb } from '../../lib/avatar-orb';
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
  const users = useUsersStore((s) => s.users);
  const fetchAllIzins = useIzinStore((s) => s.fetchAllIzins);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forceClosing, setForceClosing] = useState(false);

  useEffect(() => {
    fetchAllIzins();
  }, []);

  const tpa = getTpaById(tpaId ?? '');

  if (!tpa) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#A3A39D]">TPA tidak ditemukan</p>
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
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#7A7A75] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[18px] tracking-tight text-[#1A1A18]">{tpa.name}</h1>
          <p className="text-[11px] text-[#A3A39D] font-medium">{tpa.staticQRCode} • Radius {tpa.location.radius}m</p>
        </div>
        {activeSession && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF5EE] text-[#5B9C64] ring-1 ring-inset ring-[#5B9C64]/20 uppercase tracking-wider">
            Aktif
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {activeSession && (
          <div className="bg-white border border-[#EAEAE7] rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1A18]">Sesi Berlangsung</p>
                <p className="text-[12px] text-[#7A7A75] mt-0.5">
                  Dibuka {formatDateTime(new Date(activeSession.dateOpened))}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF5EE] text-[#5B9C64] ring-1 ring-inset ring-[#5B9C64]/20 uppercase tracking-wider animate-pulse">
                Live
              </span>
            </div>
            
            <div className="border border-[#EAEAE7] rounded-[20px] overflow-hidden bg-[#F7F7F5] my-4">
              <SessionAttendees sessionId={activeSession.id} attendances={attendances} session={activeSession} />
            </div>

            {isPengurus && (
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-[14px] font-medium w-full sm:w-auto" disabled={forceClosing}>
                    <LogOut className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
                    {forceClosing ? 'Menutup...' : 'Tutup Sesi (Admin)'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[28px] border border-[#EAEAE7] bg-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-semibold text-[18px]">Tutup sesi?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-[#7A7A75]">
                      Tindakan ini akan menutup paksa sesi yang sedang berlangsung. Kehadiran semua pengajar akan difinalisasi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5]">Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceClose} className="rounded-[14px] bg-[#D4787C] text-white hover:bg-[#D4787C]/90">Tutup Sesi</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-bold text-[#7A7A75] uppercase tracking-wider">
            Riwayat Sesi ({tpaSessions.length})
          </h2>

          {tpaSessions.length === 0 && (
            <div className="text-center py-12 text-[14px] text-[#A3A39D] bg-white rounded-[32px] border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)] font-medium">
              Belum ada sesi di TPA ini
            </div>
          )}

          <div className="flex flex-col gap-4">
            {tpaSessions.map((session) => {
              const sessionAttendances = attendances.filter((a) => a.sessionId === session.id);
              const presentCount = sessionAttendances.filter((a) => a.scanInTime).length;
              const lateCount = sessionAttendances.filter((a) => a.isLate).length;
              const firstTeacher = users.find((u) => u.id === session.firstTeacherId);
              const isToday = isSameDay(new Date(session.dateOpened), today);

              return (
                <div key={session.id} className="bg-white rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] transition-all">
                  <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center justify-between gap-3 bg-[#F7F7F5]">
                    <div>
                      <p className="text-[14px] font-semibold text-[#1A1A18]">
                        {isToday ? 'Hari Ini' : formatDate(new Date(session.dateOpened))}
                        {' · '}
                        {formatTime(new Date(session.dateOpened))}
                        {session.dateClosed && ` – ${formatTime(new Date(session.dateClosed))}`}
                      </p>
                      <p className="text-[11px] text-[#A3A39D] font-medium mt-1">
                        Pengajar pertama: <span className="text-[#7A7A75]">{firstTeacher?.name ?? '(tidak ditemukan)'}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                        session.isActive 
                          ? 'bg-[#EDF5EE] text-[#5B9C64] ring-[#5B9C64]/20' 
                          : 'bg-[#F0F0EC] text-[#5C5C57] ring-[#EAEAE7]'
                      } uppercase tracking-wider`}
                    >
                      {session.isActive ? 'Aktif' : 'Selesai'}
                    </span>
                  </div>

                  <div className="px-6 py-2.5 flex gap-4 text-[12px] font-medium text-[#7A7A75] border-b border-[#EAEAE7] bg-[#F7F7F5]/50">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} /> {presentCount} hadir
                    </span>
                    {lateCount > 0 && (
                      <span className="flex items-center gap-1.5 text-[#D9A06B]">
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> {lateCount} terlambat
                      </span>
                    )}
                  </div>

                  {session.closeNotes && (
                    <div className="px-6 py-3 border-b border-[#EAEAE7]">
                      <p className="text-[11px] text-[#A3A39D] font-medium">Catatan Sesi:</p>
                      <p className="text-[13px] text-[#1A1A18] mt-1 italic">"{session.closeNotes}"</p>
                    </div>
                  )}

                  <div className="bg-[#FAF8F5]">
                    <SessionAttendees sessionId={session.id} attendances={attendances} session={session} />
                  </div>
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
  const users = useUsersStore((s) => s.users);
  const pengajarByTPA = useUsersStore((s) => s.pengajarByTPA);
  const fetchPengajarByTPA = useUsersStore((s) => s.fetchPengajarByTPA);
  const allIzins = useIzinStore((s) => s.allIzins);
  const navigate = useNavigate();
  const sessionAttendances = attendances.filter((a) => a.sessionId === sessionId && a.scanInTime);

  const tpaUsers = pengajarByTPA[session.tpaId];
  const attendingUserIds = new Set(sessionAttendances.map((a) => a.userId));
  const absentUsers = (tpaUsers ?? []).filter((u) => !attendingUserIds.has(u.id));

  const sessionDateStr = toJakartaDate(new Date(session.dateOpened));

  const izinUserIds = new Set(
    allIzins
      .filter(
        (ir) =>
          ir.status === 'approved' &&
          ir.userId &&
          sessionDateStr >= toJakartaDate(new Date(ir.startDate)) &&
          sessionDateStr <= toJakartaDate(new Date(ir.endDate))
      )
      .map((ir) => ir.userId)
  );

  const trulyAbsentUsers = absentUsers.filter((u) => !izinUserIds.has(u.id));
  const excusedUsers = absentUsers.filter((u) => izinUserIds.has(u.id));

  useEffect(() => {
    if (!pengajarByTPA[session.tpaId]) {
      fetchPengajarByTPA(session.tpaId);
    }
  }, [session.tpaId, pengajarByTPA, fetchPengajarByTPA]);

  if (sessionAttendances.length === 0 && absentUsers.length === 0) {
    return <p className="px-6 py-4 text-[13px] text-[#A3A39D] font-medium">Belum ada presensi</p>;
  }

  return (
    <ul className="divide-y divide-[#EAEAE7]">
      {sessionAttendances.map((a) => {
        const teacher = users.find((u) => u.id === a.userId);

        return (
          <li key={a.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#F0F0EC] transition-colors">
            <AvatarOrb name={teacher?.name ?? '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#1A1A18] truncate">
                <button
                  className="hover:underline text-left"
                  onClick={() => navigate(`/pengurus/pengajar/${a.userId}`)}
                >
                  {teacher?.name ?? '(pengajar tidak ditemukan)'}
                </button>
              </p>
              <div className="flex gap-2 text-[11px] text-[#7A7A75] font-medium mt-0.5">
                {a.scanInTime && <span>Masuk {formatTime(new Date(a.scanInTime))}</span>}
                {a.scanOutTime && <span>· Keluar {formatTime(new Date(a.scanOutTime))}</span>}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {a.isLate && (
                <span className="text-[10px] font-semibold text-[#D9A06B] bg-[#FDF4ED] px-1.5 py-0.5 rounded-full ring-1 ring-inset ring-[#D9A06B]/20">
                  +{a.lateMinutes}m
                </span>
              )}
              {a.scanOutTime ? (
                <CheckCircle2 className="w-4 h-4 text-[#5B9C64]" strokeWidth={1.5} />
              ) : (
                <Clock className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
              )}
            </div>
          </li>
        );
      })}
      {excusedUsers.map((u) => (
        <li key={u.id} className="px-5 py-3.5 flex items-center gap-3 bg-[#F7F7F5]/60 hover:bg-[#F0F0EC] transition-colors">
          <AvatarOrb name={u.name ?? '?'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1A1A18] truncate">
              <button
                className="hover:underline text-left"
                onClick={() => navigate(`/pengurus/pengajar/${u.id}`)}
              >
                {u.name}
              </button>
            </p>
            <p className="text-[11px] text-[#8DB5D8] font-medium">Izin</p>
          </div>
          <FileText className="w-4 h-4 text-[#8DB5D8] shrink-0" strokeWidth={1.5} />
        </li>
      ))}
      {trulyAbsentUsers.map((u) => (
        <li key={u.id} className="px-5 py-3.5 flex items-center gap-3 bg-[#F7F7F5]/60 hover:bg-[#F0F0EC] transition-colors">
          <AvatarOrb name={u.name ?? '?'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1A1A18] truncate">
              <button
                className="hover:underline text-left"
                onClick={() => navigate(`/pengurus/pengajar/${u.id}`)}
              >
                {u.name}
              </button>
            </p>
            <p className="text-[11px] text-[#D4787C] font-medium">Tidak hadir</p>
          </div>
          <XSquare className="w-4 h-4 text-[#D4787C] shrink-0" strokeWidth={1.5} />
        </li>
      ))}
    </ul>
  );
}
