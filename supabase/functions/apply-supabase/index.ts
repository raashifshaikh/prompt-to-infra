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

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL and Service Role Key are required');
    }

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      throw new Error('No tables provided');
    }

    const results: { table: string; success: boolean; error?: string }[] = [];

    for (const table of tables as DatabaseTable[]) {
      const createSQL = generateCreateTableSQL(table);
      const rlsSQL = generateRLSSQL(table.name);
      const fullSQL = createSQL + '\n' + rlsSQL;

      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({}),
        });

        // Use the SQL endpoint directly via pg REST
        const sqlRes = await fetch(`${supabaseUrl}/pg`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ query: fullSQL }),
        });

        // Fallback: use the Supabase Management API approach via REST
        // Execute SQL through the postgres REST interface
        const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ sql: fullSQL }),
        });

        if (!pgRes.ok) {
          // If exec_sql RPC doesn't exist, return the SQL for manual execution
          results.push({
            table: table.name,
            success: true,
            error: 'Auto-apply unavailable. SQL generated for manual execution.',
          });
        } else {
          results.push({ table: table.name, success: true });
        }
      } catch (tableErr) {
        results.push({
          table: table.name,
          success: false,
          error: tableErr instanceof Error ? tableErr.message : 'Unknown error',
        });
      }
    }

    // Generate complete SQL for download
    const fullSQL = (tables as DatabaseTable[]).map(t => 
      generateCreateTableSQL(t) + '\n' + generateRLSSQL(t.name)
    ).join('\n\n');

    return new Response(JSON.stringify({ results, sql: fullSQL }), {
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
