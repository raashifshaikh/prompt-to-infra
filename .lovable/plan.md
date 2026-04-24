

## Plan: Make the Database Deploy Production-Grade + Edit Existing Projects + Real Pen-Tests + Working Downloads

### Root cause of "database can't score well"
The `apply-supabase` edge function ships **blanket `USING (true)` RLS policies** for every table. Even when our generator produces a perfect schema, the deployer rewrites RLS as fully permissive — so the live database ALWAYS fails the PenTest. We have to fix the deployer, not the generator.

### Root cause of "SQL injection test isn't working"
The current pentest just inspects function definitions for the word `EXECUTE`. It never actually fires injection payloads. We need a real adversarial test that creates a sandboxed test row and tries known attack vectors.

---

### Fix 1 — Deployer ships secure RLS by default
**File:** `supabase/functions/apply-supabase/index.ts`

Replace `generateRLSStatements` with column-aware policy generation:
- Detect `user_id` / `owner_id` / `created_by` column → `USING (auth.uid() = user_id)` for SELECT/UPDATE/DELETE, `WITH CHECK (auth.uid() = user_id)` for INSERT.
- Detect `is_public` / `published` column → SELECT allows `(is_public = true OR auth.uid() = user_id)`.
- For tables with no ownership column (lookup tables like `categories`, `tags`) → SELECT public, write restricted to `has_role(auth.uid(), 'admin')`.
- Auto-create `app_role` enum + `user_roles` table + `has_role()` SECURITY DEFINER function on first deploy if any table needs admin checks.

### Fix 2 — Edit existing Supabase databases
**New file:** `supabase/functions/introspect-supabase/index.ts`
- Connects to user's DB via dbUrl, queries `information_schema` and `pg_catalog`, returns tables/columns/FKs/policies as a `GenerationResult` shape.
- Adds **"Import from Existing Supabase"** button in `DeployAndTutorial.tsx` → fetches live schema → loads it into the project's `result` (snapshotted to history).

**Updated:** `apply-supabase/index.ts` gains a `mode: 'sync'` path that diffs current schema vs target and emits `ALTER TABLE ADD COLUMN`, `DROP COLUMN` (gated behind a confirmation flag), instead of pure `CREATE`.

### Fix 3 — Real penetration test (not just AST scan)
**File:** `supabase/functions/security-pentest/index.ts`

Add genuine attack tests after read-only scans:
- **SQLi probe**: For each text column, try inserting payloads `' OR 1=1--`, `'; DROP TABLE x;--`, `\\x00`. Assert nothing leaks via SELECT and the table still exists.
- **RLS bypass probe**: Sign in as two synthetic test users (created via Auth admin API), have user A try to SELECT/UPDATE/DELETE user B's rows. Report which tables let it through.
- **Privilege escalation probe**: If `user_roles` exists, try `INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'admin')` as a non-admin and assert it fails.
- All test data is created in a `__pentest__` schema and dropped at the end.

### Fix 4 — Auto-Fix loop is reliable
**File:** `src/components/SecurityAuditPanel.tsx`
- Wrap the AI call with up to 3 retries. After each, validate the returned `GenerationResult` against a Zod schema. On failure, send the validation errors back to the AI and ask for a corrected JSON.
- Show streaming progress ("AI is rewriting schema… 3/12 fixes applied").
- After fix, automatically re-run the audit and show before/after delta.

### Fix 5 — Local download ZIP actually runs
**File:** `src/utils/generateProjectZip.ts`
- Generate a `src/routes/index.ts` that imports + registers every route file.
- Update `server.ts` to call `await registerRoutes(app)`.
- Add a basic `tsx`/`tsc` check in CI step (just ensure files compile by writing `tsconfig` paths correctly).
- Bundle a working `README.md` quick-start that's been verified end-to-end.

### Fix 6 — Tab bar cleanup
**File:** `src/pages/ProjectView.tsx`

Group 12 tabs into 4 logical sections via a 2-row layout on desktop and accordion on mobile:
- **Build**: Schema · Routes · ER · Refine
- **Test**: Docs · Play · Audit · PenTest
- **Ship**: Env · Zip · Deploy
- **Manage**: History

### Fix 7 — Test file covering full flow
**New file:** `supabase/functions/_tests/full-flow.test.ts`

Deno tests covering:
1. `chat-backend` non-streaming returns valid JSON
2. `generate-backend` produces schema with no `password` columns and FK on every `_id`
3. `apply-supabase` against test DB (`eshpnklgpbdbnoqxnerk`) creates tables + secure RLS, then rolls back via DROP at end
4. `introspect-supabase` round-trips a known schema
5. `security-pentest` against the freshly deployed test DB returns score ≥ 80
6. ZIP generator output unzips and `npm install && npm run build` succeeds (smoke check that all referenced files exist)

### Fix 8 — Credentials persist across devices
**Migration:** Move project storage from `localStorage` → the existing Supabase `projects` table (already has `supabase_project_url`, `supabase_db_password` columns).

**File:** `src/context/ProjectContext.tsx` — replace localStorage reads/writes with `supabase.from('projects').select/insert/update`. Show "Saved ✓ to cloud" indicator.

### Files Summary

| Action | File |
|--------|------|
| Edit | `supabase/functions/apply-supabase/index.ts` (smart RLS + sync mode) |
| Create | `supabase/functions/introspect-supabase/index.ts` |
| Edit | `supabase/functions/security-pentest/index.ts` (real attacks) |
| Edit | `src/components/SecurityAuditPanel.tsx` (retry + Zod validate) |
| Edit | `src/components/DeployAndTutorial.tsx` (Import Existing button) |
| Edit | `src/utils/generateProjectZip.ts` (working server.ts) |
| Edit | `src/pages/ProjectView.tsx` (grouped tabs) |
| Edit | `src/context/ProjectContext.tsx` (cloud storage) |
| Create | `supabase/functions/_tests/full-flow.test.ts` |
| Create | `FULL_FLOW_TEST_REPORT.md` (results from running the tests against your test DB) |

### Tech notes
- The test Supabase project (`eshpnklgpbdbnoqxnerk`) and access token will be used during the implementation phase to validate Fix 1, Fix 2, Fix 3, and Fix 7 end-to-end. Results captured in `FULL_FLOW_TEST_REPORT.md`.
- All RLS policy changes are backward-compatible — existing deployments won't break, new ones get hardened policies.
- Cloud project sync uses the existing `projects` table & RLS already in place (per-user via `auth.uid() = user_id`).

