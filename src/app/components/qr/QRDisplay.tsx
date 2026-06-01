import { useDynamicQR } from '../../hooks/useDynamicQR';
import { Loader2 } from 'lucide-react';
import { APP_CONFIG } from '../../../config';

interface QRDisplayProps {
  sessionId: string;
  type: 'in' | 'out';
  label?: string;
}

export function QRDisplay({ sessionId, type, label }: QRDisplayProps) {
  const { qrDataUrl, secondsLeft } = useDynamicQR(sessionId, type);

  const totalSeconds = APP_CONFIG.QR_REFRESH_INTERVAL / 1000;
  const progress = (secondsLeft / totalSeconds) * 100;

  const urgency = secondsLeft <= 5 ? 'text-destructive' : secondsLeft <= 10 ? 'text-orange-500' : 'text-primary';

  return (
    <div className="flex flex-col items-center gap-4">
      {label && (
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      )}

      {/* QR Code */}
      <div className="relative bg-white p-4 rounded-2xl shadow-md">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Dynamic QR Code"
            className="w-56 h-56 object-contain"
          />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="w-full max-w-xs">
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-center text-sm font-semibold tabular-nums ${urgency}`}>
          Berlaku {secondsLeft}s
        </p>
      </div>
    </div>
  );
}
