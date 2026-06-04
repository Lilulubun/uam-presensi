import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, Check } from 'lucide-react';
import { Button } from '../../../../app/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from '../../../../app/components/ui/alert-dialog';
import { getUserById } from '../../../../store/userStore';
import { sendMagicLink, generateTemporaryPassword } from '../../../../lib/manage-user';

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
}

export function ResetPasswordModal({ open, userId, onClose }: Props) {
  const user = getUserById(userId);
  const [loading, setLoading] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMagicLink = async () => {
    if (!user) return;
    setLoading('magiclink');
    try {
      const result = await sendMagicLink(user.email);
      if (result.success) {
        toast.success('Email reset password terkirim');
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim email');
    } finally {
      setLoading(null);
    }
  };

  const handleTemporaryPassword = async () => {
    if (!user) return;
    setLoading('temporary');
    try {
      const result = await generateTemporaryPassword(user.email);
      if (result.success && result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
        toast.success('Password siap, salin dan kirim ke pengajar');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat password');
    } finally {
      setLoading(null);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset Password</AlertDialogTitle>
          <AlertDialogDescription>
            Pengajar: <strong>{user?.name ?? userId}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-6 py-2 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleMagicLink}
            disabled={!!loading}
          >
            {loading === 'magiclink' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...</>
            ) : (
              '📧 Kirim Email Reset'
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleTemporaryPassword}
            disabled={!!loading}
          >
            {loading === 'temporary' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat...</>
            ) : (
              '🔑 Buat Password Sementara'
            )}
          </Button>

          {tempPassword && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Password sementara (sekali lihat):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-background px-2 py-1 rounded border">
                  {tempPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="p-1.5 rounded hover:bg-background transition-colors"
                  title="Salin"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-xs text-orange-500 mt-1">Segera kirim ke pengajar. Password ini tidak bisa ditampilkan lagi.</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setTempPassword(null); setCopied(false); }}>
            Tutup
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
