import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.supabase.com/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, projectRef, sql } = await req.json();

    if (!accessToken) {
      throw new Error("Missing accessToken");
    }

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let result: any;

    switch (action) {
      case "list-projects": {
        const res = await fetch(`${API_BASE}/projects`, {
          headers: authHeaders,
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Failed to list projects: ${err}`);
        }
        result = await res.json();
        break;
      }

      case "get-project": {
        if (!projectRef) throw new Error("Missing projectRef");
        const res = await fetch(`${API_BASE}/projects/${projectRef}`, {
          headers: authHeaders,
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Failed to get project: ${err}`);
        }
        result = await res.json();
        break;
      }

      case "get-api-keys": {
        if (!projectRef) throw new Error("Missing projectRef");
        const res = await fetch(`${API_BASE}/projects/${projectRef}/api-keys`, {
          headers: authHeaders,
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Failed to get API keys: ${err}`);
        }
        result = await res.json();
        break;
      }

      case "run-sql": {
        if (!projectRef) throw new Error("Missing projectRef");
        if (!sql) throw new Error("Missing sql");
        const res = await fetch(
          `${API_BASE}/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ query: sql }),
          }
        );
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`SQL execution failed: ${err}`);
        }
        result = await res.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
