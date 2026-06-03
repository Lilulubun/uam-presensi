// Application Configuration
export const APP_CONFIG = {
  QR_REFRESH_INTERVAL: 20000, // 20 seconds in milliseconds
  GPS_RADIUS_TOLERANCE: 100, // 100 meters
  LATE_THRESHOLD_MINUTES: 15, // 15 minutes after t_open
  SESSION_TIMEOUT_HOURS: 12, // Auto-mark as stale after 12 hours
} as const;

// GPS Debug Mode — env-gated, default off
export const GPS_DEBUG_MODE = import.meta.env.VITE_GPS_DEBUG === 'true';

// Export Formats
export const EXPORT_FORMATS = ['csv', 'excel', 'json'] as const;
export type ExportFormat = typeof EXPORT_FORMATS[number];

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 3000, // 3 seconds
  CONFETTI_DURATION: 2000, // 2 seconds
  QR_SCANNER_FPS: 10,
  QR_SCANNER_QRBOX: 250,
} as const;
