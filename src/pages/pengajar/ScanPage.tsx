import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { QRScanner } from '../../app/components/qr/QRScanner';
import PermissionPrompt from '../../app/components/gps/PermissionPrompt';
import { LocationStatus } from '../../app/components/gps/LocationStatus';
import { ExpectedTeacherSelector } from '../../app/components/session/ExpectedTeacherSelector';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useUsersStore } from '../../store/userStore';
import { useWatchLocation } from '../../app/hooks/useWatchLocation';
import { getCurrentLocation, calculateDistance } from '../../lib/gps-utils';
import { decodeQRData } from '../../lib/qr-utils';
import { getTpaByStaticQR } from '../../store/tpaStore';
import type { Coordinates } from '../../types';

interface ActiveSessionInfo {
  tpaName: string;
  sessionId: string;
}

export default function ScanPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openSessionWithExpected = useSessionStore((s) => s.openSessionWithExpected);
  const getActiveSessionByTPA = useSessionStore((s) => s.getActiveSessionByTPA);
  const checkIn = useAttendanceStore((s) => s.checkIn);
  const checkOut = useAttendanceStore((s) => s.checkOut);
  const pengajarByTPA = useUsersStore((s) => s.pengajarByTPA);
  const fetchPengajarByTPA = useUsersStore((s) => s.fetchPengajarByTPA);

  const { locationState, nearestTPA, refetch: refetchLocation } = useWatchLocation(true);

  const [processing, setProcessing] = useState(false);
  const [activeSessionInfo, setActiveSessionInfo] = useState<ActiveSessionInfo | null>(null);
  const [showExpectedSelector, setShowExpectedSelector] = useState(false);
  const [pendingTpaId, setPendingTpaId] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<Coordinates | null>(null);
  const processingRef = useRef(false);

  const handleScan = useCallback(
    async (text: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);

      try {
        // Static QR: try lookup by TPA's static QR code
        const tpa = getTpaByStaticQR(text);
        if (tpa) {
          const existingSession = getActiveSessionByTPA(tpa.id);

          if (existingSession) {
            setActiveSessionInfo({ tpaName: tpa.name, sessionId: existingSession.id });
            return;
          }

          const location = locationState.status === 'ready' ? locationState.coords : await getCurrentLocation();

          const distance = calculateDistance(location, tpa.location);
          if (distance > tpa.location.radius) {
            toast.error(`Anda berada di luar radius ${tpa.name}`);
            return;
          }

          // Fetch pengajar list for this TPA, then show ExpectedTeacherSelector
          const pengajarList = pengajarByTPA[tpa.id];
          if (!pengajarList || pengajarList.length === 0) {
            await fetchPengajarByTPA(tpa.id);
          }
          setPendingTpaId(tpa.id);
          setPendingLocation(location);
          setShowExpectedSelector(true);
          return;
        }

        // Dynamic QR: JSON-encoded token
        const token = decodeQRData(text);
        if (!token) {
          toast.error('QR code tidak dikenal. Pastikan Anda memindai QR TPA atau QR sesi yang aktif.');
          return;
        }

        const location = locationState.status === 'ready' ? locationState.coords : await getCurrentLocation();

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
          toast.error('QR presensi keluar tidak lagi diperlukan. Kehadiran Anda dicatat otomatis saat sesi ditutup.');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [user, openSessionWithExpected, getActiveSessionByTPA, checkIn, checkOut, navigate, locationState, pengajarByTPA, fetchPengajarByTPA]
  );

  const handleExpectedSubmit = useCallback(async (selectedIds: string[]) => {
    if (!pendingTpaId || !pendingLocation) return;

    setProcessing(true);
    try {
      const result = await openSessionWithExpected(pendingTpaId, pendingLocation, selectedIds);
      if (result.valid) {
        toast.success(`Sesi dibuka dengan ${selectedIds.length} pengajar wajib hadir!`);
        setShowExpectedSelector(false);
        queueMicrotask(() => navigate(`/pengajar/session/${result.data.id}`));
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setProcessing(false);
    }
  }, [pendingTpaId, pendingLocation, openSessionWithExpected, navigate]);

  const handleCameraError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  // Expose scan trigger globally for E2E tests immediately when ScanPage is loaded
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__simulateQRScan = (text: string) => {
        handleScan(text);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__simulateQRScan;
      }
    };
  }, [handleScan]);

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] flex flex-col pb-20">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18] flex-1">Scan QR Presensi</h1>
      </header>

      <main className="flex-1 flex flex-col items-center gap-5 p-4 pt-6">
        {/* Scanner — gated behind GPS permission prompt */}
        <PermissionPrompt>
          <div className={`w-full flex flex-col items-center gap-4 transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
            <QRScanner onScan={handleScan} onError={handleCameraError} />
            {processing ? (
            <div className="flex items-center gap-2 text-[14px] text-[#6B6B66] font-medium">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              Memproses...
            </div>
          ) : (
            <p className="text-[14px] text-[#6B6B66] font-medium text-center max-w-xs leading-relaxed">
              Arahkan kamera ke QR TPA (statis) untuk membuka sesi, atau QR sesi aktif dari pengajar pertama untuk presensi masuk
            </p>
          )}
        </div>
        </PermissionPrompt>

        {/* GPS Location Status card */}
        <div className="w-full max-w-sm bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-[#6B6B66]">
              Status Lokasi
            </p>
            {locationState.status !== 'loading' && (
              <button
                onClick={refetchLocation}
                className="text-[#7A7A75] hover:text-[#1A1A18] p-1.5 rounded-lg hover:bg-[#F7F7F5]"
                        title="Perbarui lokasi"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <LocationStatus locationState={locationState} nearestTPA={nearestTPA} />
        </div>

        {/* Expected Teacher Selector — shown after static QR scan */}
        {showExpectedSelector && pendingTpaId && (
          <div className="w-full max-w-sm">
            <ExpectedTeacherSelector
              teachers={pengajarByTPA[pendingTpaId] ?? []}
              currentUserId={user?.id ?? ''}
              onSubmit={handleExpectedSubmit}
              onCancel={() => {
                setShowExpectedSelector(false);
                setPendingTpaId(null);
                setPendingLocation(null);
              }}
              loading={processing}
            />
          </div>
        )}

        {/* Active session info banner */}
        {activeSessionInfo && (
          <div className="w-full max-w-sm">
            <div className="bg-emerald-50 border border-emerald-200 rounded-[24px] p-5 flex items-start gap-3">
              <div className="mt-0.5 shrink-0 text-emerald-600 text-[18px] font-bold">ℹ</div>
              <div>
                <p className="font-semibold text-emerald-900 text-[14px]">Sudah Ada Sesi Aktif</p>
                <p className="text-[13px] text-emerald-700 mt-1.5 leading-relaxed">
                  <strong>{activeSessionInfo.tpaName}</strong> sudah memiliki sesi. Scan QR presensi masuk dari
                  layar pengajar pertama di atas.
                </p>
                <button
                  className="mt-2 text-[12px] text-emerald-600 font-medium underline underline-offset-2 hover:text-emerald-800"
                  onClick={() => setActiveSessionInfo(null)}
                >
                  Scan ulang
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
