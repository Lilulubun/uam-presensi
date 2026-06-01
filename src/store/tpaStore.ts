import { create } from 'zustand';
import type { TPA } from '../types';
import { MOCK_TPAS, getTpaByQRCode, getTpaById } from '../lib/mock-data';

interface TPAState {
  tpas: TPA[];
  getTPAById: (id: string) => TPA | undefined;
  getTPAByStaticQR: (qrCode: string) => TPA | undefined;
}

export const useTPAStore = create<TPAState>()(() => ({
  tpas: MOCK_TPAS,

  getTPAById: (id: string) => getTpaById(id),

  getTPAByStaticQR: (qrCode: string) => getTpaByQRCode(qrCode),
}));
