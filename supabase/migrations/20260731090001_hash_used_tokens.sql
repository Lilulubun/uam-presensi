-- 20260731090001_hash_used_tokens.sql
-- Hash used_tokens.token + simplify PK to (user_id, session_id)
-- check_in_v2 already inserts hashed token; this migration aligns the schema

-- Step 1: Drop old PK (user_id, session_id, token)
alter table public.used_tokens drop constraint if exists used_tokens_pkey;

-- Step 2: Hash existing rows where token looks like raw hex-32 (64 chars)
update public.used_tokens
set token = encode(extensions.digest(token, 'sha256'), 'hex')
where token is not null and length(token) = 64;

-- Step 3: New PK — one token per user per session
alter table public.used_tokens add primary key (user_id, session_id);
