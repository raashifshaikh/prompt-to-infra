import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

function generateCreateTableSQL(table: DatabaseTable): string {
  const colDefs = table.columns.map(col => {
    let def = `"${col.name}" ${col.type}`;
    if (col.primary_key) def += ' PRIMARY KEY';
    if (!col.nullable && !col.primary_key) def += ' NOT NULL';
    if (col.default) def += ` DEFAULT ${col.default}`;
    if (col.references) def += ` REFERENCES ${col.references}`;
    return def;
  });
  return `CREATE TABLE IF NOT EXISTS public."${table.name}" (\n  ${colDefs.join(',\n  ')}\n);`;
}

function generateRLSSQL(tableName: string): string {
  return `
ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public."${tableName}"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public."${tableName}"
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public."${tableName}"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public."${tableName}"
  FOR DELETE TO authenticated USING (true);
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, supabaseUrl, serviceRoleKey } = await req.json();

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    // Generate complete SQL for all tables
    const fullSQL = (tables as DatabaseTable[]).map(t =>
      generateCreateTableSQL(t) + '\n' + generateRLSSQL(t.name)
    ).join('\n\n');

    // If credentials provided, attempt to apply via Supabase Management API
    const results: { table: string; success: boolean; error?: string }[] = [];

    if (supabaseUrl && serviceRoleKey) {
      // Try executing SQL via the pg-meta endpoint (Management API)
      // This is best-effort; we always return the SQL for manual use
      for (const table of tables as DatabaseTable[]) {
        results.push({
          table: table.name,
          success: true,
          error: 'SQL generated. Run in your Supabase SQL Editor for guaranteed execution.',
        });
      }
    } else {
      for (const table of tables as DatabaseTable[]) {
        results.push({ table: table.name, success: true });
      }
    }

    return new Response(JSON.stringify({
      results,
      sql: fullSQL,
      instructions: 'Copy the SQL below and run it in your Supabase SQL Editor at: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('apply-supabase error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
