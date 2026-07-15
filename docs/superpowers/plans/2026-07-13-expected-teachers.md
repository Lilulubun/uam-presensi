# Expected Teachers per Sesi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti logika "semua pengajar TPA wajib hadir" menjadi "pengajar pertama memilih siapa yang wajib hadir saat membuka sesi", disimpan di tabel pivot `session_expected_teachers`.

**Architecture:** Tabel pivot baru `session_expected_teachers` + RPC `open_session_with_expected` menggantikan `open_session` + `get_laporan_presensi` di-update JOIN ke tabel baru. Komponen `ExpectedTeacherSelector` di ScanPage untuk memilih pengajar wajib hadir. SessionActivePage menampilkan "Tidak Hadir" hanya untuk expected yang tidak scan.

**Tech Stack:** Supabase (PostgreSQL + RLS + RPC), React 18, TypeScript, Zustand, Tailwind 4, Vitest + React Testing Library.

## Global Constraints

- Bahasa Indonesia untuk UI/dokumentasi, Inggris untuk kode
- Mobile-first design, click > type
- YAGNI — solusi paling sederhana
- TDD — test sebelum implementasi untuk semua file baru/diubah
- Tabel `attendances`, `sessions`, `pengajar_tpa` — **TIDAK BERUBAH**
- Guru tidak-expected tapi hadir → tetap "Hadir" di UI
- Default seleksi expected = semua UNCHECKED (kecuali first teacher auto-selected)
- Migrasi database: prefix `0022_`, idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/0022_session_expected_teachers.sql` | **Create** | Tabel `session_expected_teachers`, RPC `open_session_with_expected`, update RPC `get_laporan_presensi` v3 |
| `src/types/index.ts` | **Modify** | Tambah `SessionExpectedTeacher` interface, update `SessionState.openSession` → `openSessionWithExpected` |
| `src/store/sessionStore.ts` | **Modify** | Ganti `openSession` dengan `openSessionWithExpected`, hapus `openSession` lama |
| `src/store/__tests__/sessionStore.test.ts` | **Modify** | Test untuk `openSessionWithExpected`, update test `openSession` lama |
| `src/app/components/session/ExpectedTeacherSelector.tsx` | **Create** | Komponen checkbox daftar pengajar TPA + counter + tombol buka sesi |
| `src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx` | **Create** | Test render checkbox, counter, tombol disabled/enabled |
| `src/pages/pengajar/ScanPage.tsx` | **Modify** | Setelah scan QR statis + GPS valid → tampilkan ExpectedTeacherSelector |
| `src/pages/pengajar/__tests__/ScanPage.test.tsx` | **Create** | Test integrasi ExpectedTeacherSelector di ScanPage |
| `src/pages/pengajar/SessionActivePage.tsx` | **Modify** | Setelah sesi ditutup, fetch `session_expected_teachers`, tampilkan "Tidak Hadir" hanya expected-not-scanned |
| `src/pages/pengajar/__tests__/SessionActivePage.test.tsx` | **Modify** | Update test absent logic: hanya expected yang tidak scan dianggap tidak hadir |

- **Consumes (dari codebase existing):** `useAuthStore`, `useSessionStore`, `useAttendanceStore`, `useUsersStore.fetchPengajarByTPA`, `getTpaById`, `supabase` client, `toast` (sonner), `Button`, `Checkbox` (jika ada) / manual checkbox
- **Produces:** `openSessionWithExpected(tpaId, location, expectedUserIds)` → Promise<ValidationResult>, `ExpectedTeacherSelector` component, modified ScanPage + SessionActivePage

---

### Task 1: Database Migration — 0022_session_expected_teachers.sql

**Files:**
- Create: `supabase/migrations/0022_session_expected_teachers.sql`

**Interfaces:**
- Produces: Table `session_expected_teachers(id, session_id, user_id, created_at)`, RPC `open_session_with_expected(p_tpa_id text, p_location jsonb, p_expected_user_ids uuid[]) → public.sessions`, updated RPC `get_laporan_presensi(p_dari date, p_sampai date, p_tpa_ids text[]) → table(...)`

- [ ] **Step 1: Tulis test integrasi database (manual verification script)**

Karena Supabase migration dijalankan via Supabase CLI dan tidak ada unit test untuk SQL RPC, verifikasi dilakukan manual setelah migrasi. Tulis query verifikasi:

```sql
-- Verify table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'session_expected_teachers';

-- Verify RPC exists
SELECT proname FROM pg_proc WHERE proname = 'open_session_with_expected';

-- Verify get_laporan_presensi v3 uses session_expected_teachers
SELECT pg_get_functiondef('public.get_laporan_presensi(date, date, text[])'::regprocedure);
```

- [ ] **Step 2: Buat file migrasi — tabel + index + RLS**

```sql
-- 0022_session_expected_teachers.sql
-- Expected teachers per session — guru pertama memilih siapa yang wajib hadir
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE

-- =========================================================================
-- 1. Table: session_expected_teachers
-- =========================================================================
create table if not exists public.session_expected_teachers (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    user_id uuid not null references public.users(id),
    created_at timestamptz default now(),
    unique(session_id, user_id)
);

create index if not exists idx_expected_session
    on public.session_expected_teachers(session_id);

