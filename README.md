# Sistem Presensi Pengajar

UII Ayo Mengajar — Monitoring Presensi TPA.

## Prerequisites

- Node.js 18+
- Supabase project (for auth + database)
- npm

## Setup

```bash
npm install
cp .env.example .env.local  # fill in your Supabase credentials
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_GPS_DEBUG` | No | Set to `true` to bypass GPS radius checks |
| `VITE_DEMO_MODE` | No | Set to `true` to show demo credentials on login page |

## Seeding

After applying migrations (via Supabase SQL editor or `supabase db push`):

```bash
# Seed script reads from env
export SUPABASE_URL=<project-url>
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export SEED_PENGAJAR_PASSWORD=<password>
export SEED_PENGURUS_PASSWORD=<password>
npm run seed
```

This creates 11 TPAs and 4 demo users (3 pengajar, 1 pengurus).

## Running

```bash
npm run dev      # development server
npm test         # test suite
npm run typecheck  # TypeScript type check
```

## Demo Accounts

| Role | Email | Password (set via SEED_*_PASSWORD) |
|---|---|---|
| Pengajar | budi@uii.ac.id | _(env-gated)_ |
| Pengajar | siti@uii.ac.id | _(env-gated)_ |
| Pengajar | ahmad@uii.ac.id | _(env-gated)_ |
| Pengurus | admin@uam.id | _(env-gated)_ |

Set `VITE_DEMO_MODE=true` to show credentials on the login page.

## Early-Exit Formula

Per PRD §6, a teacher is marked as "keluar awal" (early exit) when:

- They have a scan-in time (`scanInTime` is set)
- They do NOT have a scan-out time (`scanOutTime` is null)
- The session is closed (`session.isActive === false`)
- They are NOT the first teacher of that session

The first teacher is excluded because their attendance is auto-recorded at session open and they stay until close.

## TAM Evaluation

Interaction logs are stored in the `interaction_logs` table (pengurus-only access). The `/pengurus/evaluasi` page provides a viewer and CSV export for thesis evaluation.

## Architecture

- **Frontend**: React 18, Vite, TypeScript, Zustand
- **Backend**: Supabase (Auth + Postgres + RPCs)
- **Testing**: vitest, @testing-library/react
- **Security**: Server-side validation via SECURITY DEFINER RPCs. See `SECURITY.md`.