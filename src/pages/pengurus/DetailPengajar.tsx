import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useUsersStore } from '../../store/userStore';
import { useIzinStore } from '../../store/izinStore';
import { formatDate, formatTime, formatMonthYear, formatDateIdShort, jakartaNow } from '../../lib/date-utils';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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
          <p className="text-[#7A7A75]">Pengajar tidak ditemukan</p>
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

  const { year: jkYear, month: jkMonth } = jakartaNow();
  const [monthFilter, setMonthFilter] = useState(jkMonth + 1);
  const [yearFilter, setYearFilter] = useState(jkYear);

  useEffect(() => {
    if (userId) {
      fetchMonthlyReport(userId, yearFilter, monthFilter);
    }
  }, [userId, yearFilter, monthFilter, fetchMonthlyReport]);

  const hadirCount = monthlyReport.filter((r) => r.status === 'hadir').length;
  const izinCount = monthlyReport.filter((r) => r.status === 'izin').length;
  const tidakMasukCount = monthlyReport.filter((r) => r.status === 'tidak_masuk').length;

  const filteredAttendances = myAttendances.filter((a) => {
    if (!a.scanInTime) return false;
    const d = new Date(a.scanInTime);
    return d.getFullYear() === yearFilter && (d.getMonth() + 1) === monthFilter;
  });

  const totalSesiBulanIni = hadirCount + izinCount + tidakMasukCount;
  const totalHariAktif = totalSesiBulanIni - izinCount;
  const pctKehadiran = totalHariAktif > 0 ? Math.round((hadirCount / totalHariAktif) * 100) : 0;
  const wajibHadirBulanIni = Math.ceil(totalSesiBulanIni * 0.5 * 0.75);
  const statusAmanBulanIni = totalSesiBulanIni === 0
    ? 'Belum Ada Sesi'
    : hadirCount >= wajibHadirBulanIni
      ? 'Memenuhi Target'
      : 'Belum Memenuhi';

  const lateRecords = filteredAttendances.filter((a) => a.isLate && a.lateMinutes);
  const avgLateMin = lateRecords.length > 0
    ? Math.round(lateRecords.reduce((s, a) => s + (a.lateMinutes ?? 0), 0) / lateRecords.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#7A7A75] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{teacher.name}</h1>
          <p className="text-xs text-[#7A7A75]">{teacher.email}{teacher.nim ? ` · ${teacher.nim}` : ''}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
        {/* Target & Status Bulan Ini — Bento Metrics Card */}
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
            <p className="text-[12px] font-semibold text-[#7A7A75] uppercase tracking-wider">
              Target & Status — {MONTHS[monthFilter - 1]} {yearFilter}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-[11px] font-semibold text-[#7A7A75] uppercase tracking-wider mb-1">Kehadiran</p>
              <p className="text-[34px] font-bold leading-none tracking-tighter text-[#1A1A18]">{pctKehadiran}%</p>
              <p className="text-[11px] text-[#7A7A75] mt-1">{hadirCount} dari {totalHariAktif} aktif</p>
            </div>
            <div className="text-center border-x border-[#EAEAE7]">
              <p className="text-[11px] font-semibold text-[#7A7A75] uppercase tracking-wider mb-1">Wajib Hadir</p>
              <p className="text-[34px] font-bold leading-none tracking-tighter text-[#1A1A18]">{wajibHadirBulanIni}</p>
              <p className="text-[11px] text-[#7A7A75] mt-1">dari {totalSesiBulanIni} sesi</p>
            </div>
            <div className="text-center flex flex-col items-center justify-between">
              <p className="text-[11px] font-semibold text-[#7A7A75] uppercase tracking-wider mb-1">Status</p>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                  statusAmanBulanIni === 'Memenuhi Target'
                    ? 'bg-[#EDF5EE] text-[#5B9C64] ring-[#5B9C64]/20'
                    : statusAmanBulanIni === 'Belum Ada Sesi'
                    ? 'bg-stone-50 text-stone-700 ring-stone-600/20'
                    : 'bg-[#FDF1F2] text-[#D4787C] ring-[#D4787C]/20'
                }`}>
                  {statusAmanBulanIni}
                </span>
              </div>
              <p className="text-[11px] text-[#7A7A75] mt-1.5">Izin: {izinCount} hari</p>
            </div>
          </div>

          {totalSesiBulanIni > 0 && (
            <div className="border-t border-[#EAEAE7] pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#7A7A75] font-medium">Progres kehadiran</span>
                <span className="text-[11px] font-semibold text-[#5B9C64]">{hadirCount}/{wajibHadirBulanIni} sesi</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#EAEAE7] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5B9C64] transition-all duration-300"
                  style={{ width: `${Math.min(100, (hadirCount / Math.max(1, wajibHadirBulanIni)) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EAEAE7]">
            <span className="text-[12px] text-[#7A7A75]">Rata-rata terlambat</span>
            <span className="text-[14px] font-bold text-[#D9A06B]">{avgLateMin} <span className="text-[11px] text-[#7A7A75] font-normal">menit</span></span>
          </div>
        </div>

        {/* Status Bulanan */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#7A7A75]" />
            <p className="text-sm font-medium">Status Bulanan</p>
            <span className="ml-auto text-xs text-[#7A7A75]">
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
        </div>

        {/* Summary All-Time */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-xs text-[#7A7A75] mt-0.5">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-[#5B9C64]">{onTime}</p>
            <p className="text-xs text-[#7A7A75] mt-0.5">Tepat</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-[#D9A06B]">{late}</p>
            <p className="text-xs text-[#7A7A75] mt-0.5">Telat</p>
          </div>
        </div>

        {/* Filter Bulan/Tahun */}
        <div className="flex items-center gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(Number(e.target.value))}
            className="text-[13px] border border-[#EAEAE7] rounded-[14px] px-3 py-2 bg-white focus:outline-none focus:border-[#D7FF3D]"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="text-[13px] border border-[#EAEAE7] rounded-[14px] px-3 py-2 bg-white focus:outline-none focus:border-[#D7FF3D]"
          >
            {[jkYear, jkYear - 1, jkYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Riwayat Presensi Harian */}
        {filteredAttendances.length === 0 ? (
          <div className="text-center py-16 text-[13px] text-[#7A7A75] bg-white rounded-[24px] border border-[#EAEAE7]">
            Belum ada riwayat presensi di {MONTHS[monthFilter - 1]} {yearFilter}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAttendances.map((a) => {
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
                    <div className="flex gap-3 text-xs text-[#7A7A75] mt-0.5">
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
