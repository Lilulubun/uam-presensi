import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, User } from 'lucide-react';
import { useIzinStore } from '../../store/izinStore';
import { formatDateId } from '../../lib/date-utils';

const statusConfig = {
  pending: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Disetujui' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Ditolak' },
} as const;

export default function RiwayatIzinPengurus() {
  const navigate = useNavigate();
  const { allIzins, fetchAllIzins } = useIzinStore();

  useEffect(() => {
    fetchAllIzins();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Riwayat Izin</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {allIzins.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm p-8 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada pengajuan izin</p>
          </div>
        ) : (
          <ul className="divide-y bg-card rounded-xl shadow-sm overflow-hidden">
            {allIzins.map((izin) => {
              const cfg = statusConfig[izin.status];
              const Icon = cfg.icon;

              return (
                <li key={izin.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium">{izin.userName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateId(izin.startDate)}
                        {' – '}
                        {formatDateId(izin.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{izin.alasan}</p>
                      {izin.reviewedByName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Oleh: {izin.reviewedByName}
                          {izin.reviewedAt && ` • ${formatDateId(izin.reviewedAt)}`}
                        </p>
                      )}
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
      </main>
    </div>
  );
}
