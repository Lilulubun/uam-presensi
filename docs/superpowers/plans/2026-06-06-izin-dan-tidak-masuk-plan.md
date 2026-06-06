# Izin & Tidak Masuk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add izin (excuse) submission/approval and "tidak masuk" (absent) status computation.

**Architecture:** New `izin_requests` table + 6 RPCs. New zustand `izinStore`. One new page `IzinPage` for pengajar. Modifications to DashboardPengajar, DashboardPengurus, DetailPengajar for UI. Status computation entirely on server via RPC — no client-side logic.

**Tech Stack:** Supabase (PostgreSQL + RPC), React 18, Zustand, Tailwind 4, date-fns.

---

### Task 1: Database Migration — tabel izin_requests + RPCs

**Files:**
- Create: `supabase/migrations/0013_izin_requests.sql`

- [ ] **Step 1: Add izin_status type, izin_requests table, and unique index on pengajar_tpa**

```sql
-- 0013_izin_requests.sql
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE

-- =========================================================================
-- 1. Izin status enum
-- =========================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'izin_status') then
    create type public.izin_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- =========================================================================
-- 2. Izin requests table
-- =========================================================================
create table if not exists public.izin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  alasan text not null,
  status public.izin_status not null default 'pending',
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint izin_dates_check check (end_date >= start_date)
);

create index if not exists idx_izin_requests_user_date
  on public.izin_requests (user_id, start_date, end_date);

-- =========================================================================
-- 3. Enforce one TPA per teacher
-- =========================================================================
create unique index if not exists idx_pengajar_tpa_one_per_user
  on public.pengajar_tpa (user_id);

-- =========================================================================
-- 4. RLS
-- =========================================================================
alter table public.izin_requests enable row level security;

drop policy if exists "izin_requests select" on public.izin_requests;
create policy "izin_requests select" on public.izin_requests
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role = 'pengurus')
  );

drop policy if exists "izin_requests insert" on public.izin_requests;
create policy "izin_requests insert" on public.izin_requests
  for insert with check (user_id = auth.uid());
```

- [ ] **Step 2: Add RPC submit_izin**

```sql
-- =========================================================================
-- 5. RPC: submit_izin
-- =========================================================================
create or replace function public.submit_izin(p_start_date date, p_end_date date, p_alasan text)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_end_date < p_start_date then raise exception 'Tanggal akhir harus setelah atau sama dengan tanggal awal'; end if;

  insert into public.izin_requests (user_id, start_date, end_date, alasan)
  values (v_user, p_start_date, p_end_date, p_alasan)
  returning * into v_row;

  return v_row;
end; $$;
```

- [ ] **Step 3: Add RPC approve_izin / reject_izin**

```sql
-- =========================================================================
-- 6. RPC: approve_izin (pengurus only)
-- =========================================================================
create or replace function public.approve_izin(p_izin_id uuid)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if not exists (select 1 from public.users where id = v_user and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  update public.izin_requests
  set status = 'approved', reviewed_by = v_user, reviewed_at = now()
  where id = p_izin_id and status = 'pending'
  returning * into v_row;

  if not found then raise exception 'Izin tidak ditemukan atau sudah diproses'; end if;
  return v_row;
end; $$;

-- =========================================================================
-- 7. RPC: reject_izin (pengurus only)
-- =========================================================================
create or replace function public.reject_izin(p_izin_id uuid)
returns public.izin_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.izin_requests;
begin
  if not exists (select 1 from public.users where id = v_user and role = 'pengurus') then
    raise exception 'forbidden';
  end if;

  update public.izin_requests
  set status = 'rejected', reviewed_by = v_user, reviewed_at = now()
  where id = p_izin_id and status = 'pending'
  returning * into v_row;

  if not found then raise exception 'Izin tidak ditemukan atau sudah diproses'; end if;
  return v_row;
end; $$;
```

- [ ] **Step 4: Add RPC get_pending_izins / get_my_izins**

```sql
-- =========================================================================
-- 8. RPC: get_pending_izins (pengurus only)
-- =========================================================================
create or replace function public.get_pending_izins()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  start_date date,
  end_date date,
  alasan text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id, r.user_id, u.name,
    r.start_date, r.end_date, r.alasan, r.created_at
  from public.izin_requests r
  join public.users u on u.id = r.user_id
  where r.status = 'pending'
  order by r.created_at desc;
$$;

-- =========================================================================
-- 9. RPC: get_my_izins
-- =========================================================================
create or replace function public.get_my_izins()
returns table (
  id uuid,
  start_date date,
  end_date date,
  alasan text,
  status text,
  reviewed_by_name text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id, r.start_date, r.end_date, r.alasan,
    r.status::text,
    ru.name as reviewed_by_name,
    r.created_at, r.reviewed_at
  from public.izin_requests r
  left join public.users ru on ru.id = r.reviewed_by
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;
```