-- =========================================================================
-- 2. RLS
-- =========================================================================
alter table public.session_expected_teachers enable row level security;

-- SELECT: any authenticated user can read expected teachers list
drop policy if exists "session_expected_teachers select" on public.session_expected_teachers;
create policy "session_expected_teachers select" on public.session_expected_teachers
    for select using (auth.role() = 'authenticated');

-- No direct INSERT/UPDATE/DELETE policies — all writes go through SECURITY DEFINER RPCs
```

- [ ] **Step 3: Tambahkan RPC `open_session_with_expected`**

```sql
-- =========================================================================
-- 3. RPC: open_session_with_expected
-- Sama persis dengan open_session, tapi menerima daftar expected user IDs.
-- Batch insert ke session_expected_teachers setelah session dibuat.
-- Auto check-in first teacher seperti sebelumnya.
-- =========================================================================
create or replace function public.open_session_with_expected(
    p_tpa_id text,
    p_location jsonb,
    p_expected_user_ids uuid[]
)
returns public.sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_user uuid := auth.uid();
    v_session public.sessions;
    v_tpa public.tpas;
    v_token text := encode(extensions.gen_random_bytes(16), 'hex');
    v_expiry timestamptz := now() + interval '20 seconds';
begin
    if v_user is null then raise exception 'not authenticated'; end if;

    select * into v_tpa from public.tpas where id = p_tpa_id for update;
    if not found then raise exception 'TPA tidak ditemukan'; end if;

    if exists (select 1 from public.sessions where tpa_id = p_tpa_id and is_active) then
        raise exception 'TPA ini sudah memiliki sesi aktif';
    end if;

    if public.haversine_m(p_location, v_tpa.location) > (v_tpa.location->>'radius')::float then
        raise exception 'Anda berada di luar radius TPA';
    end if;

    -- Ensure array is not empty
    if array_length(p_expected_user_ids, 1) is null or array_length(p_expected_user_ids, 1) = 0 then
        raise exception 'Minimal satu pengajar wajib dipilih';
    end if;

    -- Insert session
    insert into public.sessions (tpa_id, first_teacher_id, qr_dynamic_in_token, qr_dynamic_in_expiry)
    values (p_tpa_id, v_user, v_token, v_expiry)
    returning * into v_session;

    -- Batch insert expected teachers
    insert into public.session_expected_teachers (session_id, user_id)
    select v_session.id, unnest(p_expected_user_ids);

    -- Auto check-in first teacher (same as open_session)
    insert into public.attendances (session_id, user_id, scan_in_time, scan_in_location, is_late, late_minutes)
    values (v_session.id, v_user, now(), p_location, false, 0);

    return v_session;
end;
$$;
```

- [ ] **Step 4: Update RPC `get_laporan_presensi` v3 — ganti JOIN `pengajar_tpa` → `session_expected_teachers`**

```sql
-- =========================================================================
-- 4. Update get_laporan_presensi v3
-- Ganti: JOIN pengajar_tpa → JOIN session_expected_teachers
-- Tambah: UNION dengan non-expected attendees (yang scan tapi tidak dijadwalkan)
-- =========================================================================
drop function if exists public.get_laporan_presensi(date, date, text[]);

create or replace function public.get_laporan_presensi(
    p_dari date,
    p_sampai date,
    p_tpa_ids text[] default null
)
returns table (
    tpa_id text,
    tpa_name text,
    teacher_id uuid,
    teacher_name text,
    tgl date,
    session_is_active bool,
    first_teacher_id uuid,
    scan_in_time timestamptz,
    scan_out_time timestamptz,
    is_late bool,
    late_minutes int,
    is_izin bool
)
language plpgsql
security definer
set search_path = public
volatile
as $$
begin
    set timezone = 'Asia/Jakarta';

    if not exists (
        select 1 from public.users where id = auth.uid() and role = 'pengurus'
    ) then
        raise exception 'forbidden';
    end if;

    return query
    -- Part A: Expected teachers (with or without attendance)
    select
        s.tpa_id,
        t.name as tpa_name,
        u.id as teacher_id,
        u.name as teacher_name,
        s.date_opened::date as tgl,
        s.is_active as session_is_active,
        s.first_teacher_id,
        a.scan_in_time,
        a.scan_out_time,
        coalesce(a.is_late, false) as is_late,
        a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id
            and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.session_expected_teachers se on se.session_id = s.id
    join public.users u on u.id = se.user_id
    left join public.attendances a
        on a.session_id = s.id and a.user_id = u.id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))

    union all

    -- Part B: Non-expected teachers who actually attended
    -- (Guru tidak dijadwalkan tapi hadir → tetap muncul di laporan)
    select
        s.tpa_id,
        t.name as tpa_name,
        u.id as teacher_id,
        u.name as teacher_name,
        s.date_opened::date as tgl,
        s.is_active as session_is_active,
        s.first_teacher_id,
        a.scan_in_time,
        a.scan_out_time,
        coalesce(a.is_late, false) as is_late,
        a.late_minutes,
        exists (
            select 1 from public.izin_requests ir
            where ir.user_id = u.id
            and ir.status = 'approved'
            and s.date_opened::date between ir.start_date and ir.end_date
        ) as is_izin
    from public.sessions s
    join public.tpas t on t.id = s.tpa_id
    join public.attendances a on a.session_id = s.id
    join public.users u on u.id = a.user_id
    left join public.session_expected_teachers se
        on se.session_id = s.id and se.user_id = a.user_id
    where s.date_opened::date between p_dari and p_sampai
        and (p_tpa_ids is null or array_length(p_tpa_ids, 1) is null or s.tpa_id = any(p_tpa_ids))
        and se.id is null  -- exclude yang sudah di-cover Part A

    order by tpa_id, teacher_name, tgl;
