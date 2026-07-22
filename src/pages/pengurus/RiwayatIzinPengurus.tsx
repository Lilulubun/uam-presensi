import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, User } from 'lucide-react';
import { useIzinStore } from '../../store/izinStore';
import { formatDateId } from '../../lib/date-utils';

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 ring-amber-600/20', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-600/20', label: 'Disetujui' },
  rejected: { icon: XCircle, color: 'text-rose-700', bg: 'bg-rose-50 ring-rose-600/20', label: 'Ditolak' },
} as const;

export default function RiwayatIzinPengurus() {
  const navigate = useNavigate();
  const { allIzins, fetchAllIzins } = useIzinStore();

  useEffect(() => {
    fetchAllIzins();
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18]">Riwayat Izin</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        {allIzins.length === 0 ? (
          <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-12 text-center border border-[#EAEAE7]">
            <FileText className="w-10 h-10 mx-auto text-[#A3A39D] mb-3" strokeWidth={1.5} />
            <p className="text-[14px] text-[#6B6B66] font-medium">Belum ada pengajuan izin</p>
          </div>
        ) : (
          <ul className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7] divide-y divide-[#EAEAE7] overflow-hidden">
            {allIzins.map((izin) => {
              const cfg = statusConfig[izin.status];
              const Icon = cfg.icon;

              return (
                <li key={izin.id} className="px-6 py-5 hover:bg-[#F7F7F5] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#A3A39D] shrink-0" strokeWidth={1.5} />
                        <p className="text-[14px] font-semibold text-[#1A1A18]">{izin.userName}</p>
                      </div>
                      <p className="text-[12px] text-[#6B6B66] mt-1.5 font-medium">
                        {formatDateId(izin.startDate)} — {formatDateId(izin.endDate)}
                      </p>
                      <p className="text-[13px] text-[#6B6B66] mt-2 leading-relaxed line-clamp-2">{izin.alasan}</p>
                      {izin.reviewedByName && (
                        <p className="text-[11px] text-[#A3A39D] mt-2">
                          Oleh: {izin.reviewedByName}
                          {izin.reviewedAt && ` • ${formatDateId(izin.reviewedAt)}`}
                        </p>
                      )}
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
      </main>
    </div>
  );
}
