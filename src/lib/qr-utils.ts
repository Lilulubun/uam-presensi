import QRCode from 'qrcode';
import type { QRToken } from '../types';
import { APP_CONFIG } from '../config';

/** Generate a dynamic QR token for check-in or check-out */
export function generateDynamicToken(
  sessionId: string,
  type: 'in' | 'out'
): QRToken {
  const token = crypto.randomUUID();
  const expiry = Date.now() + APP_CONFIG.QR_REFRESH_INTERVAL;

  return {
    token,
    sessionId,
    type,
    expiry,
  };
}

/**
 * Check if a QR token is expired
 */
export function isTokenExpired(expiry: number): boolean {
  return Date.now() > expiry;
}

/**
 * Encode QR token data to string for QR code generation
 */
export function encodeQRData(token: QRToken): string {
  return JSON.stringify({
    t: token.token,
    s: token.sessionId,
    y: token.type,
    e: token.expiry,
  });
}

/**
 * Decode QR code string back to token data
 */
export function decodeQRData(qrString: string): QRToken | null {
  try {
    const data = JSON.parse(qrString);

    // Validate structure
    if (!data.t || !data.s || !data.y || !data.e) {
      return null;
    }

    return {
      token: data.t,
      sessionId: data.s,
      type: data.y as 'in' | 'out',
      expiry: data.e,
    };
  } catch {
    return null;
  }
}

/**
 * Generate QR code image from token data
 * Returns base64 data URL
 */
export async function generateQRCodeImage(token: QRToken): Promise<string> {
  try {
    const qrData = encodeQRData(token);
    const dataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Gagal membuat QR code');
  }
}

/**
 * Validate static QR code format (TPA-XXX)
 */
export function isValidStaticQRCode(qrCode: string): boolean {
  return /^TPA-\d{3}$/.test(qrCode);
}
