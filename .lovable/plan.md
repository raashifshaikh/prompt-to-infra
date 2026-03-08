

# BackendForge — Real Integrations & Repo Analysis Plan

## What We're Building

Transform BackendForge from mock-based to real functionality: direct Supabase/Firebase provisioning, Docker file generation, Fly.io deployment, a post-generation tutorial, and GitHub/file-upload repo analysis.

---

## 1. Real Supabase Integration

**Edge function: `apply-supabase`**
- User provides their Supabase project URL + service role key (stored securely per-project in context)
- Edge function uses Supabase Management API or direct PostgreSQL REST calls to:
  - Create tables from generated schema
  - Apply RLS policies
  - Set up auth providers
- Returns real success/error from the target Supabase project

**UI**: On the project view Deploy tab, add a "Connect Your Supabase" form (URL + service role key inputs). After connection, "Apply Schema" button executes real migrations.

## 2. Real Firebase Integration

**Edge function: `apply-firebase`**
- User provides Firebase project ID + service account JSON
- Edge function calls Firebase Admin REST API to:
  - Generate Firestore security rules
  - Create suggested collection structure (as a downloadable config)
- Since Firestore doesn't support programmatic collection creation the same way, we generate `firestore.rules` and `firestore.indexes.json` files for download

**UI**: Similar connection form on Deploy tab for Firebase credentials. Generates downloadable config files + option to apply rules via API.

## 3. Docker Integration

**Enhanced AI generation**: Update the `generate-backend` edge function system prompt to also output:
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`

**UI**: New "Docker" tab in ProjectView showing generated Docker files with copy/download buttons.

## 4. Real Fly.io Deployment

**Edge function: `deploy-flyio`**
- Uses the existing `FLY_API_KEY` secret
- Calls Fly.io Machines API to:
  - Create a new app
  - Deploy a Docker-based machine with the generated backend
- Returns real deployment URL and status

**UI**: Deploy tab gets a "Deploy to Fly.io" button with real status updates and a link to the live deployment.

## 5. Post-Generation Tutorial

**New component: `IntegrationTutorial`**
- Shown after backend generation completes (new tab or modal)
- Step-by-step guide with code snippets showing how to:
  - Install the relevant SDK (Supabase JS, Firebase SDK, etc.)
  - Initialize the client
  - Connect to generated tables/collections
  - Make API calls to generated routes
- Code snippets are dynamic based on the generated schema and backend type
- Copy buttons for each code block

## 6. GitHub Repo & File Upload Analysis

**Edge function: `analyze-repo`**
- Accepts either a public GitHub URL or uploaded file contents
- For GitHub: fetches repo structure via GitHub API (public repos, no auth needed)
- Sends project structure + key files (package.json, existing schemas, route files) to Groq
- AI analyzes the frontend and suggests a matching backend

**UI changes**:
- New page `/import` or section on Create Backend page
- GitHub URL input field
- File upload zone (accepts .zip or individual files up to 20MB)
- "Analyze & Generate Backend" button
- Shows detected tech stack, suggested tables, and routes before generation

## 7. Remove All Mock Data

- Replace mock `handleApply` and `handleDeploy` in ProjectView with real edge function calls
- Update `backend-actions` edge function to route to real integration functions
- Project status updates reflect real deployment state
- Logs tab shows real edge function logs (fetched from Supabase)

## 8. Updated Project Type

```typescript
interface Project {
  // ... existing fields
  result: GenerationResult | null;
  dockerFiles?: { dockerfile: string; compose: string; envExample: string };
  supabaseConfig?: { url: string; connected: boolean };
  firebaseConfig?: { projectId: string; connected: boolean };
  flyDeployment?: { appName: string; url: string; status: string };
  repoSource?: { type: 'github' | 'upload'; url?: string };
}
```

## 9. Updated Generation Result

Extend `GenerationResult` to include:
- `dockerfile`: string
- `dockerCompose`: string
- `envTemplate`: string
- `integrationGuide`: tutorial steps array

## New Edge Functions Summary

| Function | Purpose |
|----------|---------|
| `apply-supabase` | Create tables/RLS in user's Supabase project |
| `apply-firebase` | Generate and optionally apply Firebase configs |
| `deploy-flyio` | Real Fly.io deployment via Machines API |
| `analyze-repo` | Analyze GitHub repo or uploaded files |

## Navigation Updates

- Add "Import Project" to sidebar
- Add Docker tab to ProjectView
- Add Tutorial tab/section to ProjectView

## Implementation Order

1. Update types and generation prompt (Docker files, tutorial content)
2. Build `analyze-repo` edge function + import UI
3. Build `apply-supabase` edge function + connection UI
4. Build `apply-firebase` edge function + connection UI  
5. Build `deploy-flyio` edge function + deploy UI
6. Build tutorial component
7. Remove all mock handlers, wire everything to real functions
8. Test end-to-end

