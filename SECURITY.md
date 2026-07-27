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

## Accepted Dependency Risks
- **xlsx (<0.20.2):** Prototype Pollution (CVE-2023-XXXX) and ReDoS. This application uses `xlsx` strictly for exporting trusted, internal row data. It does not parse or upload any external `.xlsx` files. The export function enforces a maximum row boundary of 5,000 rows to prevent ReDoS. Because user input is not deserialized into objects during export, Prototype Pollution vectors are unreachable. A replacement is not required.
- **Supabase manage-user Edge Function:** Relies on manual JWT validation to restrict user creation/reset to the `pengurus` role.
