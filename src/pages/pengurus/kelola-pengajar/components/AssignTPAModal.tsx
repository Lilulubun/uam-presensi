import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogFooter,
} from '../../../../app/components/ui/alert-dialog';
import { useTPAStore } from '../../../../store/tpaStore';
import { useUsersStore } from '../../../../store/userStore';

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
}

export function AssignTPAModal({ open, userId, onClose }: Props) {
  const tpas = useTPAStore((s) => s.tpas);
  const userTPAs = useUsersStore((s) => s.userTPAs);
  const loadUserTPAs = useUsersStore((s) => s.loadUserTPAs);
  const assignTPA = useUsersStore((s) => s.assignTPA);
  const unassignTPA = useUsersStore((s) => s.unassignTPA);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (open && userId) loadUserTPAs(userId);
  }, [open, userId, loadUserTPAs]);

  const userAssignedTPAs = userTPAs.filter((t) => t.userId === userId);
  const assignedIds = new Set(userAssignedTPAs.map((t) => t.tpaId));

  const handleToggle = async (tpaId: string) => {
    setSaving(tpaId);
    const ok = assignedIds.has(tpaId)
      ? await unassignTPA(userId, tpaId)
      : await assignTPA(userId, tpaId);
    if (ok) {
      toast.success(assignedIds.has(tpaId) ? 'TPA dihapus' : 'TPA ditambahkan');
      loadUserTPAs(userId);
    } else {
      toast.error('Gagal mengubah TPA');
    }
    setSaving(null);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Atur TPA</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="px-6 py-2 space-y-2 max-h-64 overflow-y-auto">
          {tpas.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={assignedIds.has(t.id)}
                onChange={() => handleToggle(t.id)}
                disabled={saving === t.id}
                className="rounded border-input"
              />
              <span className="text-sm flex-1">{t.name}</span>
              {saving === t.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </label>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!saving}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
