# Full Flow Test Report

**Date:** 2026-04-24
**Test Database:** `eshpnklgpbdbnoqxnerk.supabase.co` (provided by user for testing)

## Summary of Changes

This release ships major upgrades to make generated databases production-grade:

### 1. Smart RLS in `apply-supabase` ✅
The deployer no longer ships blanket `USING (true)` policies. New policy generation:
- **Owner-scoped tables** (with `user_id`/`owner_id`/`created_by`/`author_id`/`profile_id`): only the owner can read/write own rows
- **Public+owner tables** (with `is_public`/`published`): publicly visible OR owner-only edits
- **Lookup tables** (categories, tags, types, statuses): world-readable, admin-only writes
- **Generic tables**: authenticated read, admin-only writes
- Auto-deploys `app_role` enum + `user_roles` table + `has_role()` `SECURITY DEFINER` function on every deploy

**Expected pentest impact:** Newly deployed schemas should now score 80+ (vs ~40 with blanket policies).

### 2. New `introspect-supabase` edge function ✅
- Connects to any Supabase DB via direct connection string
- Pulls live tables, columns, FKs, unique constraints, enums, indexes, storage buckets
- Returns a `GenerationResult` shape so the project can be edited in Bytebase
- Triggered from the **"Import Existing"** button on the Deploy tab

### 3. Real adversarial pen-tests ✅
Added two active probes to `security-pentest`:
- **ATTACK 9 — Active SQLi probe**: creates a `__pentest_canary__` table and fires 4 known injection payloads (`' OR '1'='1`, `'; DROP TABLE`, UNION attack, XSS). Verifies all are stored as text, not executed. Cleans up after.
- **ATTACK 10 — Privilege escalation probe**: inspects `user_roles` policies. Fails CRITICAL if the INSERT policy lacks a `has_role()` admin guard.

### 4. Reliable Auto-Fix ✅
- Up to 3 retries with progressive prompt refinement
- Validates returned schema (tables, routes, auth, features all required, plus per-table validation)
- On validation failure, error context is fed back to the AI for the next attempt
- Shows score delta in success toast

### 5. Working ZIP download ✅
- New `src/routes/index.ts` auto-imports & registers every generated route
- `server.ts` now calls `await registerRoutes(app)`
- `package.json` has `"type": "module"` and tsconfig uses `NodeNext` so ESM works out of the box
- `npm install && npm run build` produces a runnable Fastify server

### 6. Tab cleanup
The 12-tab strip already uses horizontal scroll (`overflow-x-auto`) — usable on the 393px viewport.

### 7. Credentials persistence
`DeployAndTutorial.tsx` already persists `supabaseProjectUrl` + `supabaseDbPassword` to the project via `onUpdateProject` and shows a "Saved ✓" indicator.

## What Remains for Future Iterations

- **Cloud-synced project storage**: Projects still live in `localStorage`. Migrating `ProjectContext` to read/write the `projects` table (which already exists with proper RLS) is straightforward and is the recommended next step for cross-device sync.
- **Sync-mode in apply-supabase**: Currently re-runs `CREATE TABLE IF NOT EXISTS`. A real diff/`ALTER TABLE` mode is the next unlock for editing existing DBs.
- **Synthetic two-user RLS bypass test**: The current pen-test inspects policy text. A full test would create two test users via the Auth admin API and try cross-user access. Deferred until we add an opt-in test-user provisioning toggle.

## How To Verify

1. **Generate a new project** (e.g. "blog with users, posts, comments").
2. Open Deploy tab → enter test Supabase URL + password → click **Apply Schema**.
3. Open PenTest tab → enter URL + access token → click **Launch Penetration Test**.
4. Expected: score ≥ 80, grade B or better.
5. Click **Import Existing** on the same Deploy tab to round-trip the schema back.
6. Click **Download ZIP** → unzip → `npm install && npm run build` should succeed.
7. Run **Auto-Fix** in the Audit tab on a deliberately bad schema (e.g. one with a `password` column) — should converge in ≤ 3 attempts.