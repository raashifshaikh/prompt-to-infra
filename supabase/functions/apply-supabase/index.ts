import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  primary_key?: boolean;
  references?: string;
  on_delete?: string;
  unique?: boolean;
}

interface DatabaseTable {
  name: string;
  columns: TableColumn[];
}

interface EnumType {
  name: string;
  values: string[];
}

interface IndexDef {
  table: string;
  columns: string[];
  unique?: boolean;
}

interface StorageBucket {
  name: string;
  public: boolean;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

// SQL safety validator
const ALLOWED_PREFIXES = [
  'CREATE TABLE',
  'CREATE POLICY',
  'ALTER TABLE',
  'CREATE INDEX',
  'CREATE TYPE',
  'CREATE FUNCTION',
  'CREATE OR REPLACE FUNCTION',
  'CREATE UNIQUE INDEX',
  'CREATE TRIGGER',
  'DO $$',
  'INSERT INTO STORAGE',
];

const BLOCKED_KEYWORDS = [
  'DROP DATABASE',
  'DROP SCHEMA',
  'TRUNCATE',
  'ALTER ROLE',
  'ALTER USER',
  'DROP POLICY',
  'GRANT',
  'REVOKE',
];

function validateSQL(stmt: string): { safe: boolean; reason?: string } {
  const trimmed = stmt.trim().toUpperCase();
  
  for (const blocked of BLOCKED_KEYWORDS) {
    if (trimmed.includes(blocked)) {
      return { safe: false, reason: `Blocked keyword detected: ${blocked}` };
    }
  }

  const isAllowed = ALLOWED_PREFIXES.some(prefix => trimmed.startsWith(prefix));
  if (!isAllowed) {
    return { safe: false, reason: `Statement does not start with an allowed prefix` };
  }

  return { safe: true };
}

// Topological sort: order tables so referenced tables come first
function topologicalSort(tables: DatabaseTable[]): DatabaseTable[] {
  const tableMap = new Map<string, DatabaseTable>();
  const deps = new Map<string, Set<string>>();
  
  for (const t of tables) {
    tableMap.set(t.name, t);
    deps.set(t.name, new Set());
  }
  
  for (const t of tables) {
    for (const col of t.columns) {
      if (col.references) {
        const match = col.references.match(/^(\w+)\(/);
        if (match && match[1] !== t.name && tableMap.has(match[1])) {
          deps.get(t.name)!.add(match[1]);
        }
      }
    }
  }
  
  const sorted: DatabaseTable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dep of deps.get(name) || []) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(tableMap.get(name)!);
  }
  
  for (const t of tables) {
    visit(t.name);
  }
  
  return sorted;
}

function generateEnumSQL(e: EnumType): string {
  const vals = e.values.map(v => `'${v}'`).join(', ');
  return `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.name}') THEN CREATE TYPE public."${e.name}" AS ENUM (${vals}); END IF; END $$`;
}

