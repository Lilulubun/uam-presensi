import { useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { UI_CONFIG } from '../../config';

interface UseQRScannerOptions {
  elementId: string;
  onScan: (text: string) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export function useQRScanner({
  elementId,
  onScan,
  onError,
  enabled = true,
}: UseQRScannerOptions) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const scanner = new Html5Qrcode(elementId, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: UI_CONFIG.QR_SCANNER_FPS,
          qrbox: { width: UI_CONFIG.QR_SCANNER_QRBOX, height: UI_CONFIG.QR_SCANNER_QRBOX },
        },
        (decodedText) => {
          if (isMounted) {
            onScanRef.current(decodedText);
          }
        },
        () => {
          // Scan failure on every frame — intentionally ignored
        }
      )
      .catch((err) => {
        console.error('QR Scanner error:', err);
        if (isMounted) {
          onErrorRef.current?.('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
        }
      });

    return () => {
      isMounted = false;
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [elementId, enabled]);

  return { stopScanner };
}
