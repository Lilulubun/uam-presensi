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
    pending: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Pending' },
    approved: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Disetujui' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Ditolak' },
  } as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Ajukan Izin</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Form Izin
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Alasan</label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tuliskan alasan izin..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Mengirim...' : 'Ajukan Izin'}
          </button>
        </form>

        {/* Riwayat */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Riwayat Pengajuan</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : myIzins.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada pengajuan izin</p>
          ) : (
            <ul className="divide-y">
              {myIzins.map((izin) => {
                const cfg = statusConfig[izin.status];
                const Icon = cfg.icon;

                return (
                  <li key={izin.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {formatDateId(izin.startDate)}
                          {' – '}
                          {formatDateId(izin.endDate)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{izin.alasan}</p>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
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
