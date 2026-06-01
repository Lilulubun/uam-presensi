import { Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { Coordinates } from '../../../types';
import { formatDistance } from '../../../lib/gps-utils';
import { GPS_DEBUG_MODE } from '../../../config';

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

interface LocationStatusProps {
  locationState: LocationState;
  nearestTPA?: NearestTPA | null;
  compact?: boolean;
}

export function LocationStatus({ locationState, nearestTPA, compact = false }: LocationStatusProps) {
  if (locationState.status === 'idle') return null;

  if (locationState.status === 'loading') {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        <Loader2 className={`animate-spin ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        <span>Memeriksa lokasi GPS...</span>
      </div>
    );
  }

  if (locationState.status === 'error') {
    return (
      <div className={`flex items-center gap-2 text-destructive ${compact ? 'text-xs' : 'text-sm'}`}>
        <AlertCircle className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span>{locationState.message}</span>
      </div>
    );
  }

  // Ready state
  if (!nearestTPA) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${compact ? 'text-xs' : 'text-sm'}`}>
        <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span>Lokasi tersedia{GPS_DEBUG_MODE ? ' (Simulasi)' : ''}</span>
      </div>
    );
  }

  const { name, distance, withinRadius } = nearestTPA;

  return (
    <div className={`flex items-start gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {withinRadius ? (
        <CheckCircle2 className={`shrink-0 text-green-600 mt-0.5 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
      ) : (
        <XCircle className={`shrink-0 text-orange-500 mt-0.5 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
      )}
      <div>
        <p className={withinRadius ? 'text-green-700' : 'text-orange-600'}>
          {withinRadius
            ? `Dalam radius ${name}`
            : `Di luar radius TPA terdekat`}
          {GPS_DEBUG_MODE && <span className="ml-1 text-yellow-600">(Simulasi)</span>}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {name} · {formatDistance(distance)}
        </p>
      </div>
    </div>
  );
}
