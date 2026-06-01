import { useRef, useState } from 'react';
import { useQRScanner } from '../../hooks/useQRScanner';
import { Loader2, Camera, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const SCANNER_ELEMENT_ID = 'html5-qrcode-element';

export function QRScanner({ onScan, onError, disabled = false }: QRScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handleError = (msg: string) => {
    setCameraError(msg);
    onError?.(msg);
  };

  const handleScan = (text: string) => {
    if (!disabled) {
      onScan(text);
    }
  };

  useQRScanner({
    elementId: SCANNER_ELEMENT_ID,
    onScan: handleScan,
    onError: handleError,
    enabled: !disabled,
  });

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {cameraError ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 bg-muted rounded-xl text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{cameraError}</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          {/* Scanner target overlay */}
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full"
            style={{ minHeight: 300 }}
          />
          {/* Corner guides */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-52 h-52">
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
