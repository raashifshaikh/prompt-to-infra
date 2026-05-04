
## Goal

The generator produces a clean shape but bad runtime semantics. Browsers can't read public content, customers can't checkout, creators can't upload, profiles never get created on signup, and `updated_at` never updates. Fix all of this in `apply-supabase` (the SQL emitter) and harden `generate-backend` (the schema author).

## Changes

### 1. RLS — readable-by-intent, writable-by-actor

Rewrite `generateRLSStatements` in `supabase/functions/apply-supabase/index.ts`:

- **Public-content tables** (auto-detected by name: `videos`, `posts`, `products`, `product_variants`, `product_images`, `brands`, `creators`, `categories`, `tags`, `comments`, `likes`, `follows`, `reviews`, `stories`, `exchange_rates`, etc., AND any table with `is_public`/`published`/`visibility='public'`):
  - SELECT → `TO authenticated, anon USING (true)` (or visibility-gated when column exists)
- **Owner-writable tables** (have `user_id` / `owner_id` / `author_id` / `profile_id` / `created_by` / `uploaded_by` / `seller_id` / `customer_id`):
  - INSERT → `WITH CHECK (auth.uid() = <owner_col>)`
  - UPDATE/DELETE → owner OR admin
- **Customer-action tables** (`orders`, `order_items`, `cart_items`, `wishlists`, `follows`, `likes`, `comments`, `reviews`, `content_reports`, `payouts` request side):
  - INSERT scoped to `auth.uid() = <owner_col>` — never admin-only
  - For child rows like `order_items` whose ownership is via parent FK, generate a policy using a `EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())` check
- **Sensitive tables** (banking/medical/audit) — keep current strict logic
- **Lookup tables** — keep world-read / admin-write
- Drop the current "admin-only INSERT for everything without an owner column" default; replace with: if the table has a parent FK to an owner-bearing table, derive ownership through it; otherwise authenticated insert+owner-scoped update.

### 2. Always emit `handle_new_user` + trigger

In `apply-supabase`, when the schema contains a `profiles` table whose `id` column is uuid PK, automatically emit:

```
CREATE OR REPLACE FUNCTION public.handle_new_user() ... INSERT INTO public.profiles (id, ...) ...
DO $$ BEGIN CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Populate display_name / avatar_url / username from `raw_user_meta_data` when those columns exist.

### 3. Updated_at trigger actually attached

Already generated per-table — verify it is emitted for every table that has an `updated_at` column (loop already covers this; add a regression check and ensure the trigger function has `SET search_path = public`).

### 4. Sane defaults + CHECK constraints (in `generate-backend` system prompt + `apply-supabase` enforcement)

In `apply-supabase`, before `CREATE TABLE`, post-process columns:

- Counter columns (`*_count`, `view_count`, `like_count`, `comment_count`, `share_count`, `follower_count`, `helpful_count`, `stock_quantity`, `quantity`) → `DEFAULT 0` if NOT NULL and no default
- Boolean columns (`is_*`, `has_*`, `published`) → `DEFAULT false`
- `sort_order` / `position` → `DEFAULT 0`
- `currency` columns of type `character` / `char` / `char(1)` → coerce to `char(3)` with `DEFAULT 'USD'`
- `quantity`, `amount`, `price`, `*_amount` → add CHECK `>= 0` (`> 0` for quantity)
- `rating` → CHECK between 1 and 5

### 5. user_roles bootstrap

- Add an explicit FK: `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- Add a one-shot bootstrap policy comment + emit a `seed_first_admin(uuid)` SECURITY DEFINER function the user can call once via SQL editor to grant the first admin without chicken-and-egg

### 6. Storage hardening

For each public bucket, replace blanket `SELECT TO public USING (bucket_id = ...)` with object-level read policy that allows GET by URL but disallows listing. Keep listing admin-only:
- The `SELECT` policy stays, but document that bucket should be created with `public=true` so CDN URLs work; add an explicit `LIST` denial via not granting the `select` policy to anon for path enumeration through storage.objects (use `name LIKE auth.uid()::text || '/%'` for private user folders).

### 7. `has_role` + helpers — fix search_path warnings

- `update_updated_at_column()` → add `SET search_path = public`
- Revoke `EXECUTE` on `has_role` from `anon`; grant only to `authenticated`

### 8. `generate-backend` prompt corrections

- Forbid `currency character` — must be `char(3)`
- Require defaults on every counter/boolean/sort_order column
- Mark catalog/content tables (`videos`, `products`, etc.) as `public_read: true` in a new optional schema flag so the applier can route them to public-read RLS without name guessing
- Require a `user_id` (or equivalent) column on tables representing user actions (orders, comments, likes, follows, reviews) so owner-scoped INSERT works

### 9. ProjectContext cloud sync (still pending from prior plan)

Migrate `src/context/ProjectContext.tsx` to read/write the existing `projects` table instead of `localStorage`, keyed by `auth.uid()`. Keep an in-memory cache for snappy UI.

## Out of scope (acknowledged but not in this pass)

The architectural critique (precomputed feeds, video pipeline state machine, idempotent payments, polymorphic-likes performance, counter sharding) is correct but is a per-app system-design concern, not something the generator can solve generically. After this pass the generator will produce a *correct* baseline; we can add domain blueprints (`feed_items`, `video_renditions`, `payment_intents` with idempotency_key) as opt-in templates in a follow-up.

## Verification

1. Re-deploy the TikTok-Shop schema to the test DB.
2. Confirm: anon can SELECT from `videos`/`products`/`brands`/`creators`/`comments`/`likes`; an authenticated user can INSERT into `orders`+`order_items`, `comments`, `likes`, `follows`; only owner can UPDATE their `videos`.
3. Sign up a new auth user → row appears in `profiles`.
4. UPDATE a row → `updated_at` changes.
5. Run Supabase linter — expect 0 critical, search_path warnings cleared.
