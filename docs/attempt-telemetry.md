# Attempt telemetry (accepted decision)

## Boundary and transaction design

`20261029000000_add_attempt_logs.sql` instruments `open_session_with_expected_v2`
and `check_in_v2`. Domain work runs inside an exception subtransaction. Rejection
rolls back domain mutations; the outer block inserts telemetry and **returns**
`{accepted, code, message, request_id, data}` normally. Raising after inserting a
rejection log would undo that log and is deliberately not used. A logging failure
fails the whole transaction; success must never commit without its log.

`attempt_logs` stores server time, `auth.uid()` actor, action, stable outcome,
accepted flag, request ID, and target/result IDs. No raw QR tokens, coordinates,
response bodies, or exception details. No foreign keys: invalid IDs and deletion
must not remove historical evidence. RLS enabled, no client policies or table
privileges; only SECURITY DEFINER RPCs write. Database-owner access remains trusted.

Both signatures gain optional `p_request_id uuid`; old signatures are dropped to
avoid ambiguous PostgREST overloads and uninstrumented bypasses. Deploy migration
and adapter together: an old client can omit the ID but cannot understand structured
rejections. New adapter tolerates old successful responses but its explicit request
ID requires the new migration. No deployment performed as part of this change.

## Denominator and retry rules

One row per `(actor, action, request_id)` logical request. Adapter creates a fresh
UUID per invocation; callers retrying the *same* request after transport uncertainty
must retain and pass the same optional ID. There is no automatic retry. Advisory
transaction lock serializes concurrent identical IDs; unique index enforces count
integrity. Reuse returns `REQUEST_ALREADY_PROCESSED` without mutations or a new log.
It is not a new rejection or proof the original request failed. Refresh state;
opening QR can be recovered using existing rotation flow. No credential response
is cached in telemetry. A genuinely new scan gets a new ID, even with same payload.
Clients deliberately reusing IDs cannot be measured as separate physical scans.

Opening counts as **one opening attempt**, even though success creates opener's
auto-attendance. Do not add that attendance as a separate check-in attempt.
`FIRST_TEACHER_AUTO` is an accepted check-in RPC response referencing attendance
already created at opening; exclude it when counting **new check-in acceptances**.
`ACCEPTED` check-ins create attendance; replay/duplicate checks reject. Store logs
before deriving any rate; do not infer attempts from attendance row counts.

```sql
-- Run later, with authorized read access; use explicit observation window.
select action, count(*) as attempts,
       count(*) filter (where accepted) as accepted_responses,
       count(*) filter (where not accepted) as rejected_responses,
       count(*) filter (where action = 'check_in' and outcome = 'ACCEPTED') as new_check_ins,
       count(*) filter (where outcome = 'FIRST_TEACHER_AUTO') as already_auto_attended
from public.attempt_logs
where recorded_at >= :start_time and recorded_at < :end_time
group by action;
```

Only requests reaching and **committing** instrumented RPCs count. Offline scans,
client QR decode/GPS prechecks, gateway/JWT/type rejection, cancellation, database
outage, and transaction/logging failure are not recorded. This is not a denominator
for all physical scans. Telemetry supports only its own post-deployment observation
period; historical imports and prior operation gain no retroactive evidence.

## Local verification

`supabase/tests/attempt_logs.sql` runs against a **fresh disposable local PostgreSQL**
database, never remote Supabase. It supplies minimal auth/table fixtures, loads real
repository authorization helper and new migration, and asserts committed rejection
survival, rollback after partial writes, success, retries, auto-attendance, token
hashing, invalid/expired QR, geofence, invalid location, inactive actor, closed/missing
session, anonymous actor, and restrictive table privileges/RLS. Fixture is not full
Supabase/PostgREST integration. Run `psql -v ON_ERROR_STOP=1 -f
supabase/tests/attempt_logs.sql` from repository root using that local database.
