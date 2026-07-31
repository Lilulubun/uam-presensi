import { useNavigate } from 'react-router-dom';
import { QrCode, History, LogOut, Clock, CheckCircle2, ScanLine, CalendarDays, User, FileText } from 'lucide-react';
import { Button } from '../../app/components/ui/button';
import { LocationStatus } from '../../app/components/gps/LocationStatus';
import { useWatchLocation } from '../../app/hooks/useWatchLocation';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { getTpaById } from '../../store/tpaStore';
import { formatTime, formatDate, isSameDay, jakartaNow } from '../../lib/date-utils';
import { computeMonthlySummary, computeMonthlySummaryWithExpected } from '../../lib/computeMonthlySummary';
import { useIzinStore } from '../../store/izinStore';
import { useEffect, useMemo, useState } from 'react';
import { useUsersStore } from '../../store/userStore';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Day indices: 0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
const TPA_SCHEDULES: Record<string, number[]> = {
  'TPA Ulil Albab': [2, 4, 5],
  'TPA AS-SHOLIHIN': [2, 4, 5],
  'AZ-ZAHRA': [1, 2, 3, 4],
  'AL-MUHTADIN': [1, 2, 3, 4, 5],
  'AL-IMAN': [1, 2, 3, 4, 5],
  'AL-FATH': [2, 3, 5],
  'AL-HIDAYAH TANJUNG SARI': [4, 5, 6],
  'AL-JAMI': [1, 2, 3, 5],
  'AL-HIDAYAH BESI': [2, 6],
  'TPA Ananda': [1, 2, 3, 4, 5],
  'TPA Adz-dzikro': [2, 4, 6],
};

