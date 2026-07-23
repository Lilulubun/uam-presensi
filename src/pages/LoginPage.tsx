import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../app/components/ui/button';
import { Input } from '../app/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(identifier, password);

      if (result.valid) {
        const user = useAuthStore.getState().user;
        toast.success('Login berhasil!');

        // Redirect based on role
        if (user?.role === 'pengajar') {
          navigate('/pengajar/dashboard');
        } else {
          navigate('/pengurus/dashboard');
        }
      } else {
        toast.error(result.message || 'Login gagal');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan. Periksa koneksi Anda dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F2] p-4 font-sans text-[#1A1A18]">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),_0_1px_2px_rgba(0,0,0,0.02)] p-8 border border-[#EAEAE7]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light tracking-tight mb-1 text-[#1A1A18]">Presensi UAM</h1>
            <p className="text-[#7A7A75] text-sm">
              UII Ayo Mengajar — Monitoring Presensi TPA
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[#6B6B66]" htmlFor="identifier">
                NIM
              </label>
              <Input
                id="identifier"
                type="text"
                placeholder="20521001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={loading}
                className="rounded-[14px] h-11 border-[#EAEAE7] focus:border-[#D7FF3D] focus:ring-[#D7FF3D]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[#6B6B66]" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="rounded-[14px] h-11 border-[#EAEAE7] focus:border-[#D7FF3D] focus:ring-[#D7FF3D]/50"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#c5e835] font-semibold text-sm"
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
