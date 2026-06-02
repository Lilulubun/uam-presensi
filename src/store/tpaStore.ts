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
      set({ tpas: data as TPA[], loading: false });
    } else {
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
