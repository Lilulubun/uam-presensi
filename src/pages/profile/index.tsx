import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../app/components/ui/button';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { AvatarOrb } from '../../lib/avatar-orb';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      toast.error('Semua field password wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: currentPassword,
      });
      if (signInErr) {
        toast.error('Password saat ini salah');
        setSubmitting(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        toast.error(updateErr.message);
        setSubmitting(false);
        return;
      }

      toast.success('Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Gagal mengubah password');
    } finally {
      setSubmitting(false);
    }
  };

  const dashboardPath = user?.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard';

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate(dashboardPath)} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight text-[#1A1A18] flex-1">Profil Saya</h1>
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <div className="flex items-center gap-4 mb-5">
            <AvatarOrb name={user?.name ?? 'User'} size="lg" />
            <div>
              <p className="font-semibold text-[18px] text-[#1A1A18]">{user?.name}</p>
              <p className="text-[14px] text-[#A3A39D] font-medium">{user?.email}</p>
            </div>
          </div>
          <dl className="space-y-3 text-[14px]">
            <div className="flex justify-between items-center">
              <dt className="text-[#A3A39D] font-medium">Role</dt>
              <dd className="font-semibold text-[#1A1A18]">{user?.role === 'pengajar' ? 'Pengajar' : 'Pengurus'}</dd>
            </div>
            {user?.nim && (
              <div className="flex justify-between items-center">
                <dt className="text-[#A3A39D] font-medium">NIM</dt>
                <dd className="font-semibold text-[#1A1A18]">{user.nim}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <h2 className="font-semibold text-[16px] text-[#1A1A18] mb-4">Ubah Password</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-medium text-[#6B6B66] block mb-1.5">Password Saat Ini</label>
              <div className="relative">
                <input
                  className="w-full h-11 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 pr-10 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A39D] hover:text-[#1A1A18]"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6B6B66] block mb-1.5">Password Baru</label>
              <div className="relative">
                <input
                  className="w-full h-11 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 pr-10 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A39D] hover:text-[#1A1A18]"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6B6B66] block mb-1.5">Konfirmasi Password Baru</label>
              <div className="relative">
                <input
                  className="w-full h-11 rounded-[14px] border border-[#EAEAE7] bg-[#F7F7F5] px-3 pr-10 text-sm focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A39D] hover:text-[#1A1A18]"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            <Button 
              className="w-full h-12 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] font-semibold text-[14px] hover:bg-[#cbe646]"
              onClick={handleChangePassword} 
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
              ) : (
                'Simpan Password'
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
