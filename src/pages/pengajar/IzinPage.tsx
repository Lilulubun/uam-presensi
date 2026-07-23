import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CalendarDays, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useIzinStore } from '../../store/izinStore';
import { formatDateId } from '../../lib/date-utils';

export default function IzinPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { myIzins, loading, submitIzin, fetchMyIzins } = useIzinStore();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchMyIzins();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !alasan.trim()) {
      toast.error('Semua field harus diisi');
      return;
    }
    if (endDate < startDate) {
      toast.error('Tanggal akhir harus setelah atau sama dengan tanggal awal');
      return;
    }
    setSubmitting(true);
    const result = await submitIzin(startDate, endDate, alasan.trim());
    setSubmitting(false);
    if (result.valid) {
      toast.success(result.message);
      setStartDate('');
      setEndDate('');
      setAlasan('');
    } else {
      toast.error(result.message);
    }
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'text-[#D9A06B]', bg: 'bg-[#FDF4ED]', label: 'Pending' },
    approved: { icon: CheckCircle2, color: 'text-[#5B9C64]', bg: 'bg-[#EDF5EE]', label: 'Disetujui' },
    rejected: { icon: XCircle, color: 'text-[#D4787C]', bg: 'bg-[#FDF1F2]', label: 'Ditolak' },
  } as const;

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-[#7A7A75] hover:text-[#1A1A18] active:scale-[0.97] transition-transform duration-100 ease-out">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18]">Ajukan Izin</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] flex flex-col gap-5">
          <p className="text-[14px] font-semibold flex items-center gap-2 text-[#1A1A18]">
            <FileText className="w-4 h-4 text-[#A3A39D]" strokeWidth={1.5} />
            Form Izin
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="start-date" className="text-[12px] font-medium text-[#7A7A75]">Tanggal Mulai</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="end-date" className="text-[12px] font-medium text-[#7A7A75]">Tanggal Akhir</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full h-11 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="alasan" className="text-[12px] font-medium text-[#7A7A75]">Alasan</label>
            <textarea
              id="alasan"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tuliskan alasan izin..."
              className="w-full rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 py-3 text-sm resize-none focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              rows={3}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] font-semibold text-[14px] hover:bg-[#cbe646] disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />}
            {submitting ? 'Mengirim...' : 'Ajukan Izin'}
          </button>
        </form>

        {/* Riwayat */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EAEAE7] flex items-center gap-2 bg-[#F7F7F5]">
            <CalendarDays className="w-4 h-4 text-[#7A7A75]" strokeWidth={1.5} />
            <p className="text-[14px] font-semibold text-[#1A1A18]">Riwayat Pengajuan</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#D7FF3D]" strokeWidth={1.5} />
            </div>
          ) : myIzins.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14px] text-[#A3A39D] font-medium">Belum ada pengajuan izin</p>
          ) : (
            <ul className="divide-y divide-[#EAEAE7]">
              {myIzins.map((izin) => {
                const cfg = statusConfig[izin.status];
                const Icon = cfg.icon;

                return (
                  <li key={izin.id} className="px-6 py-5 hover:bg-[#F7F7F5] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] font-semibold text-[#1A1A18]">
                          {formatDateId(izin.startDate)} — {formatDateId(izin.endDate)}
                        </p>
                        <p className="text-[13px] text-[#7A7A75] mt-1.5 leading-relaxed">{izin.alasan}</p>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" strokeWidth={2} />
                        {cfg.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
