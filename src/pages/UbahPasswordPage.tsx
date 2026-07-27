import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Button } from '../app/components/ui/button';
import { toast } from 'sonner';
import PageTransition from '../app/components/PageTransition';

export default function UbahPasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initAuth = useAuthStore((s) => s.init);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    if (user?.nim && password === `${user.nim}uam`) {
      toast.error('Password baru tidak boleh sama dengan password awal');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) throw authError;

      const { error: dbError } = await supabase.rpc('change_password_flag');

      if (dbError) throw dbError;

      toast.success('Password berhasil diubah');
      
      // Refresh user profile state to clear mustChangePassword flag
      await initAuth();
      
      // Redirect to correct dashboard
      navigate(user?.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Password change error:', err);
      toast.error(err.message || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F4F4F2] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-[#EAEAE7]">
          <div className="w-12 h-12 bg-[#F7F7F5] rounded-full flex items-center justify-center mb-6 mx-auto">
            <KeyRound className="w-6 h-6 text-[#1A1A18]" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-2xl font-bold text-center text-[#1A1A18] tracking-tight mb-2">
            Ubah Password
          </h1>
          <p className="text-[14px] text-center text-[#7A7A75] mb-8">
            Demi keamanan, Anda diwajibkan untuk mengubah password sementara Anda sebelum melanjutkan.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#7A7A75] mb-1.5">Password Baru</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full px-4 py-3 rounded-[16px] bg-[#F4F4F2] border border-transparent focus:border-[#D7FF3D] focus:bg-white focus:ring-4 focus:ring-[#D7FF3D]/10 outline-none transition-all text-[#1A1A18] placeholder:text-[#A3A39D]"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#7A7A75] mb-1.5">Konfirmasi Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-4 py-3 rounded-[16px] bg-[#F4F4F2] border border-transparent focus:border-[#D7FF3D] focus:bg-white focus:ring-4 focus:ring-[#D7FF3D]/10 outline-none transition-all text-[#1A1A18] placeholder:text-[#A3A39D]"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full mt-2 h-12 text-[15px] font-semibold rounded-[16px] bg-[#D7FF3D] hover:bg-[#c2e637] text-[#1A1A18]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Simpan Password <ArrowRight className="w-4 h-4 ml-1.5" strokeWidth={2} />
                </>
              )}
            </Button>
            
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-4 text-[14px] font-medium text-[#7A7A75] hover:text-[#1A1A18] py-2"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