export default function DashboardPengajar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeSession = useSessionStore((s) => s.activeSession);
  const allAttendances = useAttendanceStore((s) => s.attendances);
  const { locationState, nearestTPA } = useWatchLocation(true);
  const myIzins = useIzinStore((s) => s.myIzins);
  const allSessions = useSessionStore((s) => s.sessions);
  const fetchMyExpectedSessions = useSessionStore((s) => s.fetchMyExpectedSessions);
  const [expectedSessionIds, setExpectedSessionIds] = useState<Set<string>>(new Set());

  const pendingIzins = myIzins.filter((i) => i.status === 'pending').length;
  const fetchMyIzins = useIzinStore((s) => s.fetchMyIzins);
  const loadUserTPAs = useUsersStore((s) => s.loadUserTPAs);
  const allUserTPAs = useUsersStore((s) => s.userTPAs);
  const userTPAs = allUserTPAs.filter((ut) => ut.userId === user?.id);

  useEffect(() => {
    fetchMyIzins();
    if (user?.id) {
      loadUserTPAs(user.id);
      fetchMyExpectedSessions(jakartaNow().year, jakartaNow().month + 1).then(setExpectedSessionIds);
    }
  }, []);

  const today = new Date();

  const todayAttendances = allAttendances.filter((a) => {
    if (a.userId !== user?.id) return false;
    const scanTime = a.scanInTime ?? a.scanOutTime;
    return scanTime && isSameDay(new Date(scanTime), today);
  });

  const todayRecord = todayAttendances[0] ?? null;

  const currentDay = today.getDay();
  const hasScheduleToday = useMemo(() => {
    if (userTPAs.length === 0) return true; // Default true jika relasi TPA belum di-set
    return userTPAs.some((ut) => {
      const cleanName = ut.tpaName ? ut.tpaName.trim() : '';
      const sched = TPA_SCHEDULES[cleanName];
      return sched ? sched.includes(currentDay) : true;
    });
  }, [userTPAs, currentDay]);

  const myAttendances = allAttendances.filter((a) => a.userId === user?.id);
  const { year: jkYear, month: jkMonth } = jakartaNow();
  const monthSummary = computeMonthlySummary(myAttendances, jkYear, jkMonth + 1);
  const expectedSummary = computeMonthlySummaryWithExpected(
    myAttendances,
    expectedSessionIds,
    myIzins.filter(i => i.status === 'approved'),
    jkYear,
    jkMonth + 1,
    allSessions
  );

  // Target + Status calculations
  const totalSesiBulanIni = expectedSummary.expectedCount;
  const totalHadirBulanIni = expectedSummary.actualHadir;
  const totalIzinBulanIni = expectedSummary.excusedCount;
  const wajibHadirBulanIni = expectedSummary.requiredCount;

  const statusAmanBulanIni =
    totalSesiBulanIni === 0
      ? 'Belum Ada Sesi Wajib'
      : totalHadirBulanIni >= wajibHadirBulanIni
        ? 'Memenuhi Target'
        : 'Belum Memenuhi';

  const recentAttendances = allAttendances
    .filter((a) => a.userId === user?.id && a.scanInTime)
    .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())
    .slice(0, 5);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusInfo = () => {
    if (!todayRecord && !hasScheduleToday) {
      return {
        label: 'Tidak ada jadwal mengajar',
        sub: 'TPA libur hari ini',
        badge: 'Libur',
        textColor: 'text-[#7A7A75]',
        icon: <CalendarDays className="w-6 h-6 text-[#7A7A75]" strokeWidth={1.5} />,
        gradient: 'bg-white border border-[#EAEAE7]',
        badgeStyle: 'bg-[#F4F4F2] text-[#7A7A75]',
      };
    }
    if (!todayRecord) {
      return {
        label: 'Belum melakukan presensi',
        sub: 'Scan QR untuk mulai',
        badge: 'Belum Hadir',
        textColor: 'text-[#1A1A18]',
        icon: <QrCode className="w-6 h-6 text-[#7A7A75]" />,
        gradient: 'bg-white border border-[#EAEAE7]',
        badgeStyle: 'bg-[#F4F4F2] text-[#7A7A75]',
      };
    }
    if (todayRecord.scanInTime && !todayRecord.scanOutTime) {
      const late = todayRecord.isLate;
      return {
        label: `Masuk ${formatTime(todayRecord.scanInTime)}`,
        sub: late ? `Terlambat ${todayRecord.lateMinutes} menit` : 'Tepat waktu',
        badge: late ? 'Terlambat' : 'On Track',
        textColor: 'text-white',
        icon: late
          ? <Clock className="w-6 h-6 text-white/80" />
          : <Clock className="w-6 h-6 text-white/80" />,
        gradient: late
          ? 'border-0'
          : 'border-0',
        gradientStyle: late
          ? { background: 'radial-gradient(circle at 30% 20%, #F2A63A, #E8823A 55%, #F2C97A)' }
          : { background: 'radial-gradient(circle at 30% 20%, #C8F06B, #8FE388 55%, #F4F08A)' },
        badgeStyle: 'bg-white/20 text-white backdrop-blur-sm',
      };
    }
    if (todayRecord.scanInTime && todayRecord.scanOutTime) {
      return {
        label: 'Presensi selesai',
        sub: `Keluar ${formatTime(todayRecord.scanOutTime)}`,
        badge: 'Selesai',
        textColor: 'text-white',
        icon: <CheckCircle2 className="w-6 h-6 text-white/80" />,
        gradient: 'border-0',
        gradientStyle: { background: 'radial-gradient(circle at 30% 20%, #C8F06B, #8FE388 55%, #F4F08A)' },
        badgeStyle: 'bg-white/20 text-white backdrop-blur-sm',
      };
    }
    return {
      label: 'Belum melakukan presensi',
      sub: 'Scan QR untuk mulai',
      badge: 'Belum Hadir',
      textColor: 'text-[#1A1A18]',
      icon: <QrCode className="w-6 h-6 text-[#7A7A75]" />,
      gradient: 'bg-white border border-[#EAEAE7]',
      badgeStyle: 'bg-[#F4F4F2] text-[#7A7A75]',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-bold text-[22px] tracking-tight">Presensi UAM</h1>
            <p className="text-[13px] text-[#7A7A75] font-medium">Halo, {user?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/profile')} className="text-[#7A7A75] hover:text-[#1A1A18] p-2 rounded-full hover:bg-[#F7F7F5] active:scale-[0.97] transition-transform duration-100 ease-out">
              <User className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button onClick={handleLogout} className="text-[#7A7A75] hover:text-[#1A1A18] p-2 min-h-[44px] min-w-[44px] rounded-full hover:bg-[#F7F7F5] active:scale-[0.97] transition-transform duration-100 ease-out">
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {user?.mustChangePassword && (
        <div className="bg-[#FDF4ED] border-b border-[#D9A06B]/20 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#D9A06B]" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#D9A06B]">Keamanan Akun</p>
              <p className="text-[12px] text-[#7A7A75] mt-0.5">Password sementara Anda masih aktif. Ganti password untuk mengamankan akun.</p>
            </div>
            <button
              onClick={() => navigate('/ganti-password')}
              className="shrink-0 flex items-center gap-1 text-[12px] font-semibold text-[#D9A06B] hover:text-[#B87830] bg-[#D9A06B]/10 hover:bg-[#D9A06B]/15 px-3 py-1.5 rounded-full transition-colors"
            >
              Ganti <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto p-4 sm:p-6 pb-24 flex flex-col gap-6">
        {/* Today's status card — gradient hero */}
        <div
          className={`relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] min-h-[160px] flex flex-col justify-between ${statusInfo.gradient}`}
          style={statusInfo.gradientStyle}
        >
          {/* grain overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")'}} />
          <div className="flex justify-between items-start z-10">
            <p className={`text-[13px] font-normal ${statusInfo.textColor === 'text-white' ? 'text-white/70' : 'text-[#7A7A75]'}`}>Status Hari Ini</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusInfo.badgeStyle}`}>
              {statusInfo.badge}
            </span>
          </div>
          <div className="z-10 flex items-end gap-3 mt-4">
            {statusInfo.icon}
            <div>
              <p className={`text-[22px] font-semibold leading-tight tracking-tight ${statusInfo.textColor}`}>{statusInfo.label}</p>
              <p className={`text-[13px] mt-0.5 ${statusInfo.textColor === 'text-white' ? 'text-white/65' : 'text-[#7A7A75]'}`}>{statusInfo.sub}</p>
            </div>
          </div>
          {/* dot matrix */}
          <div className="absolute bottom-0 right-0 w-24 h-24 opacity-[0.15] pointer-events-none" style={{backgroundImage:'radial-gradient(circle, white 1px, transparent 1px)',backgroundSize:'8px 8px'}} />
        </div>

        {/* Target + Status Card */}
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[11px] font-semibold text-[#7A7A75] mb-1">Wajib Hadir</p>
              <p className="text-[34px] font-bold leading-none tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>{wajibHadirBulanIni}</p>
              <p className="text-[11px] text-[#7A7A75] mt-1">dari {totalSesiBulanIni} sesi</p>
            </div>
            <div className="text-center border-x border-[#EAEAE7]">
              <p className="text-[11px] font-semibold text-[#7A7A75] mb-1">Izin</p>
              <p className="text-[34px] font-bold leading-none tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>{totalIzinBulanIni}</p>
              <p className="text-[11px] text-[#7A7A75] mt-1">hari bulan ini</p>
            </div>
            <div className="text-center flex flex-col justify-between items-center">
              <p className="text-[11px] font-semibold text-[#7A7A75] mb-1">Status</p>
              <div className="mt-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ring-1 ring-inset ${
                  statusAmanBulanIni === 'Memenuhi Target'
                    ? 'bg-[#EDF5EE] text-[#5B9C64] ring-[#5B9C64]/20'
                    : statusAmanBulanIni === 'Belum Ada Sesi Wajib'
                    ? 'bg-stone-50 text-stone-700 ring-stone-600/20'
                    : 'bg-[#FDF1F2] text-[#D4787C] ring-[#D4787C]/20'
                }`}>
                  {statusAmanBulanIni}
                </span>
              </div>
              <p className="text-[11px] text-[#7A7A75] mt-1.5">{totalHadirBulanIni} hadir / {Math.max(0, totalSesiBulanIni - totalIzinBulanIni)} aktif</p>
            </div>
          </div>
          {totalSesiBulanIni > 0 && (
            <div className="mt-4 pt-3 border-t border-[#EAEAE7]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#7A7A75] font-medium">Progres Kehadiran</span>
                <span className="text-[11px] font-semibold text-[#5B9C64]">{totalHadirBulanIni}/{wajibHadirBulanIni} sesi</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#EAEAE7] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5B9C64] motion-safe:transition-[box-shadow,border-color,opacity,transform] duration-300"
                  style={{ width: `${Math.min(100, (totalHadirBulanIni / Math.max(1, wajibHadirBulanIni)) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Monthly summary card */}
        {monthSummary.total > 0 && (
          <div className="bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
              <h2 className="text-[13px] font-semibold text-[#6B6B66]">
                Ringkasan Bulan Ini
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[40px] font-bold leading-none tracking-tighter text-[#1A1A18]" style={{fontFamily: "'Doto', monospace"}}>{monthSummary.total}</p>
                <p className="text-[11px] text-[#7A7A75] mt-1.5">Total Hadir</p>
              </div>
              <div className="border-x border-[#EAEAE7]">
                <p className="text-[40px] font-bold leading-none tracking-tighter text-[#5B9C64]" style={{fontFamily: "'Doto', monospace"}}>{monthSummary.onTime}</p>
                <p className="text-[11px] text-[#7A7A75] mt-1.5">Tepat Waktu</p>
              </div>
              <div>
                <p className="text-[40px] font-bold leading-none tracking-tighter text-[#D9A06B]" style={{fontFamily: "'Doto', monospace"}}>{monthSummary.late}</p>
                <p className="text-[11px] text-[#7A7A75] mt-1.5">Terlambat</p>
              </div>
            </div>
          </div>
        )}

        {/* GPS Location Status */}
        <div className="bg-white rounded-[24px] px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] flex items-center gap-3">
          <LocationStatus locationState={locationState} nearestTPA={nearestTPA} compact />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4">
          <Button className="w-full h-16 text-[16px] font-semibold rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646]" onClick={() => navigate('/pengajar/scan')}>
            <ScanLine className="w-5 h-5 mr-2" strokeWidth={1.5} />
            Scan QR Presensi
          </Button>

          <Button
            variant="outline"
            className="w-full h-16 text-[16px] font-semibold rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] relative"
            onClick={() => navigate('/pengajar/izin')}
          >
            <FileText className="w-5 h-5 mr-2" strokeWidth={1.5} />
            Ajukan Izin
            {pendingIzins > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D4787C] text-white text-xs flex items-center justify-center font-bold ring-2 ring-white">
                {pendingIzins}
              </span>
            )}
          </Button>

          {/* If user is the first teacher of an active session, show manage button */}
          {activeSession && (
            <Button
              variant="outline"
              className="w-full h-16 text-[14px] font-semibold rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5]"
              onClick={() => navigate(`/pengajar/session/${activeSession.id}`)}
            >
              <Clock className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Kelola Sesi Aktif — {getTpaById(activeSession.tpaId)?.name ?? 'TPA'}
            </Button>
          )}
        </div>

        {/* Recent attendance history */}
        {recentAttendances.length > 0 && (
          <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center gap-2 bg-[#F7F7F5]">
              <History className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-[#1A1A18]">Riwayat Presensi</p>
            </div>
            <ul className="divide-y divide-[#EAEAE7]">
              {recentAttendances.map((attendance) => (
                  <li key={attendance.id} className="px-6 py-4 hover:bg-[#F7F7F5] transition-colors motion-safe:starting:opacity-0 motion-safe:starting:translate-y-2 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-semibold text-[#1A1A18]">
                          {attendance.scanInTime ? formatDate(attendance.scanInTime) : '—'}
                        </p>
                        <div className="text-[12px] text-[#7A7A75] font-medium mt-1 flex gap-2">
                          {attendance.scanInTime && (
                            <span>Masuk {formatTime(attendance.scanInTime)}</span>
                          )}
                          {attendance.scanOutTime && (
                            <span>· Keluar {formatTime(attendance.scanOutTime)}</span>
                          )}
                        </div>
                      </div>
                      {attendance.isLate ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDF4ED] text-[#D9A06B] ring-1 ring-inset ring-[#D9A06B]/20">
                          Terlambat
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF5EE] text-[#5B9C64] ring-1 ring-inset ring-[#5B9C64]/20">
                          Tepat waktu
                        </span>
                      )}
                    </div>
                  </li>
              ))}
            </ul>
          </div>
        )}

        {recentAttendances.length === 0 && (
          <div className="text-center py-10 text-[13px] text-[#7A7A75] font-medium">
            Belum ada riwayat presensi
          </div>
        )}

        {recentAttendances.length > 0 && (
          <button
            onClick={() => navigate('/pengajar/riwayat')}
            className="text-xs text-[#7A7A75] font-medium underline underline-offset-2 text-center w-full hover:text-[#1A1A18] active:scale-[0.97] transition-transform duration-100 ease-out"
          >
            Lihat semua riwayat
          </button>
        )}
      </main>
    </div>
  );
}
