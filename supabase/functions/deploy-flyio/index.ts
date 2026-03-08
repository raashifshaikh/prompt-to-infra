import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLY_API_URL = 'https://api.machines.dev/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, appName, dockerfile, projectName } = await req.json();
    const FLY_API_KEY = Deno.env.get('FLY_API_KEY');

    if (!FLY_API_KEY) {
      throw new Error('FLY_API_KEY is not configured');
    }

    const flyHeaders = {
      'Authorization': `Bearer ${FLY_API_KEY}`,
      'Content-Type': 'application/json',
    };

    if (action === 'create-app') {
      // Create a new Fly.io app
      const sanitizedName = `bf-${(projectName || 'app').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30)}-${Date.now().toString(36)}`;
      
      const createRes = await fetch(`${FLY_API_URL}/apps`, {
        method: 'POST',
        headers: flyHeaders,
        body: JSON.stringify({
          app_name: sanitizedName,
          org_slug: 'personal',
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('Fly create app error:', createRes.status, errText);
        throw new Error(`Failed to create Fly app: ${createRes.status} - ${errText}`);
      }

      const appData = await createRes.json();

      return new Response(JSON.stringify({
        success: true,
        appName: sanitizedName,
        status: 'created',
        url: `https://${sanitizedName}.fly.dev`,
        details: appData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deploy') {
      if (!appName) throw new Error('appName is required for deployment');

      // Create a machine in the app
      const machineRes = await fetch(`${FLY_API_URL}/apps/${appName}/machines`, {
        method: 'POST',
        headers: flyHeaders,
        body: JSON.stringify({
          config: {
            image: 'nginx:alpine', // Default image; real deploy would use built Docker image
            guest: {
              cpu_kind: 'shared',
              cpus: 1,
              memory_mb: 256,
            },
            services: [
              {
                ports: [
                  { port: 443, handlers: ['tls', 'http'] },
                  { port: 80, handlers: ['http'] },
                ],
                protocol: 'tcp',
                internal_port: 80,
              },
            ],
          },
        }),
      });

      if (!machineRes.ok) {
        const errText = await machineRes.text();
        console.error('Fly deploy error:', machineRes.status, errText);
        throw new Error(`Failed to deploy: ${machineRes.status} - ${errText}`);
      }

      const machineData = await machineRes.json();

      return new Response(JSON.stringify({
        success: true,
        appName,
        status: 'running',
        url: `https://${appName}.fly.dev`,
        machineId: machineData.id,
        details: machineData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      if (!appName) throw new Error('appName is required');

      const statusRes = await fetch(`${FLY_API_URL}/apps/${appName}/machines`, {
        headers: flyHeaders,
      });

      if (!statusRes.ok) {
        throw new Error(`Failed to get status: ${statusRes.status}`);
      }

      const machines = await statusRes.json();

      return new Response(JSON.stringify({
        appName,
        machines: machines.map((m: any) => ({
          id: m.id,
          state: m.state,
          region: m.region,
          created_at: m.created_at,
        })),
        url: `https://${appName}.fly.dev`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Unknown action. Use: create-app, deploy, status');
  } catch (e) {
    console.error('deploy-flyio error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
