

# BackendForge — Enhanced Flow & GitHub OAuth Plan

## Current State
The app has: landing page, dashboard, create backend page, import page (GitHub URL + file upload), project view with Schema/Routes/Features/Docker/Tutorial/Logs/Deploy tabs, and edge functions for generate-backend, analyze-repo, apply-supabase, apply-firebase, deploy-flyio.

## What's Changing

### 1. GitHub OAuth for Private Repos
**New edge function: `github-oauth`** handles the OAuth code exchange flow.
- Need two new secrets: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- Flow: User clicks "Connect GitHub" → redirects to GitHub authorize URL → callback with code → edge function exchanges code for access token → stored in memory/context for session
- The Import page gets a "Connect GitHub" button alongside the existing URL input
- Once connected, user can browse/search their repos and select one

### 2. Local Backend Option — Downloadable Project
When user selects "Local Database" backend type, after generation:
- New **"Download" tab** on ProjectView generates a complete backend project as downloadable files
- Edge function `generate-local-backend` (or enhance `generate-backend`) produces actual code: `server.js`, `routes/*.js`, `models/*.js`, `package.json`, `.env`, `README.md`
- Frontend bundles these into a ZIP for download using JSZip
- Shows terminal instructions: `npm install && npm run dev → http://localhost:3000`

### 3. Unified Flow Improvement
Enhance the **Import Project page** to be a proper wizard:
- Step 1: Connect repo (GitHub OAuth OR paste URL OR upload files)
- Step 2: AI analysis results shown (detected stack, entities, routes)
- Step 3: Choose backend type (Supabase / Firebase / Local / Cloud)
- Step 4: Generate → redirects to ProjectView

### 4. Post-Generation Environment Variables
Add an **"Environment"** section to the Tutorial tab showing:
- Generated `.env` values based on chosen backend type
- Copy-paste ready env block with `API_BASE_URL`, `SUPABASE_URL`, etc.
- Instructions to add these to the user's frontend project

### 5. Fix apply-supabase Edge Function
Current implementation calls non-existent endpoints (`/pg`, `/rest/v1/rpc/exec_sql`). Fix to:
- Generate SQL and return it for manual execution (primary path)
- Optionally use Supabase Management API if user provides their management API key
- Clear UX: show SQL, provide copy/download, link to Supabase SQL Editor

### 6. Deploy Tab — Show All 3 Options Always
Currently filtered by backendType. Instead, always show all three deployment paths:
- **Option A — Local**: Download backend project ZIP
- **Option B — Cloud (Fly.io)**: Deploy with one click
- **Option C — Supabase**: Connect and apply schema
- Each as a clear card with description

## New Secrets Needed
- `GITHUB_CLIENT_ID` — from GitHub OAuth App settings
- `GITHUB_CLIENT_SECRET` — from GitHub OAuth App settings

## New/Updated Files

| File | Change |
|------|--------|
| `supabase/functions/github-oauth/index.ts` | New — handle OAuth code exchange |
| `src/pages/ImportProject.tsx` | Major rewrite — wizard flow with GitHub OAuth |
| `src/components/DeployTab.tsx` | Show all 3 options as cards |
| `src/components/DownloadBackend.tsx` | New — generate & download ZIP |
| `supabase/functions/apply-supabase/index.ts` | Fix — return SQL only, remove broken endpoints |
| `supabase/functions/generate-backend/index.ts` | Enhance prompt to generate actual backend code for local option |
| `src/types/project.ts` | Add `githubToken`, `localBackendFiles` fields |
| `src/pages/ProjectView.tsx` | Add Download tab for local projects |
| `supabase/config.toml` | Add github-oauth function |

## Implementation Order
1. Add GitHub secrets (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
2. Create github-oauth edge function
3. Rewrite ImportProject with wizard flow + GitHub connect
4. Fix apply-supabase to return SQL cleanly
5. Build downloadable local backend (ZIP generation)
6. Update DeployTab to show all 3 options
7. Add env vars section to Tutorial tab
8. Deploy all edge functions

