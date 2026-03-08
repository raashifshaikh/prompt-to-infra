

## Problem

Two issues to solve:

1. **AI generates basic schemas** — The current system prompt produces simple flat tables without proper foreign keys, indexes, enums, junction tables, timestamps, or production patterns like soft deletes and audit trails.

2. **Deployment is not seamless** — For Supabase, users must manually find and paste a database connection string. The Supabase OAuth infrastructure (supabase-oauth + supabase-manage edge functions) already exists but isn't wired into the deploy flow, meaning we're not using the one-click potential.

## Plan

### 1. Upgrade the AI System Prompt for Complex Databases

Update `supabase/functions/generate-backend/index.ts` to produce production-grade schemas:

- **Foreign keys with proper references** — Every relation explicitly uses `REFERENCES table(column)` with `ON DELETE CASCADE/SET NULL`
- **Junction tables** for many-to-many relationships (e.g., `user_roles`, `post_tags`)
- **Enums** — Generate

<lov-plan>

## Problem

Two issues to solve:

1. **AI generates basic schemas** — The current system prompt produces simple flat tables without proper foreign keys, indexes, enums, junction tables, timestamps, or production patterns like soft deletes and audit trails.

2. **Deployment is not seamless** — For Supabase, users must manually find and paste a database connection string. The Supabase OAuth infrastructure (`supabase-oauth` + `supabase-manage` edge functions) already exists but isn't wired into the deploy flow.

## Plan

### 1. Upgrade AI System Prompt for Complex Databases

**File:** `supabase/functions/generate-backend/index.ts`

Rewrite the system prompt to enforce production-grade patterns:

- **Foreign keys** with `ON DELETE CASCADE/SET NULL` and proper `references` field
- **Junction tables** for many-to-many (e.g. `user_roles`, `post_tags`)
- **Enums** as custom types (e.g. `order_status`, `user_role`)
- **Timestamps** — every table gets `created_at` and `updated_at` with defaults
- **Soft deletes** — `deleted_at` column where appropriate
- **Indexes** — generate index suggestions for frequently queried columns
- **Constraints** — unique constraints, check constraints where relevant
- **Audit patterns** — `created_by`/`updated_by` references to users table

Update the JSON schema to include:
- `enums` array: `[{ "name": "order_status", "values": ["pending", "paid", "shipped", "cancelled"] }]`
- `indexes` array: `[{ "table": "orders", "columns": ["user_id", "status"], "unique": false }]`
- Column `references` field now includes `on_delete` behavior
- Column `unique` boolean field

Also bump `max_tokens` from 8192 to 16384 to accommodate larger complex schemas.

Update `src/types/project.ts` to add `EnumType`, `IndexDef` to `GenerationResult`.

### 2. Upgrade SQL Generator for Complex Schemas

**File:** `supabase/functions/apply-supabase/index.ts`

- Generate `CREATE TYPE` statements for enums before table creation
- Generate `CREATE INDEX` statements from the indexes array
- Handle foreign key `ON DELETE` clauses
- Add `UNIQUE` constraints
- Add `updated_at` trigger function (auto-update timestamp)
- Topologically sort tables so referenced tables are created first (no FK errors)
- Add these new statement prefixes to the `ALLOWED_PREFIXES` allowlist

### 3. One-Click Supabase Deploy via OAuth

**File:** `src/components/DeployAndTutorial.tsx` — SupabaseDeploy section

Replace the manual DB URL input with an OAuth-powered flow:

1. **"Connect Supabase" button** — Initiates Supabase OAuth (using existing `SB_OAUTH_CLIENT_ID`). Redirects to `https://api.supabase.com/v1/oauth/authorize` with proper scopes
2. **After OAuth callback** — Exchange code via existing `supabase-oauth` edge function, store access token in state
3. **Project picker dropdown** — Call `supabase-manage` with `action: "list-projects"` to show user's Supabase projects
4. **One-click "Apply Schema"** — Call `supabase-manage` with `action: "run-sql"` using the selected project ref and generated SQL. No DB URL needed.
5. **Fallback** — Keep the manual DB URL input as an "Advanced" collapsible option for users who prefer direct connection

Flow:
```text
[Connect Supabase Account] → OAuth → [Select Project ▾] → [Apply Schema ✓]
```

### 4. Generation Progress Animation

**File:** `src/pages/CreateBackend.tsx`

Replace the plain "Generating..." spinner with a multi-step progress indicator:
- Step 1: "Analyzing requirements..." (immediate)
- Step 2: "Designing database schema..." (after 2s)
- Step 3: "Generating API routes..." (after 5s)
- Step 4: "Creating deployment configs..." (after 8s)

This gives perceived progress and makes the wait feel shorter.

### 5. Auto-Navigate to Deploy Tab

**File:** `src/pages/ProjectView.tsx`

After generation completes, auto-open the "Deploy & Tutorial" tab so users land directly on the action step instead of needing to click through.

### Files to modify:
- `supabase/functions/generate-backend/index.ts` — enhanced system prompt + higher token limit
- `supabase/functions/apply-supabase/index.ts` — enum/index/FK support, topological sort
- `src/types/project.ts` — add EnumType, IndexDef types
- `src/components/DeployAndTutorial.tsx` — Supabase OAuth flow + project picker
- `src/pages/CreateBackend.tsx` — progress animation during generation
- `src/pages/ProjectView.tsx` — auto-navigate to deploy tab

