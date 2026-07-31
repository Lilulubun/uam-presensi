import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useUsersStore } from '../../store/userStore';
import { useIzinStore } from '../../store/izinStore';
import { formatDate, formatTime, jakartaNow } from '../../lib/date-utils';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function DetailPengajar() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const attendances = useAttendanceStore((s) => s.attendances);
  const users = useUsersStore((s) => s.users);

  const teacher = users.find((u) => u.id === userId);

  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F2]">
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

  // wajibHadir = 75% × (expected - izin), izin mengurangi total sesi wajib
  const totalExpected = monthlyReport.filter((r) => r.isExpected).length;
  const adjustedExpected = Math.max(0, totalExpected - izinCount);
  const wajibHadirBulanIni = Math.ceil(adjustedExpected * 0.75);
  const statusAmanBulanIni = totalExpected === 0
    ? 'Belum Ada Sesi Wajib'
    : hadirCount >= wajibHadirBulanIni
      ? 'Memenuhi Target'
      : 'Belum Memenuhi';

  const lateRecords = filteredAttendances.filter((a) => a.isLate && a.lateMinutes);
  const avgLateMin = lateRecords.length > 0
    ? Math.round(lateRecords.reduce((s, a) => s + (a.lateMinutes ?? 0), 0) / lateRecords.length)
    : 0;

  // Noise texture SVG (shared across gradient cards)
  const noiseSvg = 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")';

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18]">
      {/* Header — glassmorphism, match DashboardPengurus */}
      <header className="bg-white/80 backdrop-blur-[20px] border-b border-[#EAEAE7] sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[#7A7A75] hover:text-[#1A1A18]">
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-[18px] tracking-tight">{teacher.name}</h1>
            <p className="text-[13px] text-[#7A7A75]">{teacher.email}{teacher.nim ? ` · ${teacher.nim}` : ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex flex-col gap-6">

        {/* Filter Periode */}
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-[#7A7A75]">Periode:</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(Number(e.target.value))}
            className="text-[14px] font-medium border border-[#EAEAE7] rounded-[14px] px-3 py-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:border-[#D7FF3D] cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="text-[14px] font-medium border border-[#EAEAE7] rounded-[14px] px-3 py-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:border-[#D7FF3D] cursor-pointer"
          >
            {[jkYear, jkYear - 1, jkYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Target & Status — Gradient Hero Card */}
        <div className="relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] min-h-[220px] flex flex-col justify-between border border-[#EAEAE7]"
          style={{ background: 'radial-gradient(circle at 30% 20%, #C8F06B, #8FE388 55%, #F4F08A)' }}
        >
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage: noiseSvg}}></div>

          {/* Heading */}
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1A1A18]/60" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#1A1A18]/60">
                Target & Status — {MONTHS[monthFilter - 1]} {yearFilter}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ${
              statusAmanBulanIni === 'Memenuhi Target'
                ? 'bg-white/60 text-[#1A1A18] ring-white/30'
                : statusAmanBulanIni === 'Belum Ada Sesi Wajib'
                ? 'bg-white/60 text-[#7A7A75] ring-white/30'
                : 'bg-white/60 text-[#D4787C] ring-white/30'
            }`}>
              {statusAmanBulanIni}
            </span>
          </div>

          {/* Hero numbers — Doto font */}
          <div className="z-10 mt-4 flex items-end gap-6">
            <div>
              <p className="text-[11px] font-semibold text-[#1A1A18]/50 mb-0.5">Kehadiran</p>
              <p className="text-[48px] sm:text-[64px] font-bold leading-[1.05] tracking-tighter text-[#1A1A18]"
                style={{fontFamily: "'Doto', monospace"}}>
                {pctKehadiran}%
              </p>
              <p className="text-[13px] text-[#1A1A18]/55">{hadirCount} dari {totalHariAktif} hari aktif</p>
            </div>
            <div className="border-l border-[#1A1A18]/15 pl-6">
              <p className="text-[11px] font-semibold text-[#1A1A18]/50 mb-0.5">Wajib Hadir</p>
              <p className="text-[48px] sm:text-[64px] font-bold leading-[1.05] tracking-tighter text-[#1A1A18]"
                style={{fontFamily: "'Doto', monospace"}}>
                {wajibHadirBulanIni}
              </p>
              <p className="text-[13px] text-[#1A1A18]/55">dari {totalSesiBulanIni} sesi · Izin {izinCount} hari</p>
            </div>
          </div>

          {/* Progress bar */}
          {totalSesiBulanIni > 0 && (
            <div className="z-10 mt-4 pt-3 border-t border-[#1A1A18]/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-[#1A1A18]/50">Progres kehadiran</span>
                <span className="text-[12px] font-bold text-[#1A1A18]/70">{hadirCount}/{wajibHadirBulanIni} sesi</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1A1A18]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1A1A18]/30 transition-all duration-300"
                  style={{ width: `${Math.min(100, (hadirCount / Math.max(1, wajibHadirBulanIni)) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Avg late */}
          <div className="z-10 flex items-center gap-2 mt-4 pt-3 border-t border-[#1A1A18]/10">
            <Clock className="w-3.5 h-3.5 text-[#1A1A18]/50" strokeWidth={1.5} />
            <span className="text-[12px] text-[#1A1A18]/55">Rata-rata terlambat</span>
            <span className="text-[15px] font-bold text-[#1A1A18]/80 ml-auto">{avgLateMin} <span className="text-[12px] font-normal text-[#1A1A18]/50">menit</span></span>
          </div>

          {/* Dot matrix motif — bottom right */}
          <div
            className="absolute bottom-0 right-0 w-32 h-32 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #1A1A18 1px, transparent 1px)',
              backgroundSize: '10px 10px'
            }}
          />
        </div>

        {/* Status Bulanan + All-Time Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Status Bulanan */}
          <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
              <p className="text-[13px] font-semibold text-[#1A1A18]">Status Bulanan</p>
              <span className="ml-auto text-[12px] text-[#7A7A75]">
                {MONTHS[monthFilter - 1]} {yearFilter}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-[20px] bg-[#EDF5EE]">
                <p className="text-[28px] font-bold text-[#5B9C64]" style={{fontFamily: "'Doto', monospace"}}>{hadirCount}</p>
                <p className="text-[11px] font-medium text-[#5B9C64] mt-0.5">Hadir</p>
              </div>
              <div className="text-center p-3 rounded-[20px] bg-[#EDF3F8]">
                <p className="text-[28px] font-bold text-[#8DB5D8]" style={{fontFamily: "'Doto', monospace"}}>{izinCount}</p>
                <p className="text-[11px] font-medium text-[#8DB5D8] mt-0.5">Izin</p>
              </div>
              <div className="text-center p-3 rounded-[20px] bg-[#FDF1F2]">
                <p className="text-[28px] font-bold text-[#D4787C]" style={{fontFamily: "'Doto', monospace"}}>{tidakMasukCount}</p>
                <p className="text-[11px] font-medium text-[#D4787C] mt-0.5">Tidak Masuk</p>
              </div>
            </div>
          </div>

          {/* Summary All-Time */}
          <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
            <p className="text-[13px] font-semibold text-[#1A1A18] mb-4">Akumulasi Seluruh Waktu</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-[20px] bg-[#F4F4F2]">
                <p className="text-[28px] font-bold text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>{total}</p>
                <p className="text-[11px] font-medium text-[#7A7A75] mt-0.5">Total Hadir</p>
              </div>
              <div className="text-center p-3 rounded-[20px] bg-[#EDF5EE]">
                <p className="text-[28px] font-bold text-[#5B9C64]" style={{fontFamily: "'Doto', monospace"}}>{onTime}</p>
                <p className="text-[11px] font-medium text-[#5B9C64] mt-0.5">Tepat Waktu</p>
              </div>
              <div className="text-center p-3 rounded-[20px] bg-[#FDF4ED]">
                <p className="text-[28px] font-bold text-[#D9A06B]" style={{fontFamily: "'Doto', monospace"}}>{late}</p>
                <p className="text-[11px] font-medium text-[#D9A06B] mt-0.5">Terlambat</p>
              </div>
            </div>
          </div>

        </div>

        {/* Riwayat Presensi Harian */}
        <div className="flex flex-col gap-3">
          {filteredAttendances.length === 0 ? (
            <div className="text-center py-16 text-[14px] text-[#7A7A75] bg-white rounded-[24px] border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              Belum ada riwayat presensi di {MONTHS[monthFilter - 1]} {yearFilter}
            </div>
          ) : (
            filteredAttendances.map((a) => (
              <div key={a.id} className="bg-white rounded-[24px] p-4 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
                <div className="shrink-0">
                  {a.scanOutTime ? (
                    <CheckCircle2 className="w-5 h-5 text-[#5B9C64]" strokeWidth={1.5} />
                  ) : (
                    <Clock className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[#1A1A18]">
                    {a.scanInTime ? formatDate(new Date(a.scanInTime)) : '—'}
                  </p>
                  <div className="flex gap-3 text-[12px] text-[#7A7A75] mt-0.5 tabular-nums">
                    {a.scanInTime && <span>Masuk {formatTime(new Date(a.scanInTime))}</span>}
                    {a.scanOutTime && <span>· Keluar {formatTime(new Date(a.scanOutTime))}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {a.isLate && (
                    <span className="text-[12px] font-semibold text-[#D9A06B] bg-[#FDF4ED] px-2 py-1 rounded-[10px]">
                      +{a.lateMinutes}m
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}
