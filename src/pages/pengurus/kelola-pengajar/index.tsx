import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../app/components/ui/button';
import { useUsersStore } from '../../../store/userStore';
import { useTPAStore } from '../../../store/tpaStore';
import { supabase } from '../../../lib/supabase';
import { TambahPengajarModal } from './components/TambahPengajarModal';
import { BulkTambahPengajarModal } from './components/BulkTambahPengajarModal';
import { AssignTPAModal } from './components/AssignTPAModal';
import { AvatarOrb } from '../../../lib/avatar-orb';

export default function KelolaPengajarPage() {
  const navigate = useNavigate();
  const users = useUsersStore((s) => s.users);
  const loading = useUsersStore((s) => s.loading);
  const initUsers = useUsersStore((s) => s.init);
  const tpas = useTPAStore((s) => s.tpas);
  const loadTPAs = useTPAStore((s) => s.init);
  const [search, setSearch] = useState('');
  const [tpaFilter, setTpaFilter] = useState('');
  const [showTambah, setShowTambah] = useState(false);
  const [showBulkTambah, setShowBulkTambah] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [userTPAs, setUserTPAs] = useState<Record<string, string[]>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    initUsers();
    loadTPAs();
  }, [initUsers, loadTPAs]);

  const pengajar = useMemo(
    () => users.filter((u) => u.role === 'pengajar'),
    [users],
  );

  // Load user-TPA assignments
  useEffect(() => {
    if (pengajar.length === 0) return;
    supabase
      .from('pengajar_tpa')
      .select('user_id, tpa_id')
      .in('user_id', pengajar.map((u) => u.id))
      .then(({ data, error }) => {
        if (error) return;
        const map: Record<string, string[]> = {};
        for (const row of data ?? []) {
          if (!map[row.user_id]) map[row.user_id] = [];
          const tpa = tpas.find((t) => t.id === row.tpa_id);
          if (tpa) map[row.user_id].push(tpa.name);
        }
        setUserTPAs(map);
      });
  }, [pengajar, tpas]);

  const filtered = useMemo(() => {
    let result = pengajar;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.nim ?? '').toLowerCase().includes(q),
      );
    }
    if (tpaFilter) {
      result = result.filter((u) => (userTPAs[u.id] ?? []).includes(tpas.find((t) => t.id === tpaFilter)?.name ?? ''));
    }
    return result;
  }, [pengajar, search, tpaFilter, userTPAs, tpas]);

  const handleToggleActive = async (userId: string) => {
    if (confirm('Yakin ingin mengubah status pengguna ini?')) {
      const ok = await useUsersStore.getState().toggleActive(userId);
      if (ok) {
        toast.success('Status berhasil diperbarui');
        initUsers();
      } else {
        toast.error('Gagal memperbarui status');
      }
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (confirm(`Yakin ingin menghapus ${name}? Semua data presensi dan catatan terkait akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) {
      setDeleting(userId);
      const ok = await useUsersStore.getState().deletePengajar(userId);
      if (ok) {
        toast.success(`${name} berhasil dihapus`);
        initUsers();
      } else {
        toast.error('Gagal menghapus pengajar');
      }
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18] flex-1">Kelola Pengajar</h1>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A39D]" strokeWidth={1.5} />
            <input
              className="w-full h-11 pl-10 pr-4 rounded-[14px] border border-[#EAEAE7] bg-white text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              placeholder="Cari nama, NIM, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-11 rounded-[14px] border border-[#EAEAE7] bg-white px-3 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
            value={tpaFilter}
            onChange={(e) => setTpaFilter(e.target.value)}
          >
            <option value="">Semua TPA</option>
            {tpas.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
           <div className="flex gap-2">
             <Button
                onClick={() => setShowTambah(true)}
                className="h-11 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold"
              >
               <UserPlus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
               Tambah
             </Button>
             <Button
                variant="outline"
                onClick={() => setShowBulkTambah(true)}
                className="h-11 rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
              >
               <FileText className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
               Import CSV
             </Button>
           </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAEAE7] bg-[#F7F7F5]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider">Nama</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider">NIM</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider hidden sm:table-cell">Email</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider">TPA</th>
                  <th className="text-center px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#6B6B66] uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAE7]">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F7F7F5] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <AvatarOrb name={user.name} size="sm" />
                        <p className="font-semibold text-[#1A1A18] text-[13px]">{user.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#6B6B66] font-medium text-[13px]">{user.nim ?? '—'}</td>
                    <td className="px-5 py-3.5 text-[#6B6B66] font-medium text-[13px] hidden sm:table-cell">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {(userTPAs[user.id] ?? []).length > 0 ? (
                          (userTPAs[user.id] ?? []).map((tpaName) => (
                            <span key={tpaName} className="text-[11px] bg-[#F0F0EC] text-[#5C5C57] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-[#EAEAE7]">
                              {tpaName}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] text-[#A3A39D]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {user.isActive !== false ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-wider">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 uppercase tracking-wider">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id)}
                          className="text-[12px] h-8 px-2"
                        >
                          {user.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={deleting === user.id}
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#A3A39D] font-medium">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#A3A39D] font-medium">
                      {search ? 'Tidak ada pengajar yang cocok' : 'Belum ada pengajar'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showTambah && (
        <TambahPengajarModal
          open={showTambah}
          onClose={() => setShowTambah(false)}
          onSuccess={() => {
            setShowTambah(false);
            initUsers();
          }}
        />
      )}

      {showBulkTambah && (
        <BulkTambahPengajarModal
          open={showBulkTambah}
          onClose={() => setShowBulkTambah(false)}
          onSuccess={() => {
            setShowBulkTambah(false);
            initUsers();
          }}
        />
      )}

      {assignTarget && (
        <AssignTPAModal
          open={!!assignTarget}
          userId={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}
