import { create } from 'zustand';
import type { TPA } from '../types';
import { supabase } from '../lib/supabase';

interface TPAState {
  tpas: TPA[];
  loading: boolean;
  init: () => Promise<void>;
  getTpaById: (id: string) => TPA | undefined;
  getTpaByStaticQR: (qrCode: string) => TPA | undefined;
}

export const useTPAStore = create<TPAState>((set, get) => ({
  tpas: [] as TPA[],
  loading: false,

  init: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('tpas').select('*');
    if (!error && data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        location: row.location,
        staticQRCode: row.static_qr_code,
      })) as TPA[];
      set({ tpas: mapped, loading: false });
    } else {
      if (error) console.error('tpaStore.init error:', error);
      set({ loading: false });
    }
  },

  getTpaById: (id: string) => get().tpas.find((t) => t.id === id),

  getTpaByStaticQR: (qrCode: string) =>
    get().tpas.find((t) => t.staticQRCode === qrCode),
}));

export const getTpaById = (id: string): TPA | undefined =>
  useTPAStore.getState().tpas.find((t) => t.id === id);

export const getTpaByStaticQR = (qrCode: string): TPA | undefined =>
  useTPAStore.getState().tpas.find((t) => t.staticQRCode === qrCode);
