import { useState } from 'react';
import { MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { GPS_DEBUG_MODE } from '../../../config';
import { setDebugLocation } from '../../../lib/gps-utils';
import { useTPAStore } from '../../../store/tpaStore';

interface GPSDebugPanelProps {
  onLocationChange?: () => void;
}

const OFF_SITE = { label: 'Di Luar Radius (default)', lat: -7.7536, lng: 110.3756 };

export function GPSDebugPanel({ onLocationChange }: GPSDebugPanelProps) {
  const tpas = useTPAStore((s) => s.tpas);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('__off__');

  if (!GPS_DEBUG_MODE) return null;

  const handleSelect = (id: string) => {
    setSelectedId(id);

    if (id === '__off__') {
      setDebugLocation({ lat: OFF_SITE.lat, lng: OFF_SITE.lng });
    } else {
      const tpa = tpas.find((t) => t.id === id);
      if (tpa) {
        setDebugLocation({ lat: tpa.location.lat, lng: tpa.location.lng });
      }
    }

    onLocationChange?.();
    setOpen(false);
  };

  const currentLabel =
    selectedId === '__off__'
      ? OFF_SITE.label
      : (tpas.find((t) => t.id === selectedId)?.name ?? '—');

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      {open && (
        <div className="mb-2 bg-card border border-yellow-300 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs font-semibold text-yellow-800">
              Simulasi Lokasi GPS (Debug Mode)
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Pilih TPA untuk mensimulasikan berada di lokasi tersebut
            </p>
          </div>
          <ul className="max-h-52 overflow-y-auto divide-y">
            <li>
              <button
                onClick={() => handleSelect('__off__')}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                  selectedId === '__off__' ? 'bg-muted font-medium' : ''
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                {OFF_SITE.label}
              </button>
            </li>
            {tpas.map((tpa) => (
              <li key={tpa.id}>
                <button
                  onClick={() => handleSelect(tpa.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                    selectedId === tpa.id ? 'bg-muted font-medium' : ''
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {tpa.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-xl shadow text-xs font-medium text-yellow-800"
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">GPS Debug: {currentLabel}</span>
        </span>
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronUp className="w-4 h-4 shrink-0" />}
      </button>
    </div>
  );
}