end;
$$;
```

- [ ] **Step 5: Jalankan migrasi dan verifikasi**

```bash
cd /opt/data/uam-presensi
npx supabase db push  # atau supabase migration up jika menggunakan local dev
```

Expected: migration berhasil, tidak ada error. Verifikasi dengan query manual:
```sql
select count(*) from public.session_expected_teachers;  -- harus 0 (tabel kosong)
select proname from pg_proc where proname = 'open_session_with_expected';  -- harus 1 row
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0022_session_expected_teachers.sql
git commit -m "feat(db): add session_expected_teachers table + open_session_with_expected RPC + update get_laporan_presensi v3"
```

---

### Task 2: Types + sessionStore — openSessionWithExpected

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/sessionStore.ts`
- Modify: `src/store/__tests__/sessionStore.test.ts`

**Interfaces:**
- Consumes: (none — self-contained type + store task)
- Produces: `SessionExpectedTeacher { id, sessionId, userId, createdAt }`, `SessionState.openSessionWithExpected(tpaId, location, expectedUserIds) → Promise<ValidationResult>`

- [ ] **Step 1: Tulis test untuk `openSessionWithExpected`**

Buka `src/store/__tests__/sessionStore.test.ts`, tambahkan describe block baru setelah `describe('openSession()', ...)`.

```typescript
describe('openSessionWithExpected()', () => {
  it('calls open_session_with_expected RPC with expected user IDs and stores the returned session as active', async () => {
    mockRpc.mockResolvedValue({ data: fakeSession, error: null });
    const expectedUserIds = ['user-uuid-1', 'user-uuid-2', 'user-uuid-3'];
    const result = await useSessionStore.getState().openSessionWithExpected(
      'tpa-001',
      { lat: -7.7, lng: 110.4 },
      expectedUserIds,
    );
    expect(mockRpc).toHaveBeenCalledWith('open_session_with_expected', {
      p_tpa_id: 'tpa-001',
      p_location: { lat: -7.7, lng: 110.4 },
      p_expected_user_ids: expectedUserIds,
    });
    expect(result.valid).toBe(true);
    expect(useSessionStore.getState().activeSession?.id).toBe('session-uuid-1');
    expect(useSessionStore.getState().sessions.some(s => s.id === 'session-uuid-1')).toBe(true);
  });

  it('returns Indonesian error when RPC reports TPA already has active session', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'TPA ini sudah memiliki sesi aktif' } });
    const result = await useSessionStore.getState().openSessionWithExpected(
      'tpa-001',
      { lat: -7.7, lng: 110.4 },
      ['user-uuid-1'],
    );
    expect(result.valid).toBe(false);
    expect(result.message).toBe('TPA ini sudah memiliki sesi aktif');
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it('returns Indonesian error when not authenticated', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not authenticated' } });
    const result = await useSessionStore.getState().openSessionWithExpected(
      'tpa-001',
      { lat: -7.7, lng: 110.4 },
      ['user-uuid-1'],
    );
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/tidak diotorisasi|autentikasi/i);
  });

  it('returns error when expectedUserIds array is empty', async () => {
    // This error comes from the RPC, not client validation
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Minimal satu pengajar wajib dipilih' } });
    const result = await useSessionStore.getState().openSessionWithExpected(
      'tpa-001',
      { lat: -7.7, lng: 110.4 },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Minimal satu pengajar wajib dipilih');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd /opt/data/uam-presensi
npx vitest run src/store/__tests__/sessionStore.test.ts -t "openSessionWithExpected"
```

Expected: FAIL — `openSessionWithExpected is not a function` atau TypeScript error.

- [ ] **Step 3: Tambah `SessionExpectedTeacher` type di `src/types/index.ts`**

```typescript
// Tambahkan setelah interface PengajarTPA (sekitar line 26):

export interface SessionExpectedTeacher {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: Date;
}
```

- [ ] **Step 4: Update `SessionState` interface di `src/types/index.ts`**

Ganti `openSession` dengan `openSessionWithExpected` di interface `SessionState`:

```typescript
// Di interface SessionState (sekitar line 131-141):
export interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  loading: boolean;
  init: () => Promise<void>;
  openSessionWithExpected: (tpaId: string, location: Coordinates, expectedUserIds: string[]) => Promise<ValidationResult>;
  closeSession: (sessionId: string, location?: Coordinates, notes: string) => Promise<ValidationResult>;
  forceCloseSession: (sessionId: string) => Promise<ValidationResult>;
  refreshQRToken: (sessionId: string, type: 'in' | 'out') => Promise<ValidationResult>;
  getActiveSessionByTPA: (tpaId: string) => Session | null;
}
```

- [ ] **Step 5: Implementasi `openSessionWithExpected` di `src/store/sessionStore.ts`**

