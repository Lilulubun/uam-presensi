import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../app/components/ui/button';
import { formatTime } from '../../lib/date-utils';

interface ConfirmationState {
  success: boolean;
  type: 'in' | 'out';
  message: string;
  reason?: string | null;
  data?: {
    scanInTime?: Date;
    scanOutTime?: Date;
    isLate?: boolean;
    lateMinutes?: number;
  };
}

export default function KonfirmasiPresensi() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ConfirmationState | null;

  if (!state) {
    navigate('/pengajar/dashboard');
    return null;
  }

  const { success, type, message, reason, data } = state;
  const typeLabel = type === 'in' ? 'Masuk' : 'Keluar';
  const time = type === 'in' ? data?.scanInTime : data?.scanOutTime;
  const isFirstTeacherAuto = reason === 'FIRST_TEACHER_AUTO';

  return (
    <div className="min-h-screen bg-[#F4F4F2] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Icon — Soft Bento palette */}
        {isFirstTeacherAuto ? (
          <div className="w-20 h-20 rounded-full bg-[#EDF3F8] flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-[#8DB5D8]" strokeWidth={1.5} />
          </div>
        ) : success ? (
          <div className="w-20 h-20 rounded-full bg-[#EDF5EE] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-[#5B9C64]" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#FDF1F2] flex items-center justify-center">
            <XCircle className="w-10 h-10 text-[#D4787C]" strokeWidth={1.5} />
          </div>
        )}

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-[#1A1A18]">
            {isFirstTeacherAuto
              ? `Presensi ${typeLabel} Tercatat`
              : success
                ? `Presensi ${typeLabel} Berhasil!`
                : 'Presensi Gagal'}
          </h1>
          <p className="text-[#6B6B66] mt-1.5 text-[14px] leading-relaxed">
            {message}{isFirstTeacherAuto ? '. Scan diabaikan.' : ''}
          </p>
        </div>

        {/* Details card */}
        {!isFirstTeacherAuto && success && data && (
          <div className="w-full bg-white rounded-[24px] p-5 border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-left space-y-2.5">
            {time && (
              <div className="flex justify-between text-sm">
                <span className="text-[#7A7A75]">Waktu {typeLabel}</span>
                <span className="font-semibold text-[#1A1A18]">{formatTime(time)}</span>
              </div>
            )}
            {type === 'in' && data.isLate !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-[#7A7A75]">Status</span>
                <span className={`font-semibold ${data.isLate ? 'text-[#D9A06B]' : 'text-[#5B9C64]'}`}>
                  {data.isLate ? `Terlambat ${data.lateMinutes} menit` : 'Tepat Waktu'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-2">
          <Button
            className="w-full h-12 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold text-sm"
            onClick={() => navigate('/pengajar/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
          {!success && !isFirstTeacherAuto && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-[14px] border-[#EAEAE7] text-[#1A1A18] hover:bg-[#F7F7F5] font-semibold text-sm"
              onClick={() => navigate('/pengajar/scan')}
            >
              Coba Lagi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
