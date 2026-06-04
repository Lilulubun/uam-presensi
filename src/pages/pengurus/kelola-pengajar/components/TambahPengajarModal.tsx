import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../../app/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogFooter,
} from '../../../../app/components/ui/alert-dialog';
import { useTPAStore } from '../../../../store/tpaStore';
import { createUser } from '../../../../lib/manage-user';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TambahPengajarModal({ open, onClose, onSuccess }: Props) {
  const tpas = useTPAStore((s) => s.tpas);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nim, setNim] = useState('');
  const [selectedTPAs, setSelectedTPAs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Nama dan email wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await createUser(email.trim(), name.trim(), nim.trim(), selectedTPAs);
      toast.success(`Akun ${name} berhasil dibuat`);
      setName('');
      setEmail('');
      setNim('');
      setSelectedTPAs([]);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat akun');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Tambah Pengajar</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="px-6 py-2 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Nama Lengkap</label>
            <input
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nama pengajar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
            <input
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@uii.ac.id"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">NIM</label>
            <input
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="20521001"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">TPA</label>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedTPAs[0] ?? ''}
              onChange={(e) => setSelectedTPAs(e.target.value ? [e.target.value] : [])}
            >
              <option value="">Pilih TPA (opsional)</option>
              {tpas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
            ) : (
              'Simpan'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
