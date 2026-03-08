import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are a backend architecture AI. Given a user's description of what backend they need and the target platform, generate a structured JSON response.

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "projectName": "short descriptive name",
  "result": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()", "primary_key": true },
          { "name": "column_name", "type": "text", "nullable": true, "default": null, "primary_key": false }
        ]
      }
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

Generate realistic, well-designed database schemas with proper relationships, types, and defaults. Create RESTful API routes that cover all CRUD operations. Detect and list all features the user's backend needs.

IMPORTANT: Always generate a proper Dockerfile, docker-compose.yml, and .env.example tailored to the backend type. Also generate an integrationGuide array with 3-5 tutorial steps showing how to connect a frontend to this backend, with real code snippets specific to the chosen platform (Supabase, Firebase, etc.).

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
        max_tokens: 8192,
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
