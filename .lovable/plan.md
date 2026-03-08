

# Plan: Supabase OAuth Integration for Direct Database Management

## Overview
Add Supabase OAuth so users can connect their Supabase account directly — no more pasting database URLs manually. The app will use the Supabase Management API to list projects, retrieve credentials, and execute SQL to create/edit tables automatically.

## How It Works

```text
User clicks "Connect Supabase"
        │
        ▼
Redirects to Supabase OAuth consent screen
        │
        ▼
User authorizes → redirected back with code
        │
        ▼
Edge function exchanges code for access_token
        │
        ▼
App can now: list projects, get API keys,
run SQL queries via Management API
```

## What We'll Build

### 1. Edge Function: `supabase-oauth` (token exchange)
- Exchanges the OAuth authorization code for access/refresh tokens
- Uses `SUPABASE_OAUTH_CLIENT_ID` and `SUPABASE_OAUTH_CLIENT_SECRET` secrets
- Endpoint: `POST /v1/oauth/token` on `api.supabase.com`

### 2. Edge Function: `supabase-manage` (Management API proxy)
- Accepts the user's access token and performs actions:
  - `list-projects` — GET `/v1/projects`
  - `get-project` — GET `/v1/projects/{ref}` (returns URL, anon key, etc.)
  - `run-sql` — POST `/v1/projects/{ref}/database/query` (execute CREATE TABLE, RLS, etc.)
- This replaces the need for direct Postgres connections (no more database password!)

### 3. New Page: `/connect-supabase` (or enhance Settings page)
- "Connect Supabase Account" button → OAuth flow
- After connecting, shows list of user's Supabase projects
- User picks a project → app stores the ref, URL, and anon key
- On the Deploy tab, "Apply Schema" now uses the Management API instead of requiring a database URL

### 4. Update DeployTab
- If user has a connected Supabase account + selected project, show a simplified "Apply Schema" button (no URL input needed)
- Falls back to manual database URL input if not connected

### 5. Store connection state
- `localStorage`: Supabase OAuth tokens + selected project ref
- Add `supabaseOAuth` field to Project type for per-project Supabase association

## Prerequisites (User Action Required)
The user needs to register a Supabase OAuth app:
1. Go to https://supabase.com/dashboard/account/integrations
2. Create an OAuth application
3. Set redirect URL to the app's callback
4. Provide the Client ID and Client Secret as edge function secrets

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/supabase-oauth/index.ts` | Create — OAuth token exchange |
| `supabase/functions/supabase-manage/index.ts` | Create — Management API proxy (list projects, run SQL) |
| `src/pages/ConnectSupabase.tsx` | Create — OAuth connect + project picker page |
| `src/components/DeployTab.tsx` | Modify — Add "one-click apply" when OAuth connected |
| `src/types/project.ts` | Modify — Add `supabaseOAuth` connection fields |
| `src/App.tsx` | Add `/connect-supabase` route |
| `src/components/AppSidebar.tsx` | Add nav item |
| `supabase/config.toml` | Add function configs |

## Secrets Needed
- `SUPABASE_OAUTH_CLIENT_ID` — from Supabase OAuth app registration
- `SUPABASE_OAUTH_CLIENT_SECRET` — from Supabase OAuth app registration

