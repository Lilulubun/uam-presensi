import { create } from 'zustand';
import type { TPA } from '../types';
import { supabase } from '../lib/supabase';

interface TPAState {
  tpas: TPA[];
  loading: boolean;
  init: () => Promise<void>;
  getTPAById: (id: string) => TPA | undefined;
  getTPAByStaticQR: (qrCode: string) => TPA | undefined;
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

  getTPAById: (id: string) => get().tpas.find((t) => t.id === id),

  getTPAByStaticQR: (qrCode: string) =>
    get().tpas.find((t) => t.staticQRCode === qrCode),
}));
