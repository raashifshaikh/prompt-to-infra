import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  unique: boolean;
}

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

// Topological sort: ensure referenced tables come first
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
        const refTable = col.references.split('(')[0];
        if (refTable !== t.name && tableMap.has(refTable)) {
          deps.get(t.name)!.add(refTable);
        }
      }
    }
  }
  
  const sorted: DatabaseTable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // circular dep, just skip
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

function generateEnumSQL(enumType: EnumType): string {
  const values = enumType.values.map(v => `'${v}'`).join(', ');
  return `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumType.name}') THEN CREATE TYPE public."${enumType.name}" AS ENUM (${values}); END IF; END $$`;
}

function generateCreateTableSQL(table: DatabaseTable): string {
  const colDefs = table.columns.map(col => {
    let def = `"${col.name}" ${col.type}`;
    if (col.primary_key) def += ' PRIMARY KEY';
    if (col.unique && !col.primary_key) def += ' UNIQUE';
    if (!col.nullable && !col.primary_key) def += ' NOT NULL';
    if (col.default) def += ` DEFAULT ${col.default}`;
    if (col.references) {
      def += ` REFERENCES public."${col.references.split('(')[0]}"(${col.references.split('(')[1]}`;
      if (!col.references.endsWith(')')) def += ')';
      if (col.on_delete) def += ` ON DELETE ${col.on_delete}`;
    }
    return def;
  });
  return `CREATE TABLE IF NOT EXISTS public."${table.name}" (\n  ${colDefs.join(',\n  ')}\n)`;
}

function generateIndexSQL(index: IndexDef): string {
  const cols = index.columns.map(c => `"${c}"`).join(', ');
  const name = `idx_${index.table}_${index.columns.join('_')}`;
  const uniqueStr = index.unique ? 'UNIQUE ' : '';
  return `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${name}" ON public."${index.table}" (${cols})`;
}

function generateRLSStatements(tableName: string): string[] {
  return [
    `ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY "Enable read access for authenticated users" ON public."${tableName}" FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "Enable insert for authenticated users" ON public."${tableName}" FOR INSERT TO authenticated WITH CHECK (true)`,
    `CREATE POLICY "Enable update for authenticated users" ON public."${tableName}" FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`,
    `CREATE POLICY "Enable delete for authenticated users" ON public."${tableName}" FOR DELETE TO authenticated USING (true)`,
  ];
}

function generateUpdatedAtTrigger(tableName: string): string[] {
  const fnName = `update_${tableName}_updated_at`;
  return [
    `CREATE OR REPLACE FUNCTION public."${fnName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$`,
    `CREATE TRIGGER "set_${tableName}_updated_at" BEFORE UPDATE ON public."${tableName}" FOR EACH ROW EXECUTE FUNCTION public."${fnName}"()`,
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, dbUrl, enums, indexes } = await req.json();

    if (!dbUrl) {
      throw new Error('Database connection URL is required. Use the direct connection string (port 5432) from Supabase Settings > Database.');
    }

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    const allStatements: { label: string; sql: string }[] = [];

    // 1. Create enums first
    if (enums && Array.isArray(enums)) {
      for (const enumType of enums as EnumType[]) {
        allStatements.push({ label: `Create enum "${enumType.name}"`, sql: generateEnumSQL(enumType) });
      }
    }

    // 2. Topologically sort tables and create them
    const sortedTables = topologicalSort(tables as DatabaseTable[]);
    for (const table of sortedTables) {
      allStatements.push({ label: `Create table "${table.name}"`, sql: generateCreateTableSQL(table) });
      
      // RLS
      const rlsStmts = generateRLSStatements(table.name);
      allStatements.push({ label: `Enable RLS on "${table.name}"`, sql: rlsStmts[0] });
      for (let i = 1; i < rlsStmts.length; i++) {
        allStatements.push({ label: `Add RLS policy on "${table.name}"`, sql: rlsStmts[i] });
      }

      // updated_at trigger if table has updated_at column
      const hasUpdatedAt = table.columns.some(c => c.name === 'updated_at');
      if (hasUpdatedAt) {
        const triggerStmts = generateUpdatedAtTrigger(table.name);
        allStatements.push({ label: `Create updated_at function for "${table.name}"`, sql: triggerStmts[0] });
        allStatements.push({ label: `Create updated_at trigger for "${table.name}"`, sql: triggerStmts[1] });
      }
    }

    // 3. Create indexes
    if (indexes && Array.isArray(indexes)) {
      for (const index of indexes as IndexDef[]) {
        allStatements.push({ label: `Create index on "${index.table}" (${index.columns.join(', ')})`, sql: generateIndexSQL(index) });
      }
    }

    // Validate all statements
    for (const stmt of allStatements) {
      const validation = validateSQL(stmt.sql);
      if (!validation.safe) {
        throw new Error(`Unsafe SQL detected in "${stmt.label}": ${validation.reason}`);
      }
    }

    const fullSQL = allStatements.map(s => s.sql + ';').join('\n\n');

    const client = new Client(dbUrl);
    const results: { label: string; success: boolean; error?: string }[] = [];

    try {
      await client.connect();
      await client.queryArray("BEGIN");

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
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      sql: fullSQL,
      message: `Successfully applied ${results.length} statements`,
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