function generateCreateTableSQL(table: DatabaseTable): string {
  const colDefs = table.columns.map(col => {
    // ---- Type & default coercion ----
    let type = col.type;
    let def = col.default;
    const lname = col.name.toLowerCase();
    const ltype = type.toLowerCase().trim();

    // currency: char/character(1) → char(3) DEFAULT 'USD'
    if (lname === 'currency' && (ltype === 'character' || ltype === 'char' || ltype === 'char(1)' || ltype === 'character(1)')) {
      type = 'char(3)';
      if (!def) def = "'USD'";
    }

    // sane defaults for counters / booleans / sort_order when NOT NULL and missing default
    const isCounter = /(_count$|^view_count$|^like_count$|^comment_count$|^share_count$|^follower_count$|^following_count$|^helpful_count$|^stock_quantity$|^quantity$)/.test(lname);
    const isSortPos = lname === 'sort_order' || lname === 'position' || lname === 'display_order';
    const isBool = /^(boolean|bool)$/.test(ltype);
    const isBoolName = /^(is_|has_)/.test(lname) || lname === 'published' || lname === 'is_active' || lname === 'is_featured';

    if (!def && !col.nullable && !col.primary_key) {
      if (isCounter || isSortPos) def = '0';
      else if (isBool || (isBoolName && (isBool || ltype === ''))) def = 'false';
    }

    let line = `"${col.name}" ${type}`;
    if (col.primary_key) line += ' PRIMARY KEY';
    if (col.unique && !col.primary_key) line += ' UNIQUE';
    if (!col.nullable && !col.primary_key) line += ' NOT NULL';
    if (def) line += ` DEFAULT ${def}`;
    if (col.references) {
      const refMatch = col.references.match(/^(\w+)\((\w+)\)$/);
      if (refMatch) {
        line += ` REFERENCES public."${refMatch[1]}"("${refMatch[2]}")`;
      } else {
        line += ` REFERENCES ${col.references}`;
      }
      if (col.on_delete) line += ` ON DELETE ${col.on_delete}`;
    }

    // CHECK constraints
    const checks: string[] = [];
    if (lname === 'quantity' || lname === 'stock_quantity') checks.push(`"${col.name}" >= 0`);
    if (lname === 'rating') checks.push(`"${col.name}" BETWEEN 1 AND 5`);
    if (/^(amount|price|total_amount|subtotal|tax_amount|discount_amount|unit_price|balance|available_balance)$/.test(lname)) {
      checks.push(`"${col.name}" >= 0`);
    }
    for (const c of checks) line += ` CHECK (${c})`;

    return line;
  });
  return `CREATE TABLE IF NOT EXISTS public."${table.name}" (\n  ${colDefs.join(',\n  ')}\n)`;
}



function generateIndexSQL(idx: IndexDef): string {
  const cols = idx.columns.map(c => `"${c}"`).join(', ');
  const name = `idx_${idx.table}_${idx.columns.join('_')}`;
  const unique = idx.unique ? 'UNIQUE ' : '';
  return `CREATE ${unique}INDEX IF NOT EXISTS "${name}" ON public."${idx.table}" (${cols})`;
}

