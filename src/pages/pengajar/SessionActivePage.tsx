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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { closeSessionV2 } from '../../store/attendanceV2Adapter';
import { isReleaseC } from '../../lib/feature-flags';
import { useShallow } from 'zustand/react/shallow';
import { getTpaById } from '../../store/tpaStore';
import { useUsersStore } from '../../store/userStore';
import { AvatarOrb } from '../../lib/avatar-orb';
import { formatTime, formatDateTime } from '../../lib/date-utils';
import type { Coordinates } from '../../types';
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
  const [expectedUserIds, setExpectedUserIds] = useState<Set<string>>(new Set());

  useRealtimeSessions();

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-[28px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <p className="text-[14px] text-[#A3A39D] font-medium">Sesi tidak ditemukan</p>
          <Button 
            className="mt-6 h-11 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold" 
            onClick={() => navigate('/pengajar/dashboard')}
          >
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
      let location: Coordinates | undefined;
      try {
        location = await getCurrentLocation();
      } catch {
        // close without location if GPS unavailable
      }
      const result = isReleaseC()
        ? await closeSessionV2(sessionId, location, notes || undefined)
        : await closeSession(sessionId, location, notes || undefined);
      if (result.valid) {
        setNotes('');
        toast.success(isReleaseC() ? 'Sesi berhasil ditutup!' : 'Sesi berhasil ditutup! QR presensi keluar aktif.');
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

  // Fetch expected teachers list when session is closed
  useEffect(() => {
    if (!session.isActive && session.id) {
      supabase
        .from('session_expected_teachers')
        .select('user_id')
        .eq('session_id', session.id)
        .then(({ data, error }) => {
          if (!error && data) {
            const ids = new Set((data as { user_id: string }[]).map((r) => r.user_id));
            setExpectedUserIds(ids);
          }
        });
    }
  }, [session.isActive, session.id]);

  // Absent = expected but not scanned in
  const attendingUserIds = new Set(attendances.filter((a) => a.scanInTime).map((a) => a.userId));
  const allTPAUsers = pengajarByTPA[session.tpaId] ?? [];
  const absentUsers = session.isActive
    ? []
    : allTPAUsers.filter((u) => expectedUserIds.has(u.id) && !attendingUserIds.has(u.id));

  const checkedInCount = attendances.filter((a) => a.scanInTime).length;

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] flex flex-col pb-12">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-[#7A7A75] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18]">{tpa?.name ?? 'Sesi Aktif'}</h1>
          <p className="text-[12px] text-[#7A7A75] font-medium mt-0.5">
            Dibuka {session.dateOpened ? formatDateTime(session.dateOpened) : '—'}
          </p>
        </div>
        {/* Status badge */}
        <span
          className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${
            session.isActive
              ? 'bg-[#EDF5EE] text-[#5B9C64] ring-[#5B9C64]/20'
              : 'bg-[#F7F7F5] text-[#7A7A75] ring-[#7A7A75]/20'
          }`}
        >
          {session.isActive ? 'Aktif' : 'Ditutup'}
        </span>
      </header>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 max-w-lg mx-auto w-full">
        {/* QR Display - Only shown while session is active */}
        {session.isActive ? (
          <div className="bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] flex flex-col items-center gap-4">
            <p className="font-semibold text-center text-[14px] text-[#1A1A18] mb-1">QR Presensi Masuk</p>
            <p className="text-[13px] text-[#7A7A75] text-center mb-3 leading-relaxed">
              Tampilkan ke pengajar lain untuk scan presensi masuk
            </p>
            <QRDisplay sessionId={session.id} type="in" />
          </div>
        ) : (
          <div className="bg-[#EDF5EE] border border-[#5B9C64]/30 rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#5B9C64] mb-2" strokeWidth={1.5} />
            <p className="font-bold text-[#5B9C64] text-[20px]">Sesi Selesai</p>
            <p className="text-[14px] text-[#5B9C64] leading-relaxed">
              Presensi telah difinalisasi. Semua pengajar yang hadir telah tercatat jam keluarnya.
            </p>
            {session.closeNotes && (
              <div className="mt-4 pt-4 border-t border-[#5B9C64]/30 w-full">
                <p className="text-[12px] font-semibold text-[#5B9C64] mb-1">Materi TPA:</p>
                <p className="text-[14px] text-[#5B9C64] italic">"{session.closeNotes}"</p>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] text-center flex items-center justify-center gap-4">
            <Users className="w-6 h-6 text-[#1A1A18]" strokeWidth={1.5} />
            <div>
              <p className="text-[28px] font-bold text-[#1A1A18]">{checkedInCount}</p>
              <p className="text-[12px] text-[#7A7A75] font-medium">Total Pengajar Hadir</p>
            </div>
          </div>
        </div>

        {/* Attendee list */}
        {attendances.length > 0 && (
          <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center gap-3 bg-[#F7F7F5]">
              <Users className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-[#1A1A18]">Daftar Kehadiran</p>
            </div>
            <ul className="divide-y divide-[#EAEAE7]">
              {attendances.map((attendance) => {
                const teacher =
                  users.find((u) => u.id === attendance.userId) ||
                  (pengajarByTPA[session.tpaId] ?? []).find((u) => u.id === attendance.userId);
                return (
                  <li key={attendance.id} className="px-6 py-5 flex items-center gap-3 hover:bg-[#F7F7F5] transition-colors">
                    <AvatarOrb name={teacher?.name ?? '?'} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1A1A18] truncate">
                        {teacher?.name ?? '(pengajar tidak ditemukan)'}
                        {attendance.userId === session.firstTeacherId && (
                          <span className="ml-2 text-[11px] text-[#7A7A75] font-medium">(Pertama)</span>
                        )}
                      </p>
                      <div className="flex gap-3 text-[12px] text-[#7A7A75] font-medium mt-1">
                        {attendance.scanInTime && (
                          <span>Masuk: {formatTime(attendance.scanInTime)}</span>
                        )}
                        {attendance.scanOutTime && (
                          <span>Keluar: {formatTime(attendance.scanOutTime)}</span>
                        )}
                        {attendance.isLate && (
                          <span className="text-[#D9A06B]">Terlambat {attendance.lateMinutes}m</span>
                        )}
                      </div>
                    </div>
                    {attendance.scanOutTime ? (
                      <CheckCircle2 className="w-5 h-5 text-[#5B9C64] shrink-0" strokeWidth={1.5} />
                    ) : attendance.scanInTime ? (
                      <Clock className="w-5 h-5 text-[#D7FF3D] shrink-0" strokeWidth={1.5} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Absent users — shown after session is closed */}
        {!session.isActive && absentUsers.length > 0 && (
          <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#D4787C]/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D4787C]/30 flex items-center gap-3 bg-[#FDF1F2]">
              <Users className="w-4 h-4 text-[#D4787C]" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-[#D4787C]">Tidak Hadir ({absentUsers.length})</p>
            </div>
            <ul className="divide-y divide-rose-200">
              {absentUsers.map((u) => (
                <li key={u.id} className="px-6 py-5 flex items-center gap-3 hover:bg-rose-100 transition-colors">
                  <AvatarOrb name={u.name ?? '?'} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#D4787C] truncate">{u.name}</p>
                    {u.nim && (
                      <p className="text-[12px] text-[#D4787C] font-medium">{u.nim}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset bg-[#FDF1F2] text-[#D4787C] ring-[#D4787C]/20 uppercase tracking-wide">
                    Tidak Masuk
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Non-expected attendees — shown after session is closed */}
        {!session.isActive && expectedUserIds.size > 0 && (
          (() => {
            const nonExpectedAttendees = users.filter(
              (u) => attendingUserIds.has(u.id) && !expectedUserIds.has(u.id)
            );
            if (nonExpectedAttendees.length === 0) return null;
            return (
              <details className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] overflow-hidden">
                <summary className="px-6 py-4 flex items-center gap-3 cursor-pointer text-[14px] font-semibold text-[#7A7A75] bg-[#F7F7F5] hover:bg-[#F7F7F5] transition-colors">
                  <Users className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
                  Tidak Dijadwalkan ({nonExpectedAttendees.length})
                </summary>
                <ul className="divide-y divide-[#EAEAE7] border-t border-[#EAEAE7]">
                  {nonExpectedAttendees.map((u) => (
                    <li key={u.id} className="px-6 py-5 flex items-center gap-3 hover:bg-[#F7F7F5] transition-colors">
                      <AvatarOrb name={u.name ?? '?'} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#7A7A75] truncate">{u.name}</p>
                      </div>
                      <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset bg-[#F7F7F5] text-[#7A7A75] ring-[#7A7A75]/20 uppercase tracking-wide">Non-Jadwal</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })()
        )}

        {/* Close session button — only for first teacher while session is active */}
        {isFirstTeacher && session.isActive && (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full h-12 rounded-[14px] bg-[#FDF1F2]0 text-white font-semibold text-[14px] hover:bg-[#D4787C]" disabled={closing}>
                <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
                {closing ? 'Menutup Sesi...' : 'Tutup Sesi'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md bg-white rounded-[28px] border border-[#EAEAE7]">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-semibold text-[18px] text-[#1A1A18]">Tutup sesi?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-[#7A7A75]">
                  Pastikan semua pengajar sudah memindai presensi masuk. Menutup sesi akan memfinalisasi kehadiran hari ini.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-6 py-2">
                   <textarea
                     placeholder="Materi yang diberikan hari ini (wajib) — misal: Surat Al-Fatihah ayat 1-7"
                     value={notes}
                     onChange={(e) => setNotes(e.target.value)}
                     className="w-full h-24 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
                     rows={3}
                     disabled={closing}
                   />
              </div>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="h-11 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5]">Batal</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleCloseSession} 
                  disabled={!notes.trim() || closing}
                  className="h-11 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold"
                >
                  Tutup Sesi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!session.isActive && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-[14px] font-semibold"
            onClick={() => navigate('/pengajar/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        )}
      </main>
    </div>
  );
}
