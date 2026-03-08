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
}

interface DatabaseTable {
  name: string;
  columns: TableColumn[];
}

// SQL safety validator — only allow safe DDL statements
const ALLOWED_PREFIXES = [
  'CREATE TABLE',
  'CREATE POLICY',
  'ALTER TABLE',
  'CREATE INDEX',
  'CREATE TYPE',
  'CREATE FUNCTION',
  'CREATE OR REPLACE FUNCTION',
  'CREATE UNIQUE INDEX',
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

function generateCreateTableSQL(table: DatabaseTable): string {
  const colDefs = table.columns.map(col => {
    let def = `"${col.name}" ${col.type}`;
    if (col.primary_key) def += ' PRIMARY KEY';
    if (!col.nullable && !col.primary_key) def += ' NOT NULL';
    if (col.default) def += ` DEFAULT ${col.default}`;
    if (col.references) def += ` REFERENCES ${col.references}`;
    return def;
  });
  return `CREATE TABLE IF NOT EXISTS public."${table.name}" (\n  ${colDefs.join(',\n  ')}\n)`;
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

function generateStatementsForTable(table: DatabaseTable): { label: string; sql: string }[] {
  const stmts: { label: string; sql: string }[] = [];
  stmts.push({ label: `Create table "${table.name}"`, sql: generateCreateTableSQL(table) });
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
    const { tables, dbUrl } = await req.json();

    if (!dbUrl) {
      throw new Error('Database connection URL is required. Use the direct connection string (port 5432) from Supabase Settings > Database.');
    }

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    // Generate all statements
    const allStatements: { label: string; sql: string }[] = [];
    for (const table of tables as DatabaseTable[]) {
      allStatements.push(...generateStatementsForTable(table));
    }

    // Validate all statements before executing any
    for (const stmt of allStatements) {
      const validation = validateSQL(stmt.sql);
      if (!validation.safe) {
        throw new Error(`Unsafe SQL detected in "${stmt.label}": ${validation.reason}`);
      }
    }

    // Generate full SQL for download
    const fullSQL = allStatements.map(s => s.sql + ';').join('\n\n');

    // Connect to the user's database
    const client = new Client(dbUrl);
    const results: { label: string; success: boolean; error?: string }[] = [];

    try {
      await client.connect();

      // Execute in a transaction
      await client.queryArray("BEGIN");

      for (const stmt of allStatements) {
        try {
          await client.queryArray(stmt.sql);
          results.push({ label: stmt.label, success: true });
        } catch (stmtErr) {
          const errMsg = stmtErr instanceof Error ? stmtErr.message : 'Unknown error';
          results.push({ label: stmt.label, success: false, error: errMsg });
          // Rollback on any failure
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
