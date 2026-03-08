import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are an expert backend architect AI. Given a user's description and target platform, generate a production-grade structured JSON response.

CRITICAL RULES for schema design:
1. **Every table MUST have**: "id" (uuid, primary key), "created_at" (timestamptz, default now()), "updated_at" (timestamptz, default now())
2. **Foreign keys**: Always include "references" field with format "table_name(column)" and "on_delete" behavior (CASCADE, SET NULL, or RESTRICT)
3. **Junction tables**: For many-to-many relationships, create dedicated junction tables (e.g., "user_roles", "post_tags") with composite references
4. **Enums**: Use custom enum types for status fields, role types, etc. Define them in the "enums" array
5. **Indexes**: Add indexes for foreign keys, frequently filtered columns, and unique constraints. Define in "indexes" array
6. **Soft deletes**: Add "deleted_at" (timestamptz, nullable) for user-facing content tables
7. **Audit columns**: Add "created_by" and "updated_by" (uuid, nullable, references users) for content tables
8. **Unique constraints**: Mark columns as "unique": true where appropriate (emails, slugs, usernames)
9. **Proper types**: Use uuid for IDs, text for strings, timestamptz for dates, integer/bigint for counts, numeric(10,2) for money, boolean for flags, jsonb for flexible data

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "projectName": "short descriptive name",
  "result": {
    "enums": [
      { "name": "order_status", "values": ["pending", "processing", "shipped", "delivered", "cancelled"] }
    ],
    "tables": [
      {
        "name": "table_name",
        "columns": [
          { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()", "primary_key": true, "unique": false },
          { "name": "user_id", "type": "uuid", "nullable": false, "default": null, "primary_key": false, "unique": false, "references": "users(id)", "on_delete": "CASCADE" },
          { "name": "status", "type": "order_status", "nullable": false, "default": "'pending'", "primary_key": false, "unique": false },
          { "name": "email", "type": "text", "nullable": false, "default": null, "primary_key": false, "unique": true },
          { "name": "created_at", "type": "timestamptz", "nullable": false, "default": "now()", "primary_key": false, "unique": false },
          { "name": "updated_at", "type": "timestamptz", "nullable": false, "default": "now()", "primary_key": false, "unique": false },
          { "name": "deleted_at", "type": "timestamptz", "nullable": true, "default": null, "primary_key": false, "unique": false }
        ]
      }
    ],
    "indexes": [
      { "table": "orders", "columns": ["user_id"], "unique": false },
      { "table": "orders", "columns": ["status", "created_at"], "unique": false },
      { "table": "users", "columns": ["email"], "unique": true }
    ],
    "routes": [
      { "method": "GET", "path": "/api/resource", "description": "List all resources", "auth_required": false }
    ],
    "auth": {
      "enabled": true,
      "providers": ["email", "google"],
      "roles": ["admin", "user"]
    },
    "features": ["CRUD operations", "Authentication", "File storage"],
    "dockerfile": "FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm ci\\nCOPY . .\\nEXPOSE 3000\\nCMD [\\"npm\\", \\"start\\"]",
    "dockerCompose": "version: '3.8'\\nservices:\\n  app:\\n    build: .\\n    ports:\\n      - '3000:3000'\\n    env_file: .env\\n    depends_on:\\n      - db\\n  db:\\n    image: postgres:16-alpine\\n    environment:\\n      POSTGRES_DB: app\\n      POSTGRES_USER: postgres\\n      POSTGRES_PASSWORD: postgres\\n    volumes:\\n      - pgdata:/var/lib/postgresql/data\\nvolumes:\\n  pgdata:",
    "envTemplate": "DATABASE_URL=postgresql://postgres:postgres@db:5432/app\\nJWT_SECRET=your-secret-here\\nPORT=3000",
    "integrationGuide": [
      {
        "title": "Install SDK",
        "description": "Install the client SDK for your backend",
        "code": "npm install @supabase/supabase-js",
        "language": "bash"
      },
      {
        "title": "Initialize Client",
        "description": "Set up the client connection in your frontend",
        "code": "import { createClient } from '@supabase/supabase-js';\\nconst supabase = createClient('YOUR_URL', 'YOUR_ANON_KEY');",
        "language": "typescript"
      },
      {
        "title": "Fetch Data",
        "description": "Query your generated tables",
        "code": "const { data, error } = await supabase.from('table_name').select('*');",
        "language": "typescript"
      }
    ]
  }
}

DESIGN PATTERNS TO FOLLOW:
- Users table should always be the root entity. Other tables reference it.
- Order tables correctly: parent tables before child tables in the array.
- For e-commerce: users → categories → products → orders → order_items → reviews
- For social: users → posts → comments → likes → follows (junction)
- For SaaS: users → organizations → org_members (junction) → projects → tasks
- Always create at least one junction table for role assignments or M:M relationships
- Generate 3-5 meaningful indexes per schema
- Generate at least 2-3 enums for status/type fields
- Routes should cover full CRUD + list with filters for every main entity

For Supabase backends, the integration guide should use @supabase/supabase-js.
For Firebase backends, use the Firebase JS SDK.
For local/cloud backends, show generic REST API usage with fetch.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, backendType } = await req.json();
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const userMessage = `Backend type: ${backendType}\n\nUser request: ${prompt}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Groq response');
    }

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-backend error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
