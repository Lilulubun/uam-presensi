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
import { generateTemporaryPassword } from '../../../../lib/manage-user';

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
}

export function ResetPasswordModal({ open, userId, onClose }: Props) {
  const user = getUserById(userId);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTemporaryPassword = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await generateTemporaryPassword(user.email);
      if (result.success && result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
        toast.success('Password siap, salin dan kirim ke pengajar');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat password');
    } finally {
      setLoading(false);
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
      <AlertDialogContent className="max-w-sm bg-white rounded-[28px] border border-[#EAEAE7]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-semibold text-[18px] text-[#1A1A18]">Reset Password</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[#6B6B66]">
            Pengajar: <strong>{user?.name ?? userId}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-6 py-2 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-[13px] text-[#6B6B66]"
            onClick={handleTemporaryPassword}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} /> Membuat...</>
            ) : (
              '🔑 Buat Password Sementara'
            )}
          </Button>

          {tempPassword && (
            <div className="bg-[#F7F7F5] rounded-[16px] p-4 border border-[#EAEAE7]">
              <p className="text-[11px] text-[#A3A39D] font-medium mb-2">Password sementara (sekali lihat):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[14px] font-mono bg-white px-3 py-1.5 rounded-[14px] border border-[#EAEAE7] text-[#1A1A18]">
                  {tempPassword}
                </code>
                <button
                  onClick={copyPassword}
                  className="p-2 rounded-[14px] hover:bg-[#F0F0EC] transition-colors border border-[#EAEAE7]"
                  title="Salin"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-4 h-4 text-[#6B6B66]" strokeWidth={1.5} />}
                </button>
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-2">Segera kirim ke pengajar. Password ini tidak bisa ditampilkan lagi.</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => { setTempPassword(null); setCopied(false); }}
            className="h-11 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] w-full"
          >
            Tutup
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
