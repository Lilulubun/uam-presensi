import { useState, useEffect, useRef } from 'react';
import { generateQRCodeImage } from '../../lib/qr-utils';
import { rotateQRV2 } from '../../store/attendanceV2Adapter';
import { APP_CONFIG } from '../../config';

/**
 * v2 dynamic QR hook — uses rotate_qr_token_v2 RPC.
 * No longer reads deprecated qrDynamicInToken/qrDynamicOutToken columns from sessions table.
 */
export function useDynamicQR(sessionId: string, type: 'in' | 'out') {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(APP_CONFIG.QR_REFRESH_INTERVAL / 1000);
  const [token, setToken] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(null);
  const refreshingRef = useRef(false);
  const expiryRef = useRef<Date | null>(null);

  // Fetch initial token on mount
  useEffect(() => {
    if (type !== 'in') return; // v2 supports 'in' only (no check-out QR)

    (async () => {
      const result = await rotateQRV2(sessionId);
      if (result.valid && result.data) {
        const { token: t, expiry: e } = result.data as { token: string; expiry: string };
        const expiryDate = new Date(e);
        setToken(t);
        setExpiry(expiryDate);
        expiryRef.current = expiryDate;
      }
    })();
  }, [sessionId, type]);

  // Regenerate QR image whenever token changes
  useEffect(() => {
    if (!token || !expiry) return;

    const qrToken = {
      token,
      sessionId,
      type,
      expiry: expiry.getTime(),
    };

    generateQRCodeImage(qrToken).then(setQrDataUrl).catch(console.error);
  }, [token, sessionId, type, expiry]);

  // Countdown timer with auto-rotation
  useEffect(() => {
    if (!expiryRef.current) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiryRef.current!.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !refreshingRef.current) {
        refreshingRef.current = true;
        rotateQRV2(sessionId).then((result) => {
          if (result.valid && result.data) {
            const { token: t, expiry: e } = result.data as { token: string; expiry: string };
            const expiryDate = new Date(e);
            setToken(t);
            setExpiry(expiryDate);
            expiryRef.current = expiryDate;
          }
          refreshingRef.current = false;
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return { qrDataUrl, secondsLeft, token, expiry };
}
