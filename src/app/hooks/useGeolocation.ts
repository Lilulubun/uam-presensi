import { useState, useCallback } from 'react';
import type { Coordinates } from '../../types';
import { getCurrentLocation } from '../../lib/gps-utils';

interface GeolocationState {
  location: Coordinates | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    loading: false,
  });

  const getLocation = useCallback(async (): Promise<Coordinates> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const coords = await getCurrentLocation();
      setState({ location: coords, error: null, loading: false });
      return coords;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mendapatkan lokasi';
      setState({ location: null, error: message, loading: false });
      throw err;
    }
  }, []);

  return { ...state, getLocation };
}