function generateUpdatedAtTrigger(tableName: string): string[] {
  return [
    `CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql`,
    `DO $$ BEGIN CREATE TRIGGER update_${tableName}_updated_at BEFORE UPDATE ON public."${tableName}" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];
}

/**
 * Detects the ownership column of a table for column-aware RLS.
 * Returns the first matching column name, or null if none found.
 */
function detectOwnershipColumn(table: DatabaseTable): string | null {
  const candidates = ['user_id', 'owner_id', 'created_by', 'author_id', 'profile_id'];
  for (const cand of candidates) {
    if (table.columns.some(c => c.name === cand)) return cand;
  }
  return null;
}

function detectVisibilityColumn(table: DatabaseTable): string | null {
  const candidates = ['is_public', 'published', 'is_published', 'visibility'];
  for (const cand of candidates) {
    if (table.columns.some(c => c.name === cand)) return cand;
  }
  return null;
}

function isLookupTable(table: DatabaseTable): boolean {
  // Lookup tables: categories, tags, types, statuses — globally readable, admin-write
  const lookupNames = ['categor', 'tag', 'type', 'status', 'role', 'permission', 'country', 'currency'];
  return lookupNames.some(n => table.name.toLowerCase().includes(n));
}

/**
 * Detects sensitive tables that must NEVER be world-readable.
 * Banking, medical, audit, security, payment data — read access requires
 * explicit ownership match or admin/staff role.
 */
function isSensitiveTable(table: DatabaseTable): { sensitive: boolean; readerRoles: string[] } {
  const name = table.name.toLowerCase();
  // Banking / finance
  const bankingHints = ['transaction', 'transfer', 'ledger', 'account', 'balance', 'card', 'payment', 'invoice', 'loan', 'beneficiar', 'standing_order', 'wire', 'ach', 'kyc', 'fraud', 'compliance', 'aml'];
  // Medical
  const medicalHints = ['patient', 'medical', 'prescription', 'diagnos', 'lab_result', 'health', 'insurance_claim', 'phi'];
  // Audit / security / private comms
  const auditHints = ['audit', 'security_log', 'access_log', 'session', 'api_key', 'webhook', 'secret', 'private_key', 'message', 'support_ticket', 'support_message', 'complaint'];

  if (bankingHints.some(h => name.includes(h))) {
    return { sensitive: true, readerRoles: ['admin', 'manager', 'compliance_officer', 'teller'] };
  }
  if (medicalHints.some(h => name.includes(h))) {
    return { sensitive: true, readerRoles: ['admin', 'doctor', 'nurse'] };
  }
  if (auditHints.some(h => name.includes(h))) {
    return { sensitive: true, readerRoles: ['admin', 'compliance_officer'] };
  }
  return { sensitive: false, readerRoles: [] };
}

function buildRoleCheck(roles: string[]): string {
  // OR-chain of has_role(uid, 'role') — wraps in parens
  return roles.map(r => `public.has_role(auth.uid(), '${r}')`).join(' OR ');
}

/**
 * Generates production-grade column-aware RLS policies.
 * - Owner-scoped tables: only the owner can read/write their rows
 * - Public+owner tables: visible to all if is_public, owner can edit
 * - Lookup tables: world-readable, admin-only writes
 * - Sensitive tables (banking/medical/audit): private — owner OR specific staff roles only
 * - Generic tables: authenticated read, admin-only writes (safer than blanket true)
 */
function generateRLSStatements(table: DatabaseTable): string[] {
  const tableName = table.name;
  const stmts: string[] = [`ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY`];

  // Skip auto-policy generation for user_roles — the role infrastructure block
  // already adds the correct admin-only INSERT/UPDATE/DELETE + owner SELECT policies.
  // Auto-generating an "Owner insert" here would let anyone grant themselves any role.
  if (tableName === 'user_roles') {
    return stmts;
  }

  const ownerCol = detectOwnershipColumn(table);
  const visCol = detectVisibilityColumn(table);
  const { sensitive, readerRoles } = isSensitiveTable(table);

  const wrap = (name: string, sql: string) =>
    `DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  if (sensitive) {
    // Sensitive (banking/medical/audit) — never permissive.
    // Read: owner (if owner column exists) OR specified staff roles. No owner col → staff-only.
    const roleCheck = buildRoleCheck(readerRoles);
    const selectUsing = ownerCol
      ? `(auth.uid() = ${ownerCol} OR ${roleCheck})`
      : `(${roleCheck})`;
    stmts.push(wrap('select', `CREATE POLICY "Owner or staff read on ${tableName}" ON public."${tableName}" FOR SELECT TO authenticated USING (${selectUsing})`));

    // Insert: owner (if applicable) OR staff. Owner must match auth.uid() in WITH CHECK.
    const insertCheck = ownerCol
      ? `(auth.uid() = ${ownerCol} OR ${roleCheck})`
      : `(${roleCheck})`;
    stmts.push(wrap('insert', `CREATE POLICY "Owner or staff insert on ${tableName}" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (${insertCheck})`));

    // Update: staff-only (sensitive records like transactions should be immutable to customers).
    stmts.push(wrap('update', `CREATE POLICY "Staff update on ${tableName}" ON public."${tableName}" FOR UPDATE TO authenticated USING (${roleCheck}) WITH CHECK (${roleCheck})`));

    // Delete: admin-only.
    stmts.push(wrap('delete', `CREATE POLICY "Admin delete on ${tableName}" ON public."${tableName}" FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`));
  } else if (ownerCol) {
    // SELECT: owner sees own rows; if visibility column exists, also publicly visible rows
    const selectUsing = visCol
      ? `(${visCol} = true OR auth.uid() = ${ownerCol})`
      : `auth.uid() = ${ownerCol}`;
    stmts.push(wrap('select', `CREATE POLICY "Owner or public read on ${tableName}" ON public."${tableName}" FOR SELECT TO authenticated USING (${selectUsing})`));
    stmts.push(wrap('insert', `CREATE POLICY "Owner insert on ${tableName}" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (auth.uid() = ${ownerCol})`));
    stmts.push(wrap('update', `CREATE POLICY "Owner update on ${tableName}" ON public."${tableName}" FOR UPDATE TO authenticated USING (auth.uid() = ${ownerCol}) WITH CHECK (auth.uid() = ${ownerCol})`));
    stmts.push(wrap('delete', `CREATE POLICY "Owner delete on ${tableName}" ON public."${tableName}" FOR DELETE TO authenticated USING (auth.uid() = ${ownerCol})`));
  } else if (isLookupTable(table)) {
    // Lookup: world-read, admin-write
    stmts.push(wrap('select', `CREATE POLICY "Public read ${tableName}" ON public."${tableName}" FOR SELECT TO authenticated, anon USING (true)`));
    stmts.push(wrap('insert', `CREATE POLICY "Admin insert ${tableName}" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'))`));
    stmts.push(wrap('update', `CREATE POLICY "Admin update ${tableName}" ON public."${tableName}" FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`));
    stmts.push(wrap('delete', `CREATE POLICY "Admin delete ${tableName}" ON public."${tableName}" FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`));
  } else {
    // Generic table with no ownership column — admin-only writes, authenticated read
    stmts.push(wrap('select', `CREATE POLICY "Authenticated read ${tableName}" ON public."${tableName}" FOR SELECT TO authenticated USING (true)`));
    stmts.push(wrap('insert', `CREATE POLICY "Admin insert ${tableName}" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'))`));
    stmts.push(wrap('update', `CREATE POLICY "Admin update ${tableName}" ON public."${tableName}" FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`));
    stmts.push(wrap('delete', `CREATE POLICY "Admin delete ${tableName}" ON public."${tableName}" FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`));
  }

  return stmts;
}

/**
 * Generates the role infrastructure (enum + user_roles table + has_role function).
 * Idempotent — safe to run on every deploy.
 */
function generateRoleInfrastructure(extraRoles: string[] = []): { label: string; sql: string }[] {
  // Always include these baseline roles
  const baseline = ['admin', 'moderator', 'user'];
  // Extra roles from sensitive-table detection (banking/medical/etc.) and user-supplied auth.roles
  const allRoles = Array.from(new Set([...baseline, ...extraRoles.filter(r => /^[a-z_][a-z0-9_]*$/i.test(r))]));
  const enumValues = allRoles.map(r => `'${r}'`).join(', ');
  // Build ADD VALUE statements (idempotent — IF NOT EXISTS is supported in PG ≥ 9.6)
  const addValueStmts = allRoles
    .map(r => `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS '${r}';`)
    .join(' ');
  return [
    {
      label: 'Create app_role enum (with all referenced roles)',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
          CREATE TYPE public.app_role AS ENUM (${enumValues});
        END IF;
      END $$`,
    },
    {
      // Run ADD VALUE outside the BEGIN/END block — Postgres requires ALTER TYPE ADD VALUE
      // to run in its own transaction, so we keep each as a top-level statement.
      label: 'Ensure all roles exist in app_role enum',
      sql: `DO $$ BEGIN ${addValueStmts} EXCEPTION WHEN others THEN NULL; END $$`,
    },
    {
      label: 'Create user_roles table',
      sql: `CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, role))`,
    },
    {
      label: 'Enable RLS on user_roles',
      sql: `ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY`,
    },
    {
      label: 'Create has_role security definer function',
      sql: `CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $func$`,
    },
    {
      label: 'Policy: users read own roles',
      sql: `DO $$ BEGIN CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    },
    {
      label: 'Policy: admins manage roles',
      sql: `DO $$ BEGIN CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    },
  ];
}

function generateStorageBucketSQL(bucket: StorageBucket): { label: string; sql: string }[] {
  const stmts: { label: string; sql: string }[] = [];
  
  // Create bucket — use only columns that exist in all Supabase versions
  const maxSize = bucket.maxFileSize || 52428800; // 50MB default
  
  if (bucket.allowedMimeTypes && bucket.allowedMimeTypes.length > 0) {
    const mimeArray = bucket.allowedMimeTypes.map(m => `'${m}'`).join(', ');
    stmts.push({
      label: `Create storage bucket "${bucket.name}"`,
      sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('${bucket.name}', '${bucket.name}', ${bucket.public}, ${maxSize}, ARRAY[${mimeArray}]::text[]) ON CONFLICT (id) DO NOTHING`,
    });
  } else {
    stmts.push({
      label: `Create storage bucket "${bucket.name}"`,
      sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('${bucket.name}', '${bucket.name}', ${bucket.public}, ${maxSize}) ON CONFLICT (id) DO NOTHING`,
    });
  }
  
  // Storage RLS policies — wrap in DO blocks for idempotency
  if (bucket.public) {
    stmts.push({
      label: `Allow public read on "${bucket.name}"`,
      sql: `DO $$ BEGIN CREATE POLICY "Public read ${bucket.name}" ON storage.objects FOR SELECT TO public USING (bucket_id = '${bucket.name}'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    });
  }
  
  stmts.push({
    label: `Allow authenticated upload to "${bucket.name}"`,
    sql: `DO $$ BEGIN CREATE POLICY "Auth upload ${bucket.name}" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${bucket.name}'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  });
  
  stmts.push({
    label: `Allow authenticated update on "${bucket.name}"`,
    sql: `DO $$ BEGIN CREATE POLICY "Auth update ${bucket.name}" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${bucket.name}'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  });
  
  stmts.push({
    label: `Allow authenticated delete on "${bucket.name}"`,
    sql: `DO $$ BEGIN CREATE POLICY "Auth delete ${bucket.name}" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${bucket.name}'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  });
  
  return stmts;
}

function generateStatementsForTable(table: DatabaseTable): { label: string; sql: string }[] {
  const stmts: { label: string; sql: string }[] = [];
  stmts.push({ label: `Create table "${table.name}"`, sql: generateCreateTableSQL(table) });
  
  const hasUpdatedAt = table.columns.some(c => c.name === 'updated_at');
  if (hasUpdatedAt) {
    const triggerStmts = generateUpdatedAtTrigger(table.name);
    stmts.push({ label: `Create updated_at function`, sql: triggerStmts[0] });
    stmts.push({ label: `Add updated_at trigger on "${table.name}"`, sql: triggerStmts[1] });
  }
  
  const rlsStmts = generateRLSStatements(table);
  stmts.push({ label: `Enable RLS on "${table.name}"`, sql: rlsStmts[0] });
  for (let i = 1; i < rlsStmts.length; i++) {
    stmts.push({ label: `Add RLS policy on "${table.name}"`, sql: rlsStmts[i] });
  }
  return stmts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, enums, indexes, storageBuckets, dbUrl, auth } = await req.json();

    if (!dbUrl) {
      throw new Error('Database connection URL is required. Use the direct connection string (port 5432) from Supabase Settings > Database.');
    }

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    // Sort tables topologically
    const sortedTables = topologicalSort(tables as DatabaseTable[]);

    // Generate all statements
    const allStatements: { label: string; sql: string }[] = [];
    
    // 1. Enums first
    if (enums && Array.isArray(enums)) {
      for (const e of enums as EnumType[]) {
        // Skip app_role here — generateRoleInfrastructure handles it with merged roles.
        if (e.name === 'app_role') continue;
        allStatements.push({ label: `Create enum "${e.name}"`, sql: generateEnumSQL(e) });
      }
    }

    // 1.5 Role infrastructure — collect every role referenced anywhere:
    //   • baseline (admin/moderator/user) — always present
    //   • auth.roles from the generation result
    //   • staff roles from sensitive-table detection (teller/manager/doctor/etc.)
    //   • values from the incoming app_role enum if present
    const extraRoles: string[] = [];
    if (auth && Array.isArray(auth.roles)) extraRoles.push(...auth.roles);
    if (enums && Array.isArray(enums)) {
      const appRoleEnum = (enums as EnumType[]).find(e => e.name === 'app_role');
      if (appRoleEnum && Array.isArray(appRoleEnum.values)) extraRoles.push(...appRoleEnum.values);
    }
    for (const t of sortedTables) {
      const { sensitive, readerRoles } = isSensitiveTable(t);
      if (sensitive) extraRoles.push(...readerRoles);
    }
    allStatements.push(...generateRoleInfrastructure(extraRoles));

    // 2. Tables in topological order
    for (const table of sortedTables) {
      allStatements.push(...generateStatementsForTable(table));
    }
    
    // 3. Indexes
    if (indexes && Array.isArray(indexes)) {
      for (const idx of indexes as IndexDef[]) {
        allStatements.push({ label: `Create index on "${idx.table}"`, sql: generateIndexSQL(idx) });
      }
    }
    
    // 4. Storage buckets (these use INSERT which we need to allow)
    const storageStatements: { label: string; sql: string }[] = [];
    if (storageBuckets && Array.isArray(storageBuckets)) {
      for (const bucket of storageBuckets as StorageBucket[]) {
        storageStatements.push(...generateStorageBucketSQL(bucket));
      }
    }

    // Validate schema statements (not storage — those use INSERT)
    for (const stmt of allStatements) {
      const validation = validateSQL(stmt.sql);
      if (!validation.safe) {
        throw new Error(`Unsafe SQL detected in "${stmt.label}": ${validation.reason}`);
      }
    }

    // Generate full SQL for download (include storage)
    const allStmtsForSQL = [...allStatements, ...storageStatements];
    const fullSQL = allStmtsForSQL.map(s => s.sql + ';').join('\n\n');

    // Connect to the user's database
    const client = new Client(dbUrl);
    const results: { label: string; success: boolean; error?: string }[] = [];

    try {
      await client.connect();
      await client.queryArray("BEGIN");

      // Execute schema statements
      for (const stmt of allStatements) {
        try {
          await client.queryArray(stmt.sql);
          results.push({ label: stmt.label, success: true });
        } catch (stmtErr) {
          const errMsg = stmtErr instanceof Error ? stmtErr.message : 'Unknown error';
          results.push({ label: stmt.label, success: false, error: errMsg });
          await client.queryArray("ROLLBACK");
          return new Response(JSON.stringify({
            success: false,
            results,
            sql: fullSQL,
            error: `Failed at: ${stmt.label} — ${errMsg}`,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      await client.queryArray("COMMIT");
      
      // Storage bucket statements run outside the schema transaction
      // (storage.buckets may not support transactional DDL)
      for (const stmt of storageStatements) {
        try {
          await client.queryArray(stmt.sql);
          results.push({ label: stmt.label, success: true });
        } catch (stmtErr) {
          const errMsg = stmtErr instanceof Error ? stmtErr.message : 'Unknown error';
          // Don't fail the whole migration for storage — it's additive
          results.push({ label: stmt.label, success: false, error: errMsg });
        }
      }
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }

    const failedCount = results.filter(r => !r.success).length;
    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: failedCount === 0,
      results,
      sql: fullSQL,
      message: failedCount === 0
        ? `Successfully applied ${successCount} statements`
        : `Applied ${successCount} statements with ${failedCount} warnings`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('apply-supabase error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
