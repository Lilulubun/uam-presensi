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
import { computeMonthlySummary } from '../../lib/computeMonthlySummary';
import { useIzinStore } from '../../store/izinStore';
import { useEffect } from 'react';

export default function DashboardPengajar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeSession = useSessionStore((s) => s.activeSession);
  const allAttendances = useAttendanceStore((s) => s.attendances);
  const { locationState, nearestTPA } = useWatchLocation(true);
  const pendingIzins = useIzinStore((s) => s.myIzins.filter((i) => i.status === 'pending').length);
  const fetchMyIzins = useIzinStore((s) => s.fetchMyIzins);

  useEffect(() => {
    fetchMyIzins();
  }, []);

  const today = new Date();

  const todayAttendances = allAttendances.filter((a) => {
    if (a.userId !== user?.id) return false;
    const scanTime = a.scanInTime ?? a.scanOutTime;
    return scanTime && isSameDay(new Date(scanTime), today);
  });

  const todayRecord = todayAttendances[0] ?? null;

  const myAttendances = allAttendances.filter((a) => a.userId === user?.id);
  const { year: jkYear, month: jkMonth } = jakartaNow();
  const monthSummary = computeMonthlySummary(myAttendances, jkYear, jkMonth + 1);

  const recentAttendances = allAttendances
    .filter((a) => a.userId === user?.id && a.scanInTime)
    .sort((a, b) => new Date(b.scanInTime!).getTime() - new Date(a.scanInTime!).getTime())
    .slice(0, 5);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusInfo = () => {
    if (!todayRecord) {
      return {
        label: 'Belum melakukan presensi',
        sub: 'Scan QR untuk mulai',
        badge: 'Belum Hadir',
        textColor: 'text-[#1A1A18]',
        icon: <QrCode className="w-6 h-6 text-[#6B6B66]" />,
        gradient: 'bg-white border border-[#EAEAE7]',
        badgeStyle: 'bg-[#F4F4F2] text-[#6B6B66]',
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
      icon: <QrCode className="w-6 h-6 text-[#6B6B66]" />,
      gradient: 'bg-white border border-[#EAEAE7]',
      badgeStyle: 'bg-[#F4F4F2] text-[#6B6B66]',
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
            <p className="text-[13px] text-[#A3A39D] font-medium">Halo, {user?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('/profile')} className="text-[#6B6B66] hover:text-[#1A1A18] p-2 rounded-full hover:bg-[#F7F7F5]">
              <User className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button onClick={handleLogout} className="text-[#6B6B66] hover:text-[#1A1A18] p-2 rounded-full hover:bg-[#F7F7F5]">
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 sm:p-6 pb-24 flex flex-col gap-6">
        {/* Today's status card — gradient hero */}
        <div
          className={`relative overflow-hidden rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] min-h-[160px] flex flex-col justify-between ${statusInfo.gradient}`}
          style={statusInfo.gradientStyle}
        >
          {/* grain overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")'}} />
          <div className="flex justify-between items-start z-10">
            <p className={`text-[13px] font-normal ${statusInfo.textColor === 'text-white' ? 'text-white/70' : 'text-[#A3A39D]'}`}>Status Hari Ini</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusInfo.badgeStyle}`}>
              {statusInfo.badge}
            </span>
          </div>
          <div className="z-10 flex items-end gap-3 mt-4">
            {statusInfo.icon}
            <div>
              <p className={`text-[22px] font-light leading-tight tracking-tight ${statusInfo.textColor}`}>{statusInfo.label}</p>
              <p className={`text-[13px] mt-0.5 ${statusInfo.textColor === 'text-white' ? 'text-white/65' : 'text-[#6B6B66]'}`}>{statusInfo.sub}</p>
            </div>
          </div>
          {/* dot matrix */}
          <div className="absolute bottom-0 right-0 w-24 h-24 opacity-[0.15] pointer-events-none" style={{backgroundImage:'radial-gradient(circle, white 1px, transparent 1px)',backgroundSize:'8px 8px'}} />
        </div>

        {/* Monthly summary card */}
        {monthSummary.total > 0 && (
          <div className="bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays className="w-4 h-4 text-[#A3A39D]" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[#A3A39D] uppercase tracking-wider">
                Ringkasan Bulan Ini
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[40px] font-thin leading-none tracking-tighter text-[#1A1A18]">{monthSummary.total}</p>
                <p className="text-[12px] text-[#6B6B66] font-medium mt-1.5">Hadir</p>
              </div>
              <div>
                <p className="text-[40px] font-thin leading-none tracking-tighter text-emerald-600">{monthSummary.percentage}%</p>
                <p className="text-[12px] text-[#6B6B66] font-medium mt-1.5">Tepat Waktu</p>
              </div>
              <div>
                <p className="text-[40px] font-thin leading-none tracking-tighter text-amber-600">{monthSummary.late}</p>
                <p className="text-[12px] text-[#6B6B66] font-medium mt-1.5">Terlambat</p>
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
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold ring-2 ring-white">
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
              <History className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-[#1A1A18]">Riwayat Presensi</p>
            </div>
            <ul className="divide-y divide-[#EAEAE7]">
              {recentAttendances.map((attendance) => (
                  <li key={attendance.id} className="px-6 py-4 hover:bg-[#F7F7F5] transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-semibold text-[#1A1A18]">
                          {attendance.scanInTime ? formatDate(attendance.scanInTime) : '—'}
                        </p>
                        <div className="text-[12px] text-[#6B6B66] font-medium mt-1 flex gap-2">
                          {attendance.scanInTime && (
                            <span>Masuk {formatTime(attendance.scanInTime)}</span>
                          )}
                          {attendance.scanOutTime && (
                            <span>· Keluar {formatTime(attendance.scanOutTime)}</span>
                          )}
                        </div>
                      </div>
                      {attendance.isLate ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 uppercase">
                          Terlambat
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 uppercase">
                          Tepat Waktu
                        </span>
                      )}
                    </div>
                  </li>
              ))}
            </ul>
          </div>
        )}

        {recentAttendances.length === 0 && (
          <div className="text-center py-10 text-[13px] text-[#A3A39D] font-medium">
            Belum ada riwayat presensi
          </div>
        )}

        {recentAttendances.length > 0 && (
          <button
            onClick={() => navigate('/pengajar/riwayat')}
            className="text-xs text-[#6B6B66] font-medium underline underline-offset-2 text-center w-full hover:text-[#1A1A18]"
          >
            Lihat semua riwayat
          </button>
        )}
      </main>
    </div>
  );
}
