import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, projectId } = await req.json();

    let result: Record<string, unknown>;

    switch (action) {
      case 'apply':
        result = { success: true, message: 'Changes applied successfully (mock)', appliedAt: new Date().toISOString() };
        break;
      case 'deploy':
        result = { success: true, message: 'Deployment initiated (mock)', deploymentId: crypto.randomUUID(), status: 'deploying' };
        break;
      case 'logs':
        result = {
          logs: [
            { timestamp: new Date().toISOString(), level: 'info', message: 'Application started' },
            { timestamp: new Date().toISOString(), level: 'info', message: 'Database connection established' },
            { timestamp: new Date().toISOString(), level: 'info', message: 'API routes loaded' },
          ],
        };
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('backend-actions error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