- [ ] **Step 5: Add RPC get_teacher_monthly_report**

```sql
-- =========================================================================
-- 10. RPC: get_teacher_monthly_report
-- Returns per-day attendance status for a teacher in a given month.
--   - hadir: has scan_in for that day's session
--   - izin: approved izin covers that date
--   - tidak_masuk: session exists but no scan_in and no approved izin
-- =========================================================================
create or replace function public.get_teacher_monthly_report(
  p_user_id uuid,
  p_year int,
  p_month int
)
returns table (
  tgl date,
  tpa_id text,
  tpa_name text,
  status text  -- 'hadir', 'izin', 'tidak_masuk'
)
language sql
security definer
set search_path = public
as $$
  with teacher_tpa as (
    select tpa_id from public.pengajar_tpa where user_id = p_user_id
  ),
  month_sessions as (
    select s.id, s.tpa_id, s.date_opened::date as tgl
    from public.sessions s
    join teacher_tpa tt on tt.tpa_id = s.tpa_id
    where extract(year from s.date_opened) = p_year
      and extract(month from s.date_opened) = p_month
  ),
  scanned as (
    select distinct ms.tgl
    from month_sessions ms
    join public.attendances a on a.session_id = ms.id and a.user_id = p_user_id
    where a.scan_in_time is not null
  ),
  excused as (
    select distinct ms.tgl
    from month_sessions ms
    join public.izin_requests ir on ir.user_id = p_user_id
      and ir.status = 'approved'
      and ms.tgl between ir.start_date and ir.end_date
  )
  select distinct
    ms.tgl,
    ms.tpa_id,
    (select name from public.tpas where id = ms.tpa_id) as tpa_name,
    case
      when s.tgl is not null then 'hadir'
      when e.tgl is not null then 'izin'
      else 'tidak_masuk'
    end as status
  from month_sessions ms
  left join scanned s on s.tgl = ms.tgl
  left join excused e on e.tgl = ms.tgl
  order by ms.tgl;
$$;
```

- [ ] **Step 6: Realtime publication**

```sql
-- =========================================================================
-- 11. Realtime publication for izin_requests (pengurus dashboard)
-- =========================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'izin_requests'
  ) then
    alter publication supabase_realtime add table public.izin_requests;
  end if;
end $$;
```

- [ ] **Step 7: Apply migration**

Run: `supabase db push` or copy-paste migration in Supabase SQL editor.

---

### Task 2: Types — add IzinRequest interface

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add IzinRequest and IzinStatus types**

Add after the `Attendance` interface definition:

```typescript
export type IzinStatus = 'pending' | 'approved' | 'rejected';

export interface IzinRequest {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  alasan: string;
  status: IzinStatus;
  reviewedBy?: string;
  createdAt: Date;
  reviewedAt?: Date;
  // Joined fields from RPCs
  userName?: string;
  reviewedByName?: string;
}

export interface DailyReportRow {
  tgl: Date;
  tpaId: string;
  tpaName: string;
  status: 'hadir' | 'izin' | 'tidak_masuk';
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 3: IzinStore

**Files:**
- Create: `src/store/izinStore.ts`

- [ ] **Step 1: Create izin store**

```typescript
import { create } from 'zustand';
import type { IzinRequest, ValidationResult, DailyReportRow } from '../types';
import { supabase } from '../lib/supabase';
import { toCamelCase, toCamelCaseArray } from '../lib/transform';

interface IzinState {
  myIzins: IzinRequest[];
  pendingIzins: IzinRequest[];
  monthlyReport: DailyReportRow[];
  loading: boolean;

  submitIzin: (startDate: string, endDate: string, alasan: string) => Promise<ValidationResult>;
  approveIzin: (id: string) => Promise<ValidationResult>;
  rejectIzin: (id: string) => Promise<ValidationResult>;
  fetchMyIzins: () => Promise<void>;
  fetchPendingIzins: () => Promise<void>;
  fetchMonthlyReport: (userId: string, year: number, month: number) => Promise<void>;
}

function mapRpcError(error: { message: string } | null): ValidationResult {
  if (!error) return { valid: false, message: 'Kesalahan tidak diketahui' };
  return { valid: false, message: error.message };
}

