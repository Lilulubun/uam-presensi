import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle2, FileText } from 'lucide-react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useUsersStore } from '../../store/userStore';
import { useIzinStore } from '../../store/izinStore';
import { formatDate, formatTime, formatMonthYear, formatDateIdShort, jakartaNow } from '../../lib/date-utils';

export default function DetailPengajar() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const attendances = useAttendanceStore((s) => s.attendances);
  const users = useUsersStore((s) => s.users);

  const teacher = users.find((u) => u.id === userId);

  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#A3A39D]">Pengajar tidak ditemukan</p>
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

  const now = new Date();
  const { monthlyReport, fetchMonthlyReport } = useIzinStore();

  useEffect(() => {
    if (userId) {
      const { year, month } = jakartaNow();
      fetchMonthlyReport(userId, year, month + 1);
    }
  }, [userId, fetchMonthlyReport]);

  const hadirCount = monthlyReport.filter((r) => r.status === 'hadir').length;
  const izinCount = monthlyReport.filter((r) => r.status === 'izin').length;
  const tidakMasukCount = monthlyReport.filter((r) => r.status === 'tidak_masuk').length;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#A3A39D] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{teacher.name}</h1>
          <p className="text-xs text-[#A3A39D]">{teacher.email}{teacher.nim ? ` · ${teacher.nim}` : ''}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-xs text-[#A3A39D] mt-0.5">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-[#5B9C64]">{onTime}</p>
            <p className="text-xs text-[#A3A39D] mt-0.5">Tepat</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-[#D9A06B]">{late}</p>
            <p className="text-xs text-[#A3A39D] mt-0.5">Telat</p>
          </div>
        </div>

        {/* Monthly attendance status */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#A3A39D]" />
            <p className="text-sm font-medium">Status Bulanan</p>
            <span className="ml-auto text-xs text-[#A3A39D]">
              {formatMonthYear(now)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3">
            <div className="text-center p-2 rounded-lg bg-[#EDF5EE]">
              <p className="text-lg font-bold text-[#5B9C64]">{hadirCount}</p>
              <p className="text-xs text-[#5B9C64]">Hadir</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-[#EDF3F8]">
              <p className="text-lg font-bold text-[#8DB5D8]">{izinCount}</p>
              <p className="text-xs text-blue-700">Izin</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-[#FDF1F2]">
              <p className="text-lg font-bold text-[#D4787C]">{tidakMasukCount}</p>
              <p className="text-xs text-[#D4787C]">Tidak Masuk</p>
            </div>
          </div>

          {monthlyReport.length > 0 && (
            <ul className="divide-y border-t">
              {monthlyReport.map((row) => {
                const date = new Date(row.tgl);
                return (
                  <li key={date.toISOString()} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm min-w-[120px]">
                      {formatDateIdShort(date)}
                    </span>
                    <span className="text-xs text-[#A3A39D] flex-1">{row.tpaName}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.status === 'hadir' ? 'bg-[#EDF5EE] text-[#5B9C64]' :
                        row.status === 'izin' ? 'bg-[#EDF3F8] text-[#8DB5D8]' :
                        'bg-[#FDF1F2] text-[#D4787C]'
                      }`}
                    >
                      {row.status === 'hadir' ? 'Hadir' : row.status === 'izin' ? 'Izin' : 'Tidak Masuk'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Attendance list grouped by session */}
        {myAttendances.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#A3A39D] bg-white rounded-xl shadow-sm">
            Belum ada riwayat presensi
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myAttendances.map((a) => {
              return (
                <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
                  <div className="shrink-0">
                    {a.scanOutTime ? (
                      <CheckCircle2 className="w-5 h-5 text-[#5B9C64]" />
                    ) : (
                      <Clock className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {a.scanInTime ? formatDate(new Date(a.scanInTime)) : '—'}
                    </p>
                    <div className="flex gap-3 text-xs text-[#A3A39D] mt-0.5">
                      {a.scanInTime && <span>Masuk {formatTime(new Date(a.scanInTime))}</span>}
                      {a.scanOutTime && <span>· Keluar {formatTime(new Date(a.scanOutTime))}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {a.isLate && (
                      <span className="text-xs text-[#D9A06B] bg-[#FDF4ED] px-1.5 py-0.5 rounded">
                        +{a.lateMinutes}m
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
