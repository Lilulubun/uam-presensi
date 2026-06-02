import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { QRScanner } from '../../app/components/qr/QRScanner';
import { GPSDebugPanel } from '../../app/components/gps/GPSDebugPanel';
import { LocationStatus } from '../../app/components/gps/LocationStatus';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useWatchLocation } from '../../app/hooks/useWatchLocation';
import { getCurrentLocation } from '../../lib/gps-utils';
import { decodeQRData, isValidStaticQRCode } from '../../lib/qr-utils';
import { getTpaByStaticQR } from '../../store/tpaStore';

interface ActiveSessionInfo {
  tpaName: string;
  sessionId: string;
}

export default function ScanPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openSession = useSessionStore((s) => s.openSession);
  const getActiveSessionByTPA = useSessionStore((s) => s.getActiveSessionByTPA);
  const checkIn = useAttendanceStore((s) => s.checkIn);
  const checkOut = useAttendanceStore((s) => s.checkOut);

  const { locationState, nearestTPA, refetch: refetchLocation } = useWatchLocation(true);

  const [processing, setProcessing] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<ActiveSessionInfo | null>(null);
  const processingRef = useRef(false);

  const handleScan = useCallback(
    async (text: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);

      try {
        // Static QR: TPA-001 format
        if (isValidStaticQRCode(text)) {
          const tpa = getTpaByStaticQR(text);
          if (!tpa) {
            toast.error('TPA tidak ditemukan');
            return;
          }

          const existingSession = getActiveSessionByTPA(tpa.id);

          if (existingSession) {
            setActiveSessionInfo({ tpaName: tpa.name, sessionId: existingSession.id });
            return;
          }

          const location = await getCurrentLocation();
          const result = await openSession(tpa.id, location);

          if (result.valid) {
            toast.success(`Sesi dibuka di ${tpa.name}! Anda pengajar pertama.`);
            queueMicrotask(() => navigate(`/pengajar/session/${result.data.id}`));
          } else {
            toast.error(result.message);
          }
          return;
        }

        // Dynamic QR: JSON-encoded token
        const token = decodeQRData(text);
        if (!token) {
          toast.error('QR code tidak valid');
          return;
        }

        const location = await getCurrentLocation();

        if (token.type === 'in') {
          const result = await checkIn(token.sessionId, token.token, location);
          if (result.valid) {
            const reason = (result.data as { reason?: string | null })?.reason ?? null;
            queueMicrotask(() => navigate('/pengajar/konfirmasi', {
              state: { success: true, type: 'in', message: result.message, reason, data: result.data },
            }));
          } else {
            toast.error(result.message);
          }
        } else {
          const result = await checkOut(token.sessionId, token.token, location);
          if (result.valid) {
            queueMicrotask(() => navigate('/pengajar/konfirmasi', {
              state: { success: true, type: 'out', message: result.message, data: result.data },
            }));
          } else {
            toast.error(result.message);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [user, openSession, getActiveSessionByTPA, checkIn, checkOut, navigate]
  );

  const handleCameraError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Scan QR Presensi</h1>
      </header>

      <main className="flex-1 flex flex-col items-center gap-5 p-4 pt-6">
        {/* Scanner */}
        <div className={`w-full flex flex-col items-center gap-4 transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
          <QRScanner onScan={handleScan} onError={handleCameraError} />
          {processing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses...
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Arahkan kamera ke QR code statis TPA atau QR presensi pengajar pertama
            </p>
          )}
        </div>

        {/* GPS Location Status card */}
        <div className="w-full max-w-sm bg-card rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status Lokasi
            </p>
            {locationState.status !== 'loading' && (
              <button
                onClick={refetchLocation}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
                title="Refresh lokasi"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <LocationStatus locationState={locationState} nearestTPA={nearestTPA} />
        </div>

        {/* Active session info banner */}
        {activeSessionInfo && (
          <div className="w-full max-w-sm">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <div className="mt-0.5 shrink-0 text-blue-600">ℹ</div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">Sesi Aktif Ditemukan</p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>{activeSessionInfo.tpaName}</strong> sudah memiliki sesi. Scan QR presensi masuk dari
                  layar pengajar pertama di atas.
                </p>
                <button
                  className="mt-2 text-xs text-blue-600 underline underline-offset-2"
                  onClick={() => setActiveSessionInfo(null)}
                >
                  Scan ulang
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* GPS Debug Panel — floating at bottom, only in debug mode */}
      <GPSDebugPanel onLocationChange={refetchLocation} />
    </div>
  );
}
