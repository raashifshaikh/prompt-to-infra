import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, action, refreshToken } = await req.json();

    const clientId = Deno.env.get("SUPABASE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("SUPABASE_OAUTH_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("OAuth client credentials not configured");
    }

    let body: URLSearchParams;

    if (action === "refresh" && refreshToken) {
      body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
    } else if (code && redirectUri) {
      body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });
    } else {
      throw new Error("Missing required parameters: code + redirectUri or action=refresh + refreshToken");
    }

    const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    return new Response(JSON.stringify(tokenData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