export const useIzinStore = create<IzinState>((set) => ({
  myIzins: [],
  pendingIzins: [],
  monthlyReport: [],
  loading: false,

  submitIzin: async (startDate, endDate, alasan) => {
    const { data, error } = await supabase.rpc('submit_izin', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_alasan: alasan,
    });
    if (error || !data) return mapRpcError(error);
    const izin = toCamelCase<IzinRequest>(data);
    set((s) => ({ myIzins: [...s.myIzins, izin] }));
    return { valid: true, message: 'Izin berhasil diajukan. Menunggu persetujuan.' };
  },

  approveIzin: async (id) => {
    const { data, error } = await supabase.rpc('approve_izin', { p_izin_id: id });
    if (error || !data) return mapRpcError(error);
    set((s) => ({
      pendingIzins: s.pendingIzins.filter((r) => r.id !== id),
      myIzins: s.myIzins.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r)),
    }));
    return { valid: true, message: 'Izin disetujui' };
  },

  rejectIzin: async (id) => {
    const { data, error } = await supabase.rpc('reject_izin', { p_izin_id: id });
    if (error || !data) return mapRpcError(error);
    set((s) => ({
      pendingIzins: s.pendingIzins.filter((r) => r.id !== id),
      myIzins: s.myIzins.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
    }));
    return { valid: true, message: 'Izin ditolak' };
  },

  fetchMyIzins: async () => {
    set({ loading: true });
    const { data, error } = await supabase.rpc('get_my_izins');
    if (!error && data) {
      set({ myIzins: toCamelCaseArray<IzinRequest>(data), loading: false });
    } else {
      if (error) console.error('fetchMyIzins error:', error);
      set({ loading: false });
    }
  },

  fetchPendingIzins: async () => {
    const { data, error } = await supabase.rpc('get_pending_izins');
    if (!error && data) {
      set({ pendingIzins: toCamelCaseArray<IzinRequest>(data) });
    } else {
      if (error) console.error('fetchPendingIzins error:', error);
    }
  },

  fetchMonthlyReport: async (userId, year, month) => {
    const { data, error } = await supabase.rpc('get_teacher_monthly_report', {
      p_user_id: userId,
      p_year: year,
      p_month: month,
    });
    if (!error && data) {
      set({ monthlyReport: toCamelCaseArray<DailyReportRow>(data) });
    } else {
      if (error) console.error('fetchMonthlyReport error:', error);
    }
  },
}));
```

---

### Task 4: IzinPage (pengajar)

**Files:**
- Create: `src/pages/pengajar/IzinPage.tsx`

- [ ] **Step 1: Create IzinPage component**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CalendarDays, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useIzinStore } from '../../store/izinStore';

export default function IzinPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { myIzins, loading, submitIzin, fetchMyIzins } = useIzinStore();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchMyIzins();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !alasan.trim()) {
      toast.error('Semua field harus diisi');
      return;
    }
    if (endDate < startDate) {
      toast.error('Tanggal akhir harus setelah atau sama dengan tanggal awal');
      return;
    }
    setSubmitting(true);
    const result = await submitIzin(startDate, endDate, alasan.trim());
    setSubmitting(false);
    if (result.valid) {
      toast.success(result.message);
      setStartDate('');
      setEndDate('');
      setAlasan('');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengajar/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Ajukan Izin</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 flex flex-col gap-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Form Izin
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Alasan</label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tuliskan alasan izin..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Mengirim...' : 'Ajukan Izin'}
          </button>
        </form>

        {/* Riwayat */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Riwayat Pengajuan</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : myIzins.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada pengajuan izin</p>
          ) : (
            <ul className="divide-y">
              {myIzins.map((izin) => {
                const statusConfig = {
                  pending: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Pending' },
                  approved: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Disetujui' },
                  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Ditolak' },
                }[izin.status];
                const Icon = statusConfig.icon;

                return (
                  <li key={izin.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(izin.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' – '}
                          {new Date(izin.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{izin.alasan}</p>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                        <Icon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
```

---

### Task 5: DashboardPengajar — tombol Izin

**Files:**
- Modify: `src/pages/pengajar/DashboardPengajar.tsx`

- [ ] **Step 1: Add imports for izin**

Add `FileText` to the lucide-react import. Add `useEffect` if not already imported. Add:
```typescript
import { useIzinStore } from '../../store/izinStore';
import { useEffect } from 'react';
```

- [ ] **Step 2: Add izin store hook + fetch**

After the `const { locationState, nearestTPA } = useWatchLocation(true);` line (line 22):
```typescript
const pendingIzins = useIzinStore((s) => s.myIzins.filter((i) => i.status === 'pending').length);
const fetchMyIzins = useIzinStore((s) => s.fetchMyIzins);

useEffect(() => {
  fetchMyIzins();
}, []);
```

- [ ] **Step 3: Add "Ajukan Izin" button after the scan button**

After the scan button and before the "Kelola Sesi Aktif" button (after line 176):
```typescript
          <Button
            variant="outline"
            className="w-full h-14 text-base relative"
            onClick={() => navigate('/pengajar/izin')}
          >
            <FileText className="w-5 h-5 mr-2" />
            Ajukan Izin
            {pendingIzins > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {pendingIzins}
              </span>
            )}
          </Button>
```

