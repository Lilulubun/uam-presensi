import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useShallow } from 'zustand/react/shallow';
import { getTpaById } from '../../store/tpaStore';
import { formatDate, formatTime } from '../../lib/date-utils';

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
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18] flex-1">Riwayat Presensi</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Summary */}
        {attendances.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] text-center">
              <p className="text-[24px] font-bold text-[#1A1A18]">{attendances.length}</p>
              <p className="text-[11px] text-[#6B6B66] font-medium mt-1">Total Presensi</p>
            </div>
            <div className="bg-white rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] text-center">
              <p className="text-[24px] font-bold text-emerald-600">{onTime}</p>
              <p className="text-[11px] text-[#6B6B66] font-medium mt-1">Tepat Waktu</p>
            </div>
            <div className="bg-white rounded-[24px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] text-center">
              <p className="text-[24px] font-bold text-amber-600">{late}</p>
              <p className="text-[11px] text-[#6B6B66] font-medium mt-1">Terlambat</p>
            </div>
          </div>
        )}

        {/* List */}
        {attendances.length === 0 ? (
          <div className="text-center py-16 text-[14px] text-[#A3A39D] font-medium bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
            Belum ada riwayat presensi
          </div>
        ) : (
          <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] overflow-hidden">
            <ul className="divide-y divide-[#EAEAE7]">
              {attendances.map((attendance) => {
                return (
                  <li key={attendance.id} className="px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#F7F7F5] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {attendance.scanOutTime ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                        ) : (
                          <Clock className="w-5 h-5 text-[#D7FF3D]" strokeWidth={1.5} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#1A1A18] truncate">{getTPAName(attendance.sessionId)}</p>
                        <p className="text-[12px] text-[#6B6B66] font-medium mt-1">
                          {attendance.scanInTime ? formatDate(new Date(attendance.scanInTime)) : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <p className="text-[13px] font-semibold text-[#1A1A18] tabular-nums">
                        {attendance.scanInTime ? formatTime(new Date(attendance.scanInTime)) : '—'}
                        {attendance.scanOutTime && ` – ${formatTime(new Date(attendance.scanOutTime))}`}
                      </p>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                        attendance.isLate 
                          ? 'bg-amber-50 text-amber-700 ring-amber-600/20' 
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                      } uppercase tracking-wide`}>
                        {attendance.isLate
                          ? `Terlambat ${attendance.lateMinutes}m`
                          : 'Tepat waktu'}
                      </span>
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
