import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { generateQRCodeImage } from '../../lib/qr-utils';
import { APP_CONFIG } from '../../config';

export function useDynamicQR(sessionId: string, type: 'in' | 'out') {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(APP_CONFIG.QR_REFRESH_INTERVAL / 1000);

  const refreshQRToken = useSessionStore((s) => s.refreshQRToken);
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));

  const token = type === 'in' ? session?.qrDynamicInToken : session?.qrDynamicOutToken;
  const expiry = type === 'in' ? session?.qrDynamicInExpiry : session?.qrDynamicOutExpiry;

  // Regenerate QR image whenever the token changes
  useEffect(() => {
    if (!token || !expiry) return;

    const qrToken = {
      token,
      sessionId,
      type,
      expiry: expiry instanceof Date ? expiry.getTime() : new Date(expiry).getTime(),
    };

    generateQRCodeImage(qrToken).then(setQrDataUrl).catch(console.error);
  }, [token, sessionId, type]);

  // Countdown timer — ticks every second and refreshes token when expired
  const refreshRef = useRef(refreshQRToken);
  const refreshingRef = useRef(false);
  useEffect(() => {
    refreshRef.current = refreshQRToken;
  }, [refreshQRToken]);

  useEffect(() => {
    if (!expiry) return;

    const tick = () => {
      const expiryMs = expiry instanceof Date ? expiry.getTime() : new Date(expiry).getTime();
      const remaining = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !refreshingRef.current) {
        refreshingRef.current = true;
        refreshRef.current(sessionId, type).finally(() => {
          refreshingRef.current = false;
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiry, sessionId, type]);

  return { qrDataUrl, secondsLeft, token, expiry };
}
