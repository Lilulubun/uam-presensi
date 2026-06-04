import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../app/components/ui/button';
import { useUsersStore } from '../../../store/userStore';
import { useTPAStore } from '../../../store/tpaStore';
import { TambahPengajarModal } from './components/TambahPengajarModal';
import { AssignTPAModal } from './components/AssignTPAModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';

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
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);

  useEffect(() => {
    initUsers();
    loadTPAs();
  }, [initUsers, loadTPAs]);

  const pengajar = useMemo(
    () => users.filter((u) => u.role === 'pengajar'),
    [users],
  );

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
      // Filter by assigned TPA — needs loadUserTPAs for each user
      // For now, filter by TPA name in the display
    }
    return result;
  }, [pengajar, search, tpaFilter]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Kelola Pengajar</h1>
      </header>

      <main className="max-w-6xl mx-auto p-4 flex flex-col gap-4">
        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Cari nama, NIM, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={tpaFilter}
            onChange={(e) => setTpaFilter(e.target.value)}
          >
            <option value="">Semua TPA</option>
            {tpas.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button onClick={() => setShowTambah(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Tambah Pengajar
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Nama</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">NIM</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <p className="font-medium">{user.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.nim ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3 text-center">
                      {user.isActive !== false ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignTarget(user.id)}
                        >
                          TPA
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetTarget(user.id)}
                        >
                          Reset PW
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(user.id)}
                        >
                          {user.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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

      {assignTarget && (
        <AssignTPAModal
          open={!!assignTarget}
          userId={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          open={!!resetTarget}
          userId={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
