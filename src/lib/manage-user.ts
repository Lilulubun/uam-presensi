import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;

interface CreateResult {
  success: boolean;
  userId: string;
}

interface ResetPwResult {
  success: boolean;
  message?: string;
  error?: string;
}

async function callFunction<T>(payload: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Anda harus login ulang');

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Gagal memproses permintaan');
  }
  return data as T;
}

export async function createUser(
  email: string,
  name: string,
  nim?: string,
  tpaIds: string[] = [],
  role: 'pengajar' | 'pengurus' = 'pengajar',
  password?: string,
): Promise<CreateResult> {
  return callFunction<CreateResult>({
    action: 'create',
    email,
    name,
    nim,
    tpaIds,
    role,
    password,
  });
}

export async function generateTemporaryPassword(email: string): Promise<ResetPwResult> {
  return callFunction<ResetPwResult>({
    action: 'reset-pw',
    email,
    mode: 'temporary',
  });
}
