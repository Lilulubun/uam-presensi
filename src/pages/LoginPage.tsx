import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../app/components/ui/button';
import { Input } from '../app/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Presensi UAM</h1>
            <p className="text-muted-foreground">
              UII Ayo Mengajar — Monitoring Presensi TPA
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="email@uii.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="password">
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
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
