// Application Configuration
export const APP_CONFIG = {
  QR_REFRESH_INTERVAL: 20000, // 20 seconds in milliseconds
  GPS_RADIUS_TOLERANCE: 100, // 100 meters
  LATE_THRESHOLD_MINUTES: 15, // 15 minutes after t_open
  SESSION_TIMEOUT_HOURS: 12, // Auto-mark as stale after 12 hours
} as const;

// Mock Authentication
export const ENABLE_MOCK_AUTH = true;

// GPS Debug Mode
export const GPS_DEBUG_MODE = true; // TODO: set false for production
export const GPS_MOCK_COORDS = {
  lat: -7.7536,
  lng: 110.3756,
}; // Default mock location (Condongcatur area)

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
