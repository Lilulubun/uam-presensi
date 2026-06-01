import type { Coordinates } from '../types';
import { GPS_DEBUG_MODE, GPS_MOCK_COORDS } from '../config';

// Runtime-overridable mock location for debug/testing
let _debugLocation: Coordinates = GPS_MOCK_COORDS;

export function setDebugLocation(coords: Coordinates): void {
  _debugLocation = coords;
}

export function getDebugLocation(): Coordinates {
  return _debugLocation;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if user location is within allowed radius of target location
 */
export function isWithinRadius(
  userLocation: Coordinates,
  targetLocation: Coordinates,
  radiusMeters: number
): boolean {
  if (GPS_DEBUG_MODE) {
    console.warn('⚠️ GPS_DEBUG_MODE is ACTIVE: Bypassing GPS validation!');
    return true; // Bypass GPS validation in debug mode
  }


  const distance = calculateDistance(userLocation, targetLocation);
  return distance <= radiusMeters;
}

/**
 * Get current GPS location from browser (or mock in debug mode)
 */
export function getCurrentLocation(): Promise<Coordinates> {
  if (GPS_DEBUG_MODE) {
    return Promise.resolve({ ..._debugLocation });
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung oleh browser Anda'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = 'Gagal mendapatkan lokasi';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Izinkan akses lokasi untuk melanjutkan';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Informasi lokasi tidak tersedia';
            break;
          case error.TIMEOUT:
            message = 'Waktu permintaan lokasi habis';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Find the nearest TPA and its distance from the given location
 */
export function findNearestTPA(
  userLocation: Coordinates,
  tpas: Array<{ id: string; location: { lat: number; lng: number; radius: number } }>
): { tpaId: string; distance: number; withinRadius: boolean } | null {
  if (tpas.length === 0) return null;

  let nearest = tpas[0];
  let minDist = calculateDistance(userLocation, nearest.location);

  for (const tpa of tpas.slice(1)) {
    const dist = calculateDistance(userLocation, tpa.location);
    if (dist < minDist) {
      minDist = dist;
      nearest = tpa;
    }
  }

  return {
    tpaId: nearest.id,
    distance: minDist,
    withinRadius: minDist <= nearest.location.radius,
  };
}
