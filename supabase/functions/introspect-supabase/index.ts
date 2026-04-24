import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  primary_key?: boolean;
  references?: string;
  on_delete?: string;
  unique?: boolean;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

function mapPgType(dataType: string, udtName: string): string {
  // Use udt_name when available for accuracy (e.g. "uuid", "int4", "text")
  const t = (udtName || dataType || '').toLowerCase();
  if (t === 'uuid') return 'uuid';
  if (t === 'int4' || t === 'integer') return 'integer';
  if (t === 'int8' || t === 'bigint') return 'bigint';
  if (t === 'int2' || t === 'smallint') return 'smallint';
  if (t === 'bool' || t === 'boolean') return 'boolean';
  if (t === 'text' || t.startsWith('varchar') || t === 'character varying') return 'text';
  if (t === 'timestamptz' || t === 'timestamp with time zone') return 'timestamptz';
  if (t === 'timestamp' || t === 'timestamp without time zone') return 'timestamp';
  if (t === 'date') return 'date';
  if (t === 'numeric' || t === 'decimal') return 'numeric';
  if (t === 'float8' || t === 'double precision') return 'double precision';
  if (t === 'float4' || t === 'real') return 'real';
  if (t === 'jsonb') return 'jsonb';
  if (t === 'json') return 'json';
  return dataType || 'text';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { dbUrl } = await req.json();
    if (!dbUrl) throw new Error('dbUrl is required');

    const client = new Client(dbUrl);
    await client.connect();

    try {
      // 1. Tables + columns
      const colsRes = await client.queryObject<{
        table_name: string;
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      // 2. Primary keys
      const pkRes = await client.queryObject<{ table_name: string; column_name: string }>(`
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      `);
      const pkSet = new Set(pkRes.rows.map(r => `${r.table_name}.${r.column_name}`));

      // 3. Foreign keys
      const fkRes = await client.queryObject<{
        table_name: string; column_name: string;
        foreign_table: string; foreign_column: string;
        on_delete: string;
      }>(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column,
          rc.delete_rule AS on_delete
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      `);
      const fkMap = new Map<string, { ref: string; onDelete: string }>();
      for (const f of fkRes.rows) {
        fkMap.set(`${f.table_name}.${f.column_name}`, {
          ref: `${f.foreign_table}(${f.foreign_column})`,
          onDelete: f.on_delete,
        });
      }

      // 4. Unique constraints
      const uqRes = await client.queryObject<{ table_name: string; column_name: string }>(`
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
      `);
      const uqSet = new Set(uqRes.rows.map(r => `${r.table_name}.${r.column_name}`));

      // 5. Enums
      const enumRes = await client.queryObject<{ enum_name: string; enum_value: string }>(`
        SELECT t.typname AS enum_name, e.enumlabel AS enum_value
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder
      `);
      const enumMap = new Map<string, string[]>();
      for (const e of enumRes.rows) {
        if (!enumMap.has(e.enum_name)) enumMap.set(e.enum_name, []);
        enumMap.get(e.enum_name)!.push(e.enum_value);
      }

      // 6. Indexes
      const idxRes = await client.queryObject<{
        table_name: string; index_name: string;
        column_name: string; is_unique: boolean;
      }>(`
        SELECT
          t.relname AS table_name,
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relkind = 'r' AND NOT ix.indisprimary
      `);

      // 7. Storage buckets
      let storageBuckets: any[] = [];
      try {
        const bRes = await client.queryObject<{ id: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }>(`
          SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
        `);
        storageBuckets = bRes.rows.map(b => ({
          name: b.id,
          public: b.public,
          maxFileSize: b.file_size_limit || undefined,
          allowedMimeTypes: b.allowed_mime_types || undefined,
        }));
      } catch { /* storage may not be accessible */ }

      // Assemble tables
      const tablesMap = new Map<string, TableInfo>();
      for (const c of colsRes.rows) {
        if (!tablesMap.has(c.table_name)) {
          tablesMap.set(c.table_name, { name: c.table_name, columns: [] });
        }
        const fk = fkMap.get(`${c.table_name}.${c.column_name}`);
        const col: ColumnInfo = {
          name: c.column_name,
          type: mapPgType(c.data_type, c.udt_name),
          nullable: c.is_nullable === 'YES',
          default: c.column_default || undefined,
          primary_key: pkSet.has(`${c.table_name}.${c.column_name}`),
          unique: uqSet.has(`${c.table_name}.${c.column_name}`),
          references: fk?.ref,
          on_delete: fk?.onDelete,
        };
        tablesMap.get(c.table_name)!.columns.push(col);
      }

      const tables = Array.from(tablesMap.values()).filter(
        t => !['user_roles', 'spatial_ref_sys'].includes(t.name)
      );

      const enums = Array.from(enumMap.entries())
        .filter(([name]) => name !== 'app_role')
        .map(([name, values]) => ({ name, values }));

      // Group indexes
      const idxGroups = new Map<string, { table: string; columns: string[]; unique: boolean }>();
      for (const i of idxRes.rows) {
        const key = `${i.table_name}.${i.index_name}`;
        if (!idxGroups.has(key)) {
          idxGroups.set(key, { table: i.table_name, columns: [], unique: i.is_unique });
        }
        idxGroups.get(key)!.columns.push(i.column_name);
      }
      const indexes = Array.from(idxGroups.values());

      const result = {
        tables,
        enums,
        indexes,
        storageBuckets,
        routes: [],
        auth: { enabled: true, providers: ['email'], roles: [] },
        features: ['Imported from existing Supabase project'],
      };

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('introspect-supabase error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});