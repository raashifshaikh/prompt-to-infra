

## Plan: Fix Supabase Schema Apply + Production Readiness Fixes

### Issues Found

**Critical — Schema Apply Failures:**

1. **Wrong connection string format in Easy Setup**: The "Easy Setup" mode constructs a **pooler URL** (`aws-0-us-east-1.pooler.supabase.com`) with a hardcoded AWS region. This fails for projects in other regions. Should use the **direct connection** format: `db.{ref}.supabase.co:5432`

2. **Regex too restrictive**: The project ref regex `[a-z]+` won't match refs containing digits (e.g. `ntahifasqypmhvqpqjrq` works, but others with numbers won't)

3. **CREATE TRIGGER fails on re-run**: `CREATE TRIGGER` without `IF NOT EXISTS` or `DROP IF EXISTS` causes errors when applying schema a second time

4. **CREATE POLICY fails on re-run**: Same issue — policies without idempotent guards fail on re-application

5. **CORS headers incomplete**: The `apply-supabase` edge function is missing newer Supabase client headers (`x-supabase-client-platform`, etc.), which can cause preflight failures

**Secondary — Production Readiness:**

6. **ProjectProvider outside BrowserRouter**: Works but is technically outside the router context. Not a bug currently since it doesn't use routing hooks.

7. **DialogContent missing DialogTitle**: Console error from Radix UI about missing accessibility title in a dialog somewhere

### Changes

#### 1. Fix `supabase/functions/apply-supabase/index.ts`
- Update CORS headers to include all required Supabase client headers
- Make `CREATE TRIGGER` idempotent: wrap in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ... END $$`
- Make `CREATE POLICY` idempotent: wrap each policy in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ... END $$` block

#### 2. Fix `src/components/DeployAndTutorial.tsx`
- Change Easy Setup connection string from pooler format to direct format: `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`
- Update regex to `[a-z0-9]+` for project ref matching
- Add better validation and error messaging

#### 3. Redeploy `apply-supabase` edge function

### Technical Detail

**Connection string fix (DeployAndTutorial.tsx line ~113):**
```
Before: postgresql://postgres.${ref}:${pw}@aws-0-us-east-1.pooler.supabase.com:5432/postgres
After:  postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres
```

**Idempotent trigger (apply-supabase):**
```sql
DO $$ BEGIN
  CREATE TRIGGER update_tablename_updated_at ...;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

**Idempotent policy (apply-supabase):**
```sql
DO $$ BEGIN
  CREATE POLICY "policy_name" ON ...;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

