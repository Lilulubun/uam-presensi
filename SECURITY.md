# Security

## Architecture
- All auth, QR validation, and GPS radius checks are enforced server-side via PostgreSQL RPCs (SECURITY DEFINER). The client is untrusted.
- Token rotation is the only mechanism for QR refresh. Static QR codes exist for initial session creation only.
- HTTPS is required for production (Vercel provides this; use `vercel dev` locally).
- Demo credentials in `src/lib/mock-data.ts` are env-gated (`VITE_DEMO_MODE=true`) and must never be enabled in production.

## Deployment
1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GPS_DEBUG=false`, `VITE_DEMO_MODE=false` in production env.
2. Apply migrations via Supabase SQL editor or `supabase db push`.
3. Run `npm run seed` with `SUPABASE_SERVICE_ROLE_KEY` to seed TPAs and demo users.
