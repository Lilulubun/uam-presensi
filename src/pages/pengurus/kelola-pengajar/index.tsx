import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User, UserPlus, FileText, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../app/components/ui/button';
import { useUsersStore } from '../../../store/userStore';
import { useTPAStore } from '../../../store/tpaStore';
import { supabase } from '../../../lib/supabase';
import { TambahPengajarModal } from './components/TambahPengajarModal';
import { BulkTambahPengajarModal } from './components/BulkTambahPengajarModal';
import { AvatarOrb } from '../../../lib/avatar-orb';
import KelolaPengajarSkeleton from './components/KelolaPengajarSkeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../app/components/ui/alert-dialog';

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
  const [userTPAs, setUserTPAs] = useState<Record<string, string[]>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // AlertDialog State
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; currentActive: boolean } | null>(null);

  useEffect(() => {
    initUsers();
    loadTPAs();
  }, [initUsers, loadTPAs]);

  const pengajar = useMemo(
    () => users.filter((u) => u.role === 'pengajar'),
    [users],
  );

  // Load user-TPA assignments as TPA IDs (Probe 2 & 3)
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
          map[row.user_id].push(row.tpa_id);
        }
        setUserTPAs(map);
      });
  }, [pengajar]);

  // Memoized TPA ID to Name map (Probe 3)
  const tpaIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tpas) {
      map[t.id] = t.name;
    }
    return map;
  }, [tpas]);

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
      result = result.filter((u) => (userTPAs[u.id] ?? []).includes(tpaFilter));
    }
    return result;
  }, [pengajar, search, tpaFilter, userTPAs]);

  const handleToggleActive = async () => {
    if (!confirmToggle) return;
    const { id, name } = confirmToggle;
    const ok = await useUsersStore.getState().toggleActive(id);
    if (ok) {
      toast.success(`Status ${name} berhasil diperbarui`);
      initUsers();
    } else {
      toast.error('Gagal memperbarui status');
    }
    setConfirmToggle(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    setDeleting(id);
    const ok = await useUsersStore.getState().deletePengajar(id);
    if (ok) {
      toast.success(`${name} berhasil dihapus`);
      initUsers();
    } else {
      toast.error('Gagal menghapus pengajar');
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/80 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#7A7A75] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18] flex-1">Kelola Pengajar</h1>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
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
              className="h-11 rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#7A7A75] hover:text-[#1A1A18]"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              Import CSV
            </Button>
          </div>
        </div>

        {/* Result count */}
        {!loading && (
          <p className="text-[13px] text-[#6B6B66] font-medium px-1">
            {filtered.length} pengajar{search ? ` untuk "${search}"` : ''}{tpaFilter ? ` di ${tpas.find((t) => t.id === tpaFilter)?.name}` : ''}
          </p>
        )}

        {/* Content: skeleton | empty | card grid (mobile) | table (desktop) */}
        {loading ? (
          <KelolaPengajarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <UsersRound className="w-8 h-8 text-[#D0D0CB]" strokeWidth={1.5} />
            <p className="text-[13px] font-medium text-[#6B6B66]">
              {search ? 'Tidak ada pengajar yang cocok' : 'Belum ada pengajar'}
            </p>
            <p className="text-[12px] text-[#A3A39D]">
              {search ? 'Coba kata kunci lain atau ubah filter TPA' : 'Tambahkan pengajar untuk memulai'}
            </p>
          </div>
        ) : (
          <>
            {/* ===== MOBILE: Card grid (lg:hidden) ===== */}
            <div className="lg:hidden flex flex-col gap-3">
              {filtered.map((user) => {
                const tpaIds = userTPAs[user.id] ?? [];
                return (
                  <div
                    key={user.id}
                    className="bg-white rounded-[24px] p-4 border border-[#EAEAE7] shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col gap-3"
                  >
                    {/* Row 1: Avatar + Name + NIM */}
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarOrb name={user.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-[#1A1A18] truncate" title={user.name}>
                          {user.name}
                        </p>
                        <p className="text-[12px] text-[#7A7A75] truncate">{user.nim ?? '—'}</p>
                      </div>
                      {user.isActive !== false ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF5EE] text-[#5B9C64] ring-1 ring-inset ring-[#5B9C64]/20 shrink-0">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FDF1F2] text-[#D4787C] ring-1 ring-inset ring-[#D4787C]/20 shrink-0">
                          Nonaktif
                        </span>
                      )}
                    </div>

                    {/* Row 2: TPA badges */}
                    {tpaIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tpaIds.map((tpaId) => (
                          <span
                            key={tpaId}
                            className="text-[11px] bg-[#F0F0EC] text-[#5C5C57] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-[#EAEAE7]"
                          >
                            {tpaIdToName[tpaId] ?? tpaId}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Row 3: Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#EAEAE7]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/pengurus/pengajar/${user.id}`)}
                        className="text-[#1A1A18] hover:text-[#D7FF3D] h-8 px-3 text-[12px]"
                      >
                        <User className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
                        Detail
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmToggle({ id: user.id, name: user.name, currentActive: user.isActive !== false })}
                          className="text-[12px] h-8 px-2 text-[#7A7A75]"
                        >
                          {user.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D4787C] hover:text-[#D4787C] hover:bg-[#FDF1F2] h-8 w-8 p-0"
                          onClick={() => setConfirmDelete({ id: user.id, name: user.name })}
                          disabled={deleting === user.id}
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ===== DESKTOP: Table (hidden lg:table) ===== */}
            <div className="hidden lg:block bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EAEAE7] bg-[#F7F7F5]">
                      <th className="text-left px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">Nama</th>
                      <th className="text-left px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">NIM</th>
                      <th className="text-left px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">Email</th>
                      <th className="text-left px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">TPA</th>
                      <th className="text-center px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">Status</th>
                      <th className="text-right px-5 py-3 text-[13px] font-semibold text-[#6B6B66]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAE7]">
                    {filtered.map((user) => (
                      <tr key={user.id} className="hover:bg-[#F7F7F5] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <AvatarOrb name={user.name} size="sm" />
                            <p className="font-semibold text-[#1A1A18] text-[13px] max-w-[180px] truncate" title={user.name}>
                              {user.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[#7A7A75] font-medium text-[13px]">{user.nim ?? '—'}</td>
                        <td className="px-5 py-3.5 text-[#7A7A75] font-medium text-[13px] max-w-[200px] truncate" title={user.email}>
                          {user.email}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {(userTPAs[user.id] ?? []).length > 0 ? (
                              (userTPAs[user.id] ?? []).map((tpaId) => (
                                <span
                                  key={tpaId}
                                  className="text-[11px] bg-[#F0F0EC] text-[#5C5C57] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-[#EAEAE7]"
                                >
                                  {tpaIdToName[tpaId] ?? tpaId}
                                </span>
                              ))
                            ) : (
                              <span className="text-[12px] text-[#A3A39D]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {user.isActive !== false ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF5EE] text-[#5B9C64] ring-1 ring-inset ring-[#5B9C64]/20">
                              Aktif
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FDF1F2] text-[#D4787C] ring-1 ring-inset ring-[#D4787C]/20">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/pengurus/pengajar/${user.id}`)}
                              className="text-[#1A1A18] hover:text-[#D7FF3D] h-8 w-8 p-0"
                            >
                              <User className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmToggle({ id: user.id, name: user.name, currentActive: user.isActive !== false })}
                              className="text-[12px] h-8 px-2"
                            >
                              {user.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#D4787C] hover:text-[#D4787C] hover:bg-[#FDF1F2] h-8 w-8 p-0"
                              onClick={() => setConfirmDelete({ id: user.id, name: user.name })}
                              disabled={deleting === user.id}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
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

      {/* AlertDialog Delete Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-[24px] border-[#EAEAE7]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-[#1A1A18]">Hapus Pengajar?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6B66]">
              Tindakan ini akan menghapus akun <strong>{confirmDelete?.name}</strong> secara permanen. Semua data presensi dan riwayat mengajar terkait juga akan ikut terhapus dan tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel className="rounded-[14px] border-[#EAEAE7] mt-0">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-[14px] bg-[#D4787C] text-white hover:bg-[#c96266] font-semibold"
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog Toggle Status Confirmation */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(open) => !open && setConfirmToggle(null)}>
        <AlertDialogContent className="rounded-[24px] border-[#EAEAE7]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-[#1A1A18]">
              {confirmToggle?.currentActive ? 'Nonaktifkan Pengajar?' : 'Aktifkan Pengajar?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6B66]">
              Akun <strong>{confirmToggle?.name}</strong> akan diubah statusnya menjadi{' '}
              <strong>{confirmToggle?.currentActive ? 'Nonaktif' : 'Aktif'}</strong>. Pengajar nonaktif tidak akan bisa melakukan scan presensi ataupun login ke dalam sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel className="rounded-[14px] border-[#EAEAE7] mt-0">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              className="rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold"
            >
              Ubah Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
