import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, projectId, serviceName, projectName } = await req.json();
    const RAILWAY_API_TOKEN = Deno.env.get('RAILWAY_API_TOKEN');

    if (!RAILWAY_API_TOKEN) {
      throw new Error('RAILWAY_API_TOKEN is not configured');
    }

    const railwayFetch = async (query: string, variables: Record<string, any> = {}) => {
      const res = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      const data = await res.json();
      if (data.errors) {
        throw new Error(data.errors.map((e: any) => e.message).join(', '));
      }
      return data.data;
    };

    if (action === 'create-project') {
      const name = (projectName || 'backendforge-app').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);

      const data = await railwayFetch(`
        mutation($name: String!) {
          projectCreate(input: { name: $name }) {
            id
            name
          }
        }
      `, { name });

      const project = data.projectCreate;

      return new Response(JSON.stringify({
        success: true,
        projectId: project.id,
        projectName: project.name,
        url: `https://railway.app/project/${project.id}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add-database') {
      if (!projectId) throw new Error('projectId is required');

      // Add a Postgres plugin to the project
      const data = await railwayFetch(`
        mutation($projectId: String!) {
          pluginCreate(input: { projectId: $projectId, name: "postgresql" }) {
            id
            name
          }
        }
      `, { projectId });

      return new Response(JSON.stringify({
        success: true,
        plugin: data.pluginCreate,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deploy-service') {
      if (!projectId) throw new Error('projectId is required');

      // Create a service with a Docker image
      const name = serviceName || 'api-server';
      const data = await railwayFetch(`
        mutation($projectId: String!, $name: String!) {
          serviceCreate(input: { projectId: $projectId, name: $name, source: { image: "nginx:alpine" } }) {
            id
            name
          }
        }
      `, { projectId, name });

      return new Response(JSON.stringify({
        success: true,
        service: data.serviceCreate,
        url: `https://railway.app/project/${projectId}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      if (!projectId) throw new Error('projectId is required');

      const data = await railwayFetch(`
        query($projectId: String!) {
          project(id: $projectId) {
            id
            name
            services {
              edges {
                node {
                  id
                  name
                  deployments(first: 1) {
                    edges {
                      node {
                        id
                        status
                        createdAt
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `, { projectId });

      return new Response(JSON.stringify({
        success: true,
        project: data.project,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Unknown action. Use: create-project, add-database, deploy-service, status');
  } catch (e) {
    console.error('deploy-railway error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
