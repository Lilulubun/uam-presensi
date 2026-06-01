import { useState, useEffect, useCallback } from 'react';
import type { Coordinates } from '../../types';
import { getCurrentLocation, findNearestTPA } from '../../lib/gps-utils';
import { MOCK_TPAS } from '../../lib/mock-data';

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; coords: Coordinates };

interface NearestTPA {
  name: string;
  distance: number;
  withinRadius: boolean;
}

export function useWatchLocation(autoFetch = true) {
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' });
  const [nearestTPA, setNearestTPA] = useState<NearestTPA | null>(null);

  const fetch = useCallback(async () => {
    setLocationState({ status: 'loading' });
    try {
      const coords = await getCurrentLocation();
      setLocationState({ status: 'ready', coords });

      const nearest = findNearestTPA(coords, MOCK_TPAS);
      if (nearest) {
        const tpa = MOCK_TPAS.find((t) => t.id === nearest.tpaId);
        setNearestTPA({
          name: tpa?.name ?? '',
          distance: nearest.distance,
          withinRadius: nearest.withinRadius,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mendapatkan lokasi';
      setLocationState({ status: 'error', message });
      setNearestTPA(null);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  return { locationState, nearestTPA, refetch: fetch };
}
