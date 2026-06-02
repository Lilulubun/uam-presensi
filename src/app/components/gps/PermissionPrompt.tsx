import { useState, type ReactNode } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { getCurrentLocation } from '../../../lib/gps-utils';

interface PermissionPromptProps {
  children: ReactNode;
}

export default function PermissionPrompt({ children }: PermissionPromptProps) {
  const [permission, setPermission] = useState<'prompt' | 'denied' | 'granted'>('prompt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    setRequesting(true);
    setErrorMsg(null);
    try {
      await getCurrentLocation();
      setPermission('granted');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Izinkan akses lokasi')) {
        setPermission('denied');
        setErrorMsg('Buka pengaturan browser \u2192 izinkan lokasi untuk situs ini.');
      } else {
        setPermission('prompt');
        setErrorMsg(message);
      }
    } finally {
      setRequesting(false);
    }
  };

  if (permission === 'granted') {
    return <>{children}</>;
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {permission === 'denied' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-amber-900">Akses Lokasi Diperlukan</p>
            <p className="text-sm text-amber-700 mt-1">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRequest}>
            Coba Lagi
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl p-6 flex flex-col items-center gap-4 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Izinkan Akses Lokasi</p>
            <p className="text-sm text-muted-foreground mt-1">
              Aplikasi memerlukan akses lokasi untuk verifikasi presensi
            </p>
          </div>
          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          <Button className="w-full" onClick={handleRequest} disabled={requesting}>
            {requesting ? 'Meminta...' : errorMsg ? 'Coba Lagi' : 'Izinkan Akses Lokasi'}
          </Button>
        </div>
      )}
    </div>
  );
}
