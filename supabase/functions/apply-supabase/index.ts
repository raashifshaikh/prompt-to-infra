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
  'DELETE FROM',
  'ALTER ROLE',
  'ALTER USER',
  'DROP TABLE',
  'DROP FUNCTION',
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
    let def = `"${col.name}" ${col.type}`;
    if (col.primary_key) def += ' PRIMARY KEY';
    if (col.unique && !col.primary_key) def += ' UNIQUE';
    if (!col.nullable && !col.primary_key) def += ' NOT NULL';
    if (col.default) def += ` DEFAULT ${col.default}`;
    if (col.references) {
      const refMatch = col.references.match(/^(\w+)\((\w+)\)$/);
      if (refMatch) {
        def += ` REFERENCES public."${refMatch[1]}"("${refMatch[2]}")`;
      } else {
        def += ` REFERENCES ${col.references}`;
      }
      if (col.on_delete) def += ` ON DELETE ${col.on_delete}`;
    }
    return def;
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

function generateRLSStatements(tableName: string): string[] {
  return [
    `ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "Enable read access for authenticated users" ON public."${tableName}" FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Enable insert for authenticated users" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Enable update for authenticated users" ON public."${tableName}" FOR UPDATE TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "Enable delete for authenticated users" ON public."${tableName}" FOR DELETE TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];
}

function generateStorageBucketSQL(bucket: StorageBucket): { label: string; sql: string }[] {
  const stmts: { label: string; sql: string }[] = [];
  
  // Create bucket
  const mimeTypes = bucket.allowedMimeTypes ? `'${JSON.stringify(bucket.allowedMimeTypes)}'::jsonb` : 'NULL';
  const maxSize = bucket.maxFileSize || 52428800; // 50MB default
  
  stmts.push({
    label: `Create storage bucket "${bucket.name}"`,
    sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('${bucket.name}', '${bucket.name}', ${bucket.public}, ${maxSize}, ${mimeTypes}) ON CONFLICT (id) DO NOTHING`,
  });
  
  // Storage RLS policies
  if (bucket.public) {
    stmts.push({
      label: `Allow public read on "${bucket.name}"`,
      sql: `CREATE POLICY "Public read ${bucket.name}" ON storage.objects FOR SELECT TO public USING (bucket_id = '${bucket.name}')`,
    });
  }
  
  stmts.push({
    label: `Allow authenticated upload to "${bucket.name}"`,
    sql: `CREATE POLICY "Auth upload ${bucket.name}" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${bucket.name}')`,
  });
  
  stmts.push({
    label: `Allow authenticated update on "${bucket.name}"`,
    sql: `CREATE POLICY "Auth update ${bucket.name}" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${bucket.name}')`,
  });
  
  stmts.push({
    label: `Allow authenticated delete on "${bucket.name}"`,
    sql: `CREATE POLICY "Auth delete ${bucket.name}" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${bucket.name}')`,
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
  
  const rlsStmts = generateRLSStatements(table.name);
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
    const { tables, enums, indexes, storageBuckets, dbUrl } = await req.json();

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
        allStatements.push({ label: `Create enum "${e.name}"`, sql: generateEnumSQL(e) });
      }
    }
    
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
