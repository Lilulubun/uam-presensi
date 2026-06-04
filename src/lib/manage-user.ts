const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;

interface CreateResult {
  success: boolean;
  userId: string;
  emailSent: boolean;
  error?: string;
}

interface ResetPwResult {
  success: boolean;
  method: 'magiclink' | 'temporary';
  emailSent?: boolean;
  temporaryPassword?: string;
  error?: string;
}

async function callFunction<T>(payload: unknown): Promise<T> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
  nim: string,
  tpaIds: string[],
): Promise<CreateResult> {
  return callFunction<CreateResult>({
    action: 'create',
    email,
    name,
    nim,
    tpaIds,
  });
}

export async function sendMagicLink(email: string): Promise<ResetPwResult> {
  return callFunction<ResetPwResult>({
    action: 'reset-pw',
    email,
    mode: 'magiclink',
  });
}

export async function generateTemporaryPassword(email: string): Promise<ResetPwResult> {
  return callFunction<ResetPwResult>({
    action: 'reset-pw',
    email,
    mode: 'temporary',
  });
}
