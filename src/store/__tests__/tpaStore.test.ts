import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTpasSelect, resetMocks } = vi.hoisted(() => {
  const mockTpasSelect = vi.fn();
  const resetMocks = () => mockTpasSelect.mockReset();
  return { mockTpasSelect, resetMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'tpas') {
        return { select: mockTpasSelect };
      }
      return { select: vi.fn() };
    },
  },
}));

import { useTPAStore } from '../tpaStore';
import type { TPA } from '../../types';

const tpas: TPA[] = [
  { id: 'tpa-001', name: 'TPA Al-Fath', staticQRCode: 'TPA-001', location: { lat: -7.68, lng: 110.41, radius: 100 } },
  { id: 'tpa-002', name: 'TPA Adz-Dzikro', staticQRCode: 'TPA-002', location: { lat: -7.74, lng: 110.41, radius: 100 } },
];

describe('useTPAStore (Supabase-backed)', () => {
  beforeEach(() => {
    resetMocks();
    useTPAStore.setState({ tpas: [], loading: false } as any);
  });

  describe('init()', () => {
    it('fetches all 11 TPAs from Supabase and stores them', async () => {
      mockTpasSelect.mockResolvedValue({ data: tpas, error: null });
      await useTPAStore.getState().init();
      const { tpas: got } = useTPAStore.getState();
      expect(got.length).toBe(2);
      expect(got[0].id).toBe('tpa-001');
      expect(useTPAStore.getState().loading).toBe(false);
    });

    it('leaves tpas empty on error', async () => {
      mockTpasSelect.mockResolvedValue({ data: null, error: { message: 'network down' } });
      await useTPAStore.getState().init();
      expect(useTPAStore.getState().tpas).toEqual([]);
    });
  });

  describe('getTpaById()', () => {
    it('returns the matching TPA from cache', async () => {
      mockTpasSelect.mockResolvedValue({ data: tpas, error: null });
      await useTPAStore.getState().init();
      const got = useTPAStore.getState().getTpaById('tpa-002');
      expect(got?.name).toBe('TPA Adz-Dzikro');
    });

    it('returns undefined when not found', () => {
      expect(useTPAStore.getState().getTpaById('nope')).toBeUndefined();
    });
  });

  describe('getTpaByStaticQR()', () => {
    it('returns the matching TPA by static QR code', async () => {
      mockTpasSelect.mockResolvedValue({ data: tpas, error: null });
      await useTPAStore.getState().init();
      const got = useTPAStore.getState().getTpaByStaticQR('TPA-001');
      expect(got?.id).toBe('tpa-001');
    });
  });
});
