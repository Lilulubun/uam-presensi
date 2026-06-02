# Vercel + Supabase Deployment Guide

> Steps to connect this repo (`Lilulubun/uam-presensi`) to Vercel, with Supabase env vars.

## Current state (post-push)

- `main` is now at `618826b5` (the `.worktrees` ignore commit, 1 commit ahead of previous origin).
- `feat/prd-compliance` is now at `ebd26655` (13 commits, includes the Supabase migration + the gitignore fix that drops 81k tracked node_modules files).
- The repo on GitHub no longer carries `node_modules/` or `dist/` thanks to the gitignore fix.
- `.env.example` is the only env file tracked. `.env.local` is gitignored.

## Before you start: one important security note

> **Your git remote URL contains a GitHub Personal Access Token (PAT) inline.** This was visible in `git remote -v`. Anyone who sees that URL has full repo access until you revoke the PAT. Recommended:
>
> 1. **Revoke the leaked PAT** at https://github.com/settings/tokens (find the one named anything matching the one in your remote URL).
> 2. **Replace the remote URL with SSH** so future pushes don't carry secrets:
>    ```bash
>    cd /home/bubunnn/code/Sistem\ Presensi\ Pengajar
>    git remote set-url origin git@github.com:Lilulubun/uam-presensi.git
>    # same in the worktree
>    cd .worktrees/prd-compliance
>    git remote set-url origin git@github.com:Lilulubun/uam-presensi.git
>    ```
>    (requires an SSH key added to your GitHub account).
> 3. Or use a credential helper / gh CLI auth so the URL stays clean.

I am **not** going to push again or echo the token anywhere. Treat the current URL as compromised until the PAT is rotated.

## What to deploy

For a live Supabase-backed deployment you need the **`feat/prd-compliance`** branch (it has all the Supabase integration). The `main` branch is the pre-Supabase localStorage version and will not work against the live DB.

Two options:

| Option | What it gives you | Trade-off |
|--------|------------------|-----------|
| **A. Production deploy on `main`** (merge feat first) | Stable, single branch, default Vercel URL | Merge commit, can't easily iterate on PRD work |
| **B. Preview on `feat/prd-compliance`** (recommended for now) | Live preview URL reflecting current work, easy to keep updating | URL is per-deploy, may change with each push unless you pin a branch |

I recommend **B for now**, then later merge `feat/prd-compliance` → `main` once the remaining Phase 3–5 work is done.

## Step 1 — Create the Vercel project

1. Go to https://vercel.com/new
2. Sign in with GitHub
3. **Import** `Lilulubun/uam-presensi`
4. Configure:
   - **Project Name:** `uam-presensi` (or your choice)
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `./` (leave default)
   - **Build Command:** `vite build` (auto-detected; package.json `build` script is the same)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)
   - **Branch:** change from `main` to **`feat/prd-compliance`** (under "Override")

Vercel will run a first build. It will likely **fail at build time** because no Supabase env vars are set yet — that's expected, we'll fix it now.

## Step 2 — Add Supabase env vars to Vercel

In your Vercel project → **Settings** → **Environment Variables**, add the following for **Production**, **Preview**, and **Development** (so previews work too):

| Name | Value | Environments |
|------|-------|--------------|
| `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | All |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_...` (or legacy `eyJ...anon JWT`) from Supabase Dashboard → Project Settings → API → "Publishable key" / "anon public" | All |
| `VITE_GPS_DEBUG` | `false` | All |
| `VITE_DEMO_MODE` | `false` | All |

> **Do NOT add** `SUPABASE_SECRET_KEY` / `PWD_*` to Vercel. Those are for the seed script (run locally / CI only), never the client.

The values you need are in your local `.env.local` (the file Vite reads during dev). You can copy them across.

## Step 3 — Re-deploy

After saving env vars, go to **Deployments** → click the three dots on the latest failed deployment → **Redeploy**. This time it should succeed (Vite will inline the `VITE_*` vars into the bundle at build time).

## Step 4 — Configure Supabase Auth for your Vercel domain

Once you have a Vercel URL (something like `https://uam-presensi-username.vercel.app`), you need to whitelist it in Supabase, otherwise login will fail with a CORS / redirect error:

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL:** set to your Vercel production URL.
3. **Additional Redirect URLs:** add your Vercel URL (and any preview URL pattern, e.g. `https://uam-presensi-git-feat-prd-compliance-username.vercel.app/**` if you want previews to work).
4. Save.

## Step 5 — Verify

1. Open your Vercel URL in a browser.
2. Try logging in with `budi@uii.ac.id` / `ulilalbab` (or the actual env-gated seed password you set).
3. Open DevTools → Network → check that requests go to your Supabase project URL.
4. If you see "Supabase env not configured", the env var didn't reach the build — re-check Step 2 and redeploy.

## What's next after the deploy works

- Phase 3–5 work continues on `feat/prd-compliance`. Every push auto-deploys a preview URL (good for testing).
- When Phase 5 verification is done, open a PR from `feat/prd-compliance` → `main` and merge.
- After merge, change Vercel's "Production Branch" to `main` and you get a single stable URL.
- For the seed script, run it locally with `npm run seed` against your remote Supabase project — never commit the seed creds to Vercel.

## Optional: Vercel env via Supabase integration

Vercel has a one-click **Supabase integration** in the marketplace that wires the env vars for you: https://vercel.com/integrations/supabase

If you install it, you can skip Step 2. But the manual approach above gives you more control and is fine for a single project.

---

## Reference: env var naming

| Old (legacy) | New (Supabase 2025+) |
|--------------|----------------------|
| `VITE_SUPABASE_URL` | `VITE_SUPABASE_URL` (unchanged) |
| `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` |

This repo already uses the new naming. The publishable key is safe to expose to the client (same role as the old anon key). The secret key bypasses RLS — never ship it to the browser.

---

## Post-deploy verification checklist

- [ ] Vercel build succeeded
- [ ] App loads at the Vercel URL
- [ ] Login works with seeded credentials
- [ ] Realtime updates work (open two browser tabs, start a session in one, see it in the other)
- [ ] DevTools Network tab shows requests to your Supabase project URL
- [ ] No "Supabase env not configured" error in the console
