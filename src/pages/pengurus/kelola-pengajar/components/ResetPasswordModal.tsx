import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
  const [resetDone, setResetDone] = useState(false);

  const handleTemporaryPassword = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await generateTemporaryPassword(user.email);
      if (result.success) {
        setResetDone(true);
        toast.success('Password berhasil direset');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat password');
    } finally {
      setLoading(false);
    }
  };


  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-sm bg-white rounded-[28px] border border-[#EAEAE7]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-semibold text-[18px] text-[#1A1A18]">Reset Password</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[#7A7A75]">
            Pengajar: <strong>{user?.name ?? userId}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-6 py-2 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start rounded-[14px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-[13px] text-[#7A7A75]"
            onClick={handleTemporaryPassword}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} /> Membuat...</>
            ) : (
              'Reset Password'
            )}
          </Button>

          {resetDone && (
            <div className="bg-[#F7F7F5] rounded-[16px] p-4 border border-[#EAEAE7]">
              <p className="text-[12px] text-[#5B9C64] font-medium">Password kembali ke format awal berdasarkan NIM. Pengajar wajib mengubahnya saat login.</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => setResetDone(false)}
            className="h-11 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5] w-full"
          >
            Tutup
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