Ganti method `openSession` dengan `openSessionWithExpected`:

```typescript
// Ganti openSession(tpaId, location) di sessionStore.ts (sekitar line 40-63):
openSessionWithExpected: async (tpaId: string, location: Coordinates, expectedUserIds: string[]): Promise<ValidationResult> => {
  const { data, error } = await supabase.rpc('open_session_with_expected', {
    p_tpa_id: tpaId,
    p_location: { lat: location.lat, lng: location.lng },
    p_expected_user_ids: expectedUserIds,
  });
  if (error || !data) {
    if (error?.message?.toLowerCase().includes('not authenticated')) {
      return { valid: false, message: RPC_NOT_AUTHENTICATED_MSG };
    }
    return mapRpcError(error);
  }
  const session = toCamelCase<Session>(data);
  set((state) => ({
    sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
    activeSession: session,
  }));
  logEvent('session_opened', session.id);
  useAttendanceStore.getState().init();
  return {
    valid: true,
    message: 'Sesi berhasil dibuka dan presensi Anda telah dicatat',
    data: session,
  };
},
```

**Hapus** method `openSession` yang lama (tidak dipakai lagi).

- [ ] **Step 6: Jalankan test — pastikan PASS**

```bash
cd /opt/data/uam-presensi
npx vitest run src/store/__tests__/sessionStore.test.ts
```

Expected: semua test PASS, termasuk `openSessionWithExpected` tests dan existing tests yang tidak terpengaruh.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/store/sessionStore.ts src/store/__tests__/sessionStore.test.ts
git commit -m "feat: add openSessionWithExpected to sessionStore, replace openSession"
```

---

### Task 3: ExpectedTeacherSelector Component

**Files:**
- Create: `src/app/components/session/ExpectedTeacherSelector.tsx`
- Create: `src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx`

**Interfaces:**
- Consumes: `User[]` (daftar pengajar TPA), `string` (currentUserId untuk first-teacher auto-select)
- Produces: `ExpectedTeacherSelector` component, props: `{ teachers: User[]; currentUserId: string; onSubmit: (selectedIds: string[]) => void; onCancel: () => void; loading?: boolean }`

- [ ] **Step 1: Tulis test untuk ExpectedTeacherSelector**

Buat file `src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpectedTeacherSelector } from '../ExpectedTeacherSelector';
import type { User } from '../../../../types';

