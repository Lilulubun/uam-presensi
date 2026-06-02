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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Icon */}
        {isFirstTeacherAuto ? (
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-blue-600" />
          </div>
        ) : success ? (
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        )}

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold">
            {isFirstTeacherAuto
              ? `Presensi ${typeLabel} Tercatat`
              : success
                ? `Presensi ${typeLabel} Berhasil!`
                : 'Presensi Gagal'}
          </h1>
          <p className="text-muted-foreground mt-1">{message}{isFirstTeacherAuto ? '. Scan diabaikan.' : ''}</p>
        </div>

        {/* Details */}
        {!isFirstTeacherAuto && success && data && (
          <div className="w-full bg-card rounded-xl p-4 shadow-sm text-left space-y-2">
            {time && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Waktu {typeLabel}</span>
                <span className="font-medium">{formatTime(time)}</span>
              </div>
            )}
            {type === 'in' && data.isLate !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${data.isLate ? 'text-orange-500' : 'text-green-600'}`}>
                  {data.isLate ? `Terlambat ${data.lateMinutes} menit` : 'Tepat Waktu'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-2">
          <Button className="w-full" onClick={() => navigate('/pengajar/dashboard')}>
            Kembali ke Dashboard
          </Button>
          {!success && !isFirstTeacherAuto && (
            <Button variant="outline" className="w-full" onClick={() => navigate('/pengajar/scan')}>
              Coba Lagi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