---

### Task 6: DashboardPengurus — section Pending Izin

**Files:**
- Modify: `src/pages/pengurus/DashboardPengurus.tsx`

- [ ] **Step 1: Add imports**

Add to the existing import block (line 3):
```typescript
import { LogOut, RefreshCw, BarChart2, QrCode, Users, Clock, TrendingUp, AlertCircle, User, CheckCircle, XCircle, FileText } from 'lucide-react';
```
Also add `import { toast } from 'sonner';` and `import { useIzinStore } from '../../store/izinStore';` and `import { useEffect } from 'react';` if not already imported.

- [ ] **Step 2: Add izin store integration**

After `useRealtimeSessions();`:
```typescript
const { pendingIzins, approveIzin, rejectIzin, fetchPendingIzins } = useIzinStore();

useEffect(() => {
  fetchPendingIzins();
}, []);
```

- [ ] **Step 3: Add Pending Izin section between "Status TPA" and "Rekap Pengajar"**

Insert after the `</div>` closing the TPA status section (after line 261), before the Rekap Pengajar section (line 263):

```typescript
        {pendingIzins.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold">Izin Pending</h2>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                {pendingIzins.length}
              </span>
            </div>
            <ul className="divide-y">
              {pendingIzins.map((izin) => (
                <li key={izin.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{izin.userName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(izin.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(izin.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{izin.alasan}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={async () => {
                          const r = await approveIzin(izin.id);
                          toast.success(r.message);
                        }}
                        className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        title="Setujui"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const r = await rejectIzin(izin.id);
                          if (!r.valid) toast.error(r.message);
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title="Tolak"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
```

- [ ] **Step 4: Add missing `useEffect` import**

Add `useEffect` to the React import at the top if not already there:
```typescript
import { useMemo, useEffect } from 'react';
```

---

### Task 7: DetailPengajar — monthly report

**Files:**
- Modify: `src/pages/pengurus/DetailPengajar.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports:
```typescript
import { useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle2, XCircle, FileText, AlertCircle } from 'lucide-react';
import { useIzinStore } from '../../store/izinStore';
```

- [ ] **Step 2: Add monthly report fetch and compute**

After `const earlyExitCount = ...` (after line 38):
```typescript
const now = new Date();
const { monthlyReport, fetchMonthlyReport } = useIzinStore();

useEffect(() => {
  if (userId) {
    fetchMonthlyReport(userId, now.getFullYear(), now.getMonth() + 1);
  }
}, [userId]);

const hadirCount = monthlyReport.filter((r) => r.status === 'hadir').length;
const izinCount = monthlyReport.filter((r) => r.status === 'izin').length;
const tidakMasukCount = monthlyReport.filter((r) => r.status === 'tidak_masuk').length;
```

- [ ] **Step 3: Add report section after summary cards**

After the `</div>` closing the summary cards grid (after line 71):
```typescript
        {/* Monthly attendance status */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Status Bulanan</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(now.getFullYear(), now.getMonth()).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3">
            <div className="text-center p-2 rounded-lg bg-green-50">
              <p className="text-lg font-bold text-green-600">{hadirCount}</p>
              <p className="text-xs text-green-700">Hadir</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50">
              <p className="text-lg font-bold text-blue-600">{izinCount}</p>
              <p className="text-xs text-blue-700">Izin</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50">
              <p className="text-lg font-bold text-red-500">{tidakMasukCount}</p>
              <p className="text-xs text-red-600">Tidak Masuk</p>
            </div>
          </div>

          {monthlyReport.length > 0 && (
            <ul className="divide-y border-t">
              {monthlyReport.map((row) => (
                <li key={row.tgl.toString()} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-sm min-w-[120px]">
                    {new Date(row.tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1">{row.tpaName}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      row.status === 'hadir' ? 'bg-green-50 text-green-600' :
                      row.status === 'izin' ? 'bg-blue-50 text-blue-600' :
                      'bg-red-50 text-red-500'
                    }`}
                  >
                    {row.status === 'hadir' ? 'Hadir' : row.status === 'izin' ? 'Izin' : 'Tidak Masuk'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
```

---

### Task 8: Routing — add /pengajar/izin route

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Add import for IzinPage**

Add after the existing pengajar page imports (after line 17):
```typescript
import IzinPage from '../pages/pengajar/IzinPage';
```

- [ ] **Step 2: Add route for /pengajar/izin**

Add after the existing pengajar routes (after line 82):
```typescript
        <Route path="/pengajar/izin" element={<ProtectedRoute allowedRoles={['pengajar']}><ErrorBoundary><IzinPage /></ErrorBoundary></ProtectedRoute>} />
```

---

### Task 9: Typecheck + build

**Files:**
- None

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.
