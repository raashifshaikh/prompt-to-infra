

# Plan: Production-Ready Supabase Direct Apply & GitHub OAuth

## Summary
Rewrite the `apply-supabase` edge function to use the Deno Postgres driver with proper transactions, SQL validation, and batching. Add GitHub OAuth flow for private repo access. Update the Deploy tab UI with live per-table progress feedback.

---

## 1. Rewrite `apply-supabase` Edge Function

**Current problem**: Uses unreliable REST endpoints (`/pg`, `exec_sql`) that don't work.

**New approach**: Accept a `dbUrl` (Postgres connection string) from the user instead of URL + service role key. Use the Deno Postgres driver for direct SQL execution.

**Key safety features**:
- **SQL allowlist validator** — only permit statements starting with `CREATE TABLE`, `CREATE POLICY`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TYPE`, `CREATE FUNCTION`. Block `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, `DELETE FROM`, `ALTER ROLE`.
- **Transaction wrapping** — `BEGIN` → execute all statements → `COMMIT` on success / `ROLLBACK` on failure.
- **Per-statement results** — return `{ table, status, error? }` for each table so the UI can show granular progress.
- **Batching** — execute max 5 statements per batch to stay within edge function timeout.
- **Port guidance** — UI helper text tells users to use port `:5432` (direct) not `:6543` (pooler) for migrations.

```text
Frontend sends: { tables[], dbUrl }
  ↓
Edge Function:
  1. Validate dbUrl format
  2. Generate SQL from tables (CREATE TABLE + ALTER TABLE ENABLE RLS + CREATE POLICY)
  3. Validate each statement against allowlist
  4. Connect via Deno Postgres driver
  5. BEGIN transaction
  6. Execute statements sequentially, capture per-statement results
  7. COMMIT or ROLLBACK
  8. Return { results[], sql }
```

## 2. Update Deploy Tab UI (`DeployTab.tsx`)

- Replace "Supabase URL + Service Role Key" inputs with a single **Database URL** password input
- Add helper text: "Use the direct connection string (port 5432) from your Supabase project Settings > Database"
- Show **live progress** during apply: checkmark per table created, X on failure with error message
- Keep the "Generated SQL" section with copy/download for manual fallback
- Add "Open SQL Editor" link: `https://supabase.com/dashboard/project/{projectId}/sql/new`

## 3. GitHub OAuth for Private Repos

**New edge function: `github-auth`**
- Receives `code` from GitHub OAuth callback
- Exchanges it for an access token using `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` secrets (already configured)
- Returns the token to the frontend

**Frontend flow**:
- Add "Connect GitHub" button on Import page
- OAuth redirect to `https://github.com/login/oauth/authorize?client_id=...&scope=repo`
- Callback URL catches `?code=` param, calls `github-auth` edge function
- Store token in localStorage, pass to `analyze-repo` for authenticated GitHub API calls

**Update `analyze-repo`**: Accept optional `githubToken` parameter, use it in GitHub API request headers for private repo access.

## 4. Update `supabase/config.toml`

Add `github-auth` function entry with `verify_jwt = false`.

## 5. Files Changed

| File | Action |
|------|--------|
| `supabase/functions/apply-supabase/index.ts` | Rewrite with Deno Postgres driver, transactions, SQL validation |
| `supabase/functions/github-auth/index.ts` | New — OAuth token exchange |
| `supabase/functions/analyze-repo/index.ts` | Add `githubToken` support for authenticated requests |
| `supabase/config.toml` | Add `github-auth` entry |
| `src/components/DeployTab.tsx` | Replace inputs with dbUrl, add progress UI, SQL Editor link |
| `src/pages/ImportProject.tsx` | Add "Connect GitHub" button + OAuth callback handling |
| `src/types/project.ts` | Update `supabaseConfig` type to use `dbUrl` instead of `serviceRoleKey` |

## Security Notes
- The `dbUrl` is sent to the edge function and used only for that request — never stored server-side
- SQL validation prevents destructive operations from AI-generated schemas
- GitHub tokens stored in localStorage (acceptable since no auth system yet; will move to secure storage when auth is added)

