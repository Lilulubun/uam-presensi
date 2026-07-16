// Application Configuration
export const APP_CONFIG = {
  QR_REFRESH_INTERVAL: 20000, // 20 seconds in milliseconds
  LATE_THRESHOLD_MINUTES: 15, // 15 minutes after t_open
} as const;

// UI Configuration
export const UI_CONFIG = {
  QR_SCANNER_FPS: 10,
  QR_SCANNER_QRBOX: 250,
} as const;
