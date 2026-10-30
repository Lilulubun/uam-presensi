import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../app/components/ui/button';

export default function PasswordRecoveryPage() {
  const recoveryUserId = useAuthStore((s) => s.recoveryUserId);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (password.length < 8) { setError('Password minimal 8 karakter'); return; }
    if (password !== confirmation) { setError('Konfirmasi password tidak cocok'); return; }
    setSubmitting(true);
    setError('');
    const result = await useAuthStore.getState().recoverPassword(password);
    setPassword('');
    setConfirmation('');
    if (result.valid) setSuccess(result.message);
    else setError(result.message);
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-[#F4F4F2] flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white rounded-[24px] p-8 space-y-5">
        <h1 className="text-2xl font-bold">Pulihkan Password</h1>
        {success ? <p role="status">{success}</p> : !recoveryUserId ? (
          <p role="alert">Tautan pemulihan tidak valid atau kedaluwarsa. Minta tautan baru.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p>Buat password baru tanpa memasukkan password lama.</p>
            <label className="block" htmlFor="recovery-password">Password Baru</label>
            <input id="recovery-password" type="password" autoComplete="new-password" required minLength={8}
              className="w-full border rounded-lg p-3" value={password} disabled={submitting}
              onChange={(e) => setPassword(e.target.value)} />
            <label className="block" htmlFor="recovery-confirmation">Konfirmasi Password Baru</label>
            <input id="recovery-confirmation" type="password" autoComplete="new-password" required minLength={8}
              className="w-full border rounded-lg p-3" value={confirmation} disabled={submitting}
              onChange={(e) => setConfirmation(e.target.value)} />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Menyimpan...' : 'Simpan Password'}
            </Button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <Link to="/login" onClick={() => useAuthStore.setState({ recoveryUserId: null })}>Kembali ke login</Link>
      </section>
    </main>
  );
}