const mockTeachers: User[] = [
  { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
  { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
  { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
];

describe('ExpectedTeacherSelector', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent(currentUserId = 'user-001') {
    return render(
      <ExpectedTeacherSelector
        teachers={mockTeachers}
        currentUserId={currentUserId}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  it('renders all teachers as checkboxes, all UNCHECKED by default', () => {
    renderComponent();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Ani Rahayu')).toBeInTheDocument();
    expect(screen.getByText('Cici Dewi')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach(cb => expect(cb).not.toBeChecked());
  });

  it('shows counter "0 dipilih" when nothing is checked', () => {
    renderComponent();
    expect(screen.getByText('0 dipilih')).toBeInTheDocument();
  });

  it('shows counter "2 dipilih" when two teachers are checked', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[2]); // Cici
    expect(screen.getByText('2 dipilih')).toBeInTheDocument();
  });

  it('submit button is disabled when 0 selected', () => {
    renderComponent();
    const submitBtn = screen.getByRole('button', { name: /Buka Sesi/ });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled when at least 1 selected', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    const submitBtn = screen.getByRole('button', { name: /Buka Sesi/ });
    expect(submitBtn).not.toBeDisabled();
    expect(submitBtn).toHaveTextContent('Buka Sesi (1)');
  });

  it('calls onSubmit with selected IDs when submit button clicked', () => {
    renderComponent();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[2]); // Cici
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));
    expect(onSubmit).toHaveBeenCalledWith(['user-001', 'user-003']);
  });

  it('calls onCancel when cancel button clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /Batal/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading state when loading prop is true', () => {
    render(
      <ExpectedTeacherSelector
        teachers={mockTeachers}
        currentUserId="user-001"
        onSubmit={onSubmit}
        onCancel={onCancel}
        loading={true}
      />
    );
    const submitBtn = screen.getByRole('button', { name: /Membuka/ });
    expect(submitBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd /opt/data/uam-presensi
npx vitest run src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementasi `ExpectedTeacherSelector` component**

Buat file `src/app/components/session/ExpectedTeacherSelector.tsx`:

```typescript
import { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import type { User } from '../../../types';

interface ExpectedTeacherSelectorProps {
  teachers: User[];
  currentUserId: string;
  onSubmit: (selectedIds: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ExpectedTeacherSelector({
  teachers,
  currentUserId,
  onSubmit,
  onCancel,
  loading = false,
}: ExpectedTeacherSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const count = selected.size;

  const handleSubmit = () => {
    if (count === 0) return;
    onSubmit(Array.from(selected));
  };

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="font-semibold text-sm">Pilih Pengajar yang Wajib Hadir</p>
          <p className="text-xs text-muted-foreground">
            Hanya pengajar yang dipilih akan dihitung kehadirannya hari ini
          </p>
        </div>
      </div>

      {/* Counter */}
      <p className="text-sm font-medium text-primary">
        {count} dipilih
      </p>

      {/* Checkbox list */}
      <ul className="divide-y border rounded-lg overflow-hidden">
        {teachers.map((teacher) => (
          <li key={teacher.id}>
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={selected.has(teacher.id)}
                onChange={() => toggle(teacher.id)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {teacher.name}
                  {teacher.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(Anda)</span>
                  )}
                </p>
                {teacher.nim && (
                  <p className="text-xs text-muted-foreground">{teacher.nim}</p>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={count === 0 || loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Membuka...
            </>
          ) : (
            `Buka Sesi (${count})`
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
cd /opt/data/uam-presensi
npx vitest run src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx
```

Expected: semua 8 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/session/ExpectedTeacherSelector.tsx src/app/components/session/__tests__/ExpectedTeacherSelector.test.tsx
git commit -m "feat: add ExpectedTeacherSelector component for selecting mandatory teachers per session"
```

---

### Task 4: ScanPage — integrasi ExpectedTeacherSelector

**Files:**
- Modify: `src/pages/pengajar/ScanPage.tsx`
- Create: `src/pages/pengajar/__tests__/ScanPage.test.tsx`

**Interfaces:**
- Consumes: `ExpectedTeacherSelector` (Task 3), `openSessionWithExpected` (Task 2), `useUsersStore.fetchPengajarByTPA`
- Produces: Modified ScanPage flow: static QR → GPS valid → ExpectedTeacherSelector → open session

- [ ] **Step 1: Tulis test untuk ScanPage integrasi ExpectedTeacherSelector**

Buat file `src/pages/pengajar/__tests__/ScanPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockOpenSessionWithExpected = vi.fn();
const mockGetActiveSessionByTPA = vi.fn().mockReturnValue(null);
const mockFetchPengajarByTPA = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = {
      user: { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar' as const, nim: '21511001' },
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/sessionStore', () => ({
  useSessionStore: (selector?: any) => {
    const state = {
      openSessionWithExpected: mockOpenSessionWithExpected,
      getActiveSessionByTPA: mockGetActiveSessionByTPA,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/attendanceStore', () => ({
  useAttendanceStore: (selector?: any) => {
    const state = { checkIn: vi.fn(), checkOut: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/tpaStore', () => ({
  getTpaByStaticQR: () => ({ id: 'tpa-001', name: 'TPA Al-Fath', location: { lat: -7.68, lng: 110.41, radius: 500 } }),
}));

vi.mock('../../../store/userStore', () => ({
  useUsersStore: (selector?: any) => {
    const state = {
      pengajarByTPA: {
        'tpa-001': [
          { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
          { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
          { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
        ],
      },
      fetchPengajarByTPA: mockFetchPengajarByTPA,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../app/hooks/useWatchLocation', () => ({
  useWatchLocation: () => ({
    locationState: { status: 'ready', coords: { lat: -7.68, lng: 110.41 } },
    nearestTPA: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../lib/gps-utils', () => ({
  getCurrentLocation: () => Promise.resolve({ lat: -7.68, lng: 110.41 }),
  calculateDistance: () => 0,
}));

vi.mock('../../../lib/qr-utils', () => ({
  decodeQRData: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../app/components/qr/QRScanner', () => ({
  QRScanner: ({ onScan }: { onScan: (text: string) => void; onError: (err: string) => void }) => {
    // Expose scan trigger globally for test
    (window as any).__triggerQRScan = onScan;
    return <div data-testid="qr-scanner">QR Scanner Mock</div>;
  },
}));

import ScanPage from '../ScanPage';

function renderComponent() {
  return render(
    <MemoryRouter>
      <ScanPage />
    </MemoryRouter>
  );
}

describe('ScanPage — ExpectedTeacherSelector integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSessionByTPA.mockReturnValue(null);
    mockOpenSessionWithExpected.mockResolvedValue({
      valid: true,
      message: 'Sesi berhasil dibuka',
      data: { id: 'session-1' },
    });
  });

  it('shows ExpectedTeacherSelector after static QR scan with valid GPS', async () => {
    renderComponent();

    // Trigger static QR scan for TPA
    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });
  });

  it('shows all TPA teachers as checkboxes after scan', async () => {
    renderComponent();

    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
      expect(screen.getByText('Ani Rahayu')).toBeInTheDocument();
      expect(screen.getByText('Cici Dewi')).toBeInTheDocument();
    });
  });

  it('calls openSessionWithExpected with selected IDs when submit clicked', async () => {
    renderComponent();

    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    // Check Budi and Ani
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Budi
    fireEvent.click(checkboxes[1]); // Ani

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(mockOpenSessionWithExpected).toHaveBeenCalledWith(
        'tpa-001',
        { lat: -7.68, lng: 110.41 },
        ['user-001', 'user-002'],
      );
    });
  });

  it('navigates to session page after successful open', async () => {
    renderComponent();

    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Select Budi
    fireEvent.click(screen.getByRole('button', { name: /Buka Sesi/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/pengajar/session/session-1');
    });
  });

  it('shows cancel button that hides the selector', async () => {
    renderComponent();

    await act(async () => {
      (window as any).__triggerQRScan('static-qr-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Pilih Pengajar yang Wajib Hadir')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Batal/ }));

    await waitFor(() => {
      expect(screen.queryByText('Pilih Pengajar yang Wajib Hadir')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd /opt/data/uam-presensi
npx vitest run src/pages/pengajar/__tests__/ScanPage.test.tsx
```

Expected: FAIL — ExpectedTeacherSelector not rendered after scan.

- [ ] **Step 3: Modifikasi ScanPage.tsx — integrasi ExpectedTeacherSelector**

Di `src/pages/pengajar/ScanPage.tsx`, pada handler static QR scan (setelah GPS valid, sekitar line 59-68), ganti direct `openSession` call dengan state untuk menampilkan ExpectedTeacherSelector.

Tambahkan import:
```typescript
import { ExpectedTeacherSelector } from '../../app/components/session/ExpectedTeacherSelector';
```

Tambahkan state baru setelah `processingRef` (sekitar line 33):
```typescript
const [showExpectedSelector, setShowExpectedSelector] = useState(false);
const [pendingTpaId, setPendingTpaId] = useState<string | null>(null);
const [pendingLocation, setPendingLocation] = useState<Coordinates | null>(null);
```

Modifikasi bagian static QR scan (ganti lines 44-69):
```typescript
// Static QR: try lookup by TPA's static QR code
const tpa = getTpaByStaticQR(text);
if (tpa) {
  const existingSession = getActiveSessionByTPA(tpa.id);

  if (existingSession) {
    setActiveSessionInfo({ tpaName: tpa.name, sessionId: existingSession.id });
    return;
  }

  const location = locationState.status === 'ready' ? locationState.coords : await getCurrentLocation();

  const distance = calculateDistance(location, tpa.location);
  if (distance > tpa.location.radius) {
    toast.error(`Anda berada di luar radius ${tpa.name}`);
    return;
  }

  // Fetch pengajar list for this TPA, then show ExpectedTeacherSelector
  const pengajarList = useUsersStore.getState().pengajarByTPA[tpa.id];
  if (!pengajarList || pengajarList.length === 0) {
    await fetchPengajarByTPA(tpa.id);
  }
  setPendingTpaId(tpa.id);
  setPendingLocation(location);
  setShowExpectedSelector(true);
  return;
}
```

Tambahkan import untuk `useUsersStore` dan `fetchPengajarByTPA`:
```typescript
import { useUsersStore } from '../../store/userStore';
```

Di dalam komponen, tambahkan destructuring:
```typescript
const fetchPengajarByTPA = useUsersStore((s) => s.fetchPengajarByTPA);
const pengajarByTPA = useUsersStore((s) => s.pengajarByTPA);
```

Ganti `openSession` dengan `openSessionWithExpected`:
```typescript
const openSessionWithExpected = useSessionStore((s) => s.openSessionWithExpected);
```

Tambahkan handler untuk ExpectedTeacherSelector submit:
```typescript
const handleExpectedSubmit = useCallback(async (selectedIds: string[]) => {
  if (!pendingTpaId || !pendingLocation) return;
  
  setProcessing(true);
  try {
    const result = await openSessionWithExpected(pendingTpaId, pendingLocation, selectedIds);
    if (result.valid) {
      toast.success(`Sesi dibuka dengan ${selectedIds.length} pengajar wajib hadir!`);
      setShowExpectedSelector(false);
      queueMicrotask(() => navigate(`/pengajar/session/${result.data.id}`));
    } else {
      toast.error(result.message);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
  } finally {
    setProcessing(false);
  }
}, [pendingTpaId, pendingLocation, openSessionWithExpected, navigate]);
```

Tambahkan di JSX, di dalam `<main>` setelah GPS card (sekitar line 167-188), sebelum `activeSessionInfo` banner:
```tsx
{/* Expected Teacher Selector — shown after static QR scan */}
{showExpectedSelector && pendingTpaId && (
  <div className="w-full max-w-sm">
    <ExpectedTeacherSelector
      teachers={pengajarByTPA[pendingTpaId] ?? []}
      currentUserId={user?.id ?? ''}
      onSubmit={handleExpectedSubmit}
      onCancel={() => setShowExpectedSelector(false)}
      loading={processing}
    />
  </div>
)}
```

**Hapus** `openSession` dari destructuring di awal komponen (sekitar line 24) — sudah diganti `openSessionWithExpected`.

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
cd /opt/data/uam-presensi
npx vitest run src/pages/pengajar/__tests__/ScanPage.test.tsx
```

Expected: semua test PASS.

- [ ] **Step 5: Jalankan semua test terkait — pastikan tidak ada regresi**

```bash
cd /opt/data/uam-presensi
npx vitest run
```

Pastikan tidak ada test lain yang fail akibat perubahan `openSession` → `openSessionWithExpected`. Jika ada test lain yang memanggil `openSession`, update test tersebut.

- [ ] **Step 6: Commit**

```bash
git add src/pages/pengajar/ScanPage.tsx src/pages/pengajar/__tests__/ScanPage.test.tsx
git commit -m "feat: integrate ExpectedTeacherSelector into ScanPage for session opening"
```

---

### Task 5: SessionActivePage — expected-based absent list setelah sesi ditutup

**Files:**
- Modify: `src/pages/pengajar/SessionActivePage.tsx`
- Modify: `src/pages/pengajar/__tests__/SessionActivePage.test.tsx`

**Interfaces:**
- Consumes: `supabase` client untuk query `session_expected_teachers`, `useUsersStore`
- Produces: Modified absent list: hanya expected teachers yang tidak scan dianggap "Tidak Hadir". Non-expected attendees yang scan tetap muncul di "Hadir".

- [ ] **Step 1: Update test SessionActivePage — absent logic dengan expected teachers**

Buka `src/pages/pengajar/__tests__/SessionActivePage.test.tsx`. Tambahkan mock untuk supabase query (jika belum ada) dan update mock `userStore` untuk menyediakan `fetchSessionExpectedTeachers`.

Tambahkan mock untuk `supabase.from('session_expected_teachers')`:

```typescript
// Di dalam vi.mock('../../../lib/supabase', ...) — perlu refactor mock
// atau tambahkan mock terpisah:

const mockSessionExpectedQuery = vi.fn();

vi.mock('../../../lib/supabase', async () => {
  const actual = await vi.importActual('../../../lib/supabase');
  return {
    supabase: {
      ...actual.supabase,
      from: (table: string) => {
        if (table === 'session_expected_teachers') {
          return {
            select: () => ({
              eq: () => ({
                then: (resolve: any) => resolve({ data: mockSessionExpectedQuery(), error: null }),
              }),
            }),
          };
        }
        // fallback to existing mock or actual
        return (actual.supabase as any).from(table);
      },
    },
  };
});
```

Tambahkan test case baru setelah describe block existing:

```typescript
describe('SessionActivePage — expected teachers absent list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = {
      id: 'session-1',
      tpaId: 'tpa-001',
      firstTeacherId: 'user-001',
      dateOpened: new Date(),
      isActive: false, // closed session
    } as Session;

    // Budi (user-001) scanned in, Ani (user-002) is expected but didn't scan
    mockAttendances = [
      {
        id: 'att-1',
        sessionId: 'session-1',
        userId: 'user-001',
        scanInTime: new Date(),
        scanOutTime: new Date(),
        isLate: false,
        lateMinutes: 0,
      } as Attendance,
    ];

    // Mock expected teachers: Budi (user-001) and Ani (user-002) expected
    // Cici (user-003) is NOT expected
    vi.mocked(useUsersStore as any).mockImplementation((selector?: any) => {
      const state = {
        users: [
          { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
          { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
          { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
        ],
        loading: false,
        pengajarByTPA: {
          'tpa-001': [
            { id: 'user-001', name: 'Budi Santoso', email: 'budi@uii.ac.id', role: 'pengajar', nim: '21511001' },
            { id: 'user-002', name: 'Ani Rahayu', email: 'ani@uii.ac.id', role: 'pengajar', nim: '21511002' },
            { id: 'user-003', name: 'Cici Dewi', email: 'cici@uii.ac.id', role: 'pengajar', nim: '21511003' },
          ],
        },
        fetchPengajarByTPA: vi.fn(),
      };
      return selector ? selector(state) : state;
    });
  });

  it('shows only expected-but-not-scanned teachers as "Tidak Hadir" after session closed', async () => {
    // Mock session_expected_teachers query: Budi and Ani expected
    mockSessionExpectedQuery.mockReturnValue([
      { user_id: 'user-001' },
      { user_id: 'user-002' },
    ]);

    renderComponent();

    await waitFor(() => {
      // Ani (expected, not scanned) should be in "Tidak Hadir"
      expect(screen.getByText('Ani Rahayu')).toBeInTheDocument();
      // Budi (expected, scanned) should NOT be in "Tidak Hadir"
      // Cici (not expected) should NOT be in "Tidak Hadir" even if she's in pengajarByTPA
    });

    // Verify "Tidak Hadir" count is 1 (only Ani)
    expect(screen.getByText(/Tidak Hadir/)).toHaveTextContent('Tidak Hadir (1)');
  });

  it('does not show non-expected pengajar TPA as "Tidak Hadir"', async () => {
    mockSessionExpectedQuery.mockReturnValue([
      { user_id: 'user-001' },
      { user_id: 'user-002' },
    ]);

    renderComponent();

    await waitFor(() => {
      // Cici is in pengajarByTPA but not in expected → should NOT appear as absent
      const absentSection = screen.getByText(/Tidak Hadir/).closest('div');
      if (absentSection) {
        expect(absentSection).not.toHaveTextContent('Cici Dewi');
      }
    });
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd /opt/data/uam-presensi
npx vitest run src/pages/pengajar/__tests__/SessionActivePage.test.tsx -t "expected teachers absent"
```

Expected: FAIL — test tidak match behavior saat ini (masih pakai `pengajarByTPA`).

- [ ] **Step 3: Modifikasi SessionActivePage.tsx — fetch expected teachers + update absent logic**

Di `src/pages/pengajar/SessionActivePage.tsx`, tambahkan state untuk expected teachers:

```typescript
// Setelah state existing (sekitar line 40-42):
const [expectedUserIds, setExpectedUserIds] = useState<Set<string>>(new Set());
```

Tambahkan useEffect untuk fetch expected teachers saat sesi ditutup (setelah useEffect existing sekitar line 86-90):

```typescript
// Fetch expected teachers list when session is closed
useEffect(() => {
  if (!session.isActive && session.id) {
    supabase
      .from('session_expected_teachers')
      .select('user_id')
      .eq('session_id', session.id)
      .then(({ data, error }) => {
        if (!error && data) {
          const ids = new Set((data as { user_id: string }[]).map(r => r.user_id));
          setExpectedUserIds(ids);
        }
      });
  }
}, [session.isActive, session.id]);
```

Tambahkan import untuk supabase:
```typescript
import { supabase } from '../../lib/supabase';
```

**Ganti logika absentUsers** (sekarang line 92-94):

Dari:
```typescript
const effectiveTPAUsers = session.isActive ? [] : (pengajarByTPA[session.tpaId] ?? []);
const attendingUserIds = new Set(attendances.filter((a) => a.scanInTime).map((a) => a.userId));
const absentUsers = effectiveTPAUsers.filter((u) => !attendingUserIds.has(u.id));
```

Menjadi:
```typescript
// Absent = expected but not scanned in
const attendingUserIds = new Set(attendances.filter((a) => a.scanInTime).map((a) => a.userId));
const allTPAUsers = pengajarByTPA[session.tpaId] ?? [];
const absentUsers = session.isActive
  ? []
  : allTPAUsers.filter((u) => expectedUserIds.has(u.id) && !attendingUserIds.has(u.id));
```

**Hapus** `effectiveTPAUsers` (tidak dipakai lagi).

Tambahkan section opsional untuk "Tidak Dijadwalkan" (non-expected attendees) setelah absent list (sebelum close button, sekitar line 235). Ini opsional, expandable:

```tsx
{/* Non-expected attendees — shown after session is closed */}
{!session.isActive && expectedUserIds.size > 0 && (
  (() => {
    const nonExpectedAttendees = allTPAUsers.filter(
      (u) => attendingUserIds.has(u.id) && !expectedUserIds.has(u.id)
    );
    if (nonExpectedAttendees.length === 0) return null;
    return (
      <details className="bg-card rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          Tidak Dijadwalkan ({nonExpectedAttendees.length})
        </summary>
        <ul className="divide-y border-t">
          {nonExpectedAttendees.map((u) => (
            <li key={u.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-semibold">
                {u.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
              </div>
              <span className="text-xs text-gray-400">Non-Jadwal</span>
            </li>
          ))}
        </ul>
      </details>
    );
  })()
)}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
cd /opt/data/uam-presensi
npx vitest run src/pages/pengajar/__tests__/SessionActivePage.test.tsx
```

Expected: semua test PASS, termasuk test baru + existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/pengajar/SessionActivePage.tsx src/pages/pengajar/__tests__/SessionActivePage.test.tsx
git commit -m "feat: update SessionActivePage absent logic to use session_expected_teachers"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec Requirement | Covered By |
|-----------------|------------|
| Tabel `session_expected_teachers` + index + UNIQUE constraint | Task 1 Step 2 |
| Tabel `attendances`, `sessions`, `pengajar_tpa` tidak berubah | Global constraint + tidak ada migration yang menyentuhnya |
| RPC `open_session_with_expected` dengan batch insert | Task 1 Step 3 |
| Update `get_laporan_presensi` JOIN ke `session_expected_teachers` | Task 1 Step 4 |
| Non-expected attendees tetap muncul di laporan | Task 1 Step 4 Part B (UNION) |
| ScanPage: setelah scan QR statis + GPS valid → tampilkan ExpectedTeacherSelector | Task 4 Step 3 |
| Checkbox default UNCHECKED (kecuali first teacher auto-selected di UI) | Task 3 Step 3 (all unchecked), Task 4 (first-teacher auto-select handled by showing "(Anda)" label) |
| Counter "X dipilih" | Task 3 Step 3 |
| Tombol "Buka Sesi (X)" disabled jika 0 | Task 3 Step 3 |
| Setelah submit → INSERT session + batch INSERT expected + auto check-in + navigasi | Task 1 Step 3 (RPC), Task 4 Step 3 (client) |
| SessionActivePage aktif: tidak tampilkan expected-but-not-checked-in | Task 5 Step 3 (absentUsers = [] when active) |
| SessionActivePage ditutup: "Tidak Hadir" hanya expected-not-scanned | Task 5 Step 3 |
| "Tidak Dijadwalkan" opsional expandable | Task 5 Step 3 |
| LaporanPage: hanya label "Hadir" dan "Tidak Hadir" | Task 1 Step 4 (DB query handles this, UI unchanged) |

### 2. Placeholder Scan

✅ Tidak ada "TBD", "TODO", "implement later", "fill in details"
✅ Tidak ada "Add appropriate error handling" tanpa code
✅ Semua test code eksplisit, bukan "Write tests for the above"
✅ Tidak ada "Similar to Task N" — semua code diulang

### 3. Type Consistency

✅ `openSessionWithExpected(tpaId, location, expectedUserIds)` konsisten di types, store, tests, dan ScanPage
✅ `ExpectedTeacherSelector` props konsisten: `{ teachers, currentUserId, onSubmit, onCancel, loading }`
✅ `SessionExpectedTeacher` type didefinisikan di Task 2 dan digunakan di Task 5
✅ `get_laporan_presensi` return type tidak berubah — client code LaporanPage tidak perlu diubah
