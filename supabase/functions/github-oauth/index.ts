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
    const { code, action } = await req.json();
    const GITHUB_CLIENT_ID = Deno.env.get('GITHUB_CLIENT_ID');
    const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET');

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth credentials not configured');
    }

    if (action === 'get-client-id') {
      return new Response(JSON.stringify({ clientId: GITHUB_CLIENT_ID }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange-code') {
      if (!code) throw new Error('Authorization code is required');

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      // Fetch user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      const user = await userRes.json();

      // Fetch user repos
      const reposRes = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      const repos = await reposRes.json();

      return new Response(JSON.stringify({
        accessToken: tokenData.access_token,
        user: { login: user.login, avatar: user.avatar_url, name: user.name },
        repos: repos.map((r: any) => ({
          name: r.full_name,
          url: r.html_url,
          description: r.description,
          language: r.language,
          private: r.private,
          updatedAt: r.updated_at,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-repos') {
      const { accessToken, page = 1 } = await req.json();
      if (!accessToken) throw new Error('Access token required');

      const reposRes = await fetch(`https://api.github.com/user/repos?per_page=30&sort=updated&page=${page}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const repos = await reposRes.json();

      return new Response(JSON.stringify({
        repos: repos.map((r: any) => ({
          name: r.full_name,
          url: r.html_url,
          description: r.description,
          language: r.language,
          private: r.private,
          updatedAt: r.updated_at,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error('github-oauth error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
