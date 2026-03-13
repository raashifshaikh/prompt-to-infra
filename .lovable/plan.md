

## Plan: Bytebase MVP — Missing Features Implementation

### What Already Exists
The app already has ~70% of what's described: AI generation, project dashboard, schema viewer, ER diagrams, routes viewer, deploy guides, GitHub integration, chat-based AI architect, database manager, and auth.

### What's Missing (Prioritized for MVP)

#### 1. API Playground (new page tab in ProjectView)
Add a "Playground" tab to ProjectView where users can test API endpoints:
- Base URL input field
- Dropdown to select from generated routes or enter custom endpoint
- Method selector (GET/POST/PUT/DELETE)
- Headers editor (key-value pairs)
- Request body JSON editor (textarea)
- Send button → executes fetch → displays response status code + JSON body
- Pre-populate routes from the project's generated routes list

**File:** `src/components/ApiPlayground.tsx` (new)
**Edit:** `src/pages/ProjectView.tsx` — add Playground tab

#### 2. Swagger/API Docs Viewer (new tab in ProjectView)
Add a "Docs" tab that renders OpenAPI-style documentation from the generated routes:
- Auto-generate OpenAPI JSON from routes + schema
- Render interactive docs with expandable endpoint cards
- Show request/response schemas based on table columns
- Method badges, path, description, auth requirement, request body schema

**File:** `src/components/SwaggerDocs.tsx` (new)
**Edit:** `src/pages/ProjectView.tsx` — add Docs tab

#### 3. Full ZIP Download
Add a "Download Project" button that generates and downloads a complete ZIP:
- Uses JSZip library (needs to be added)
- Generates: Dockerfile, docker-compose.yml, .env.example, prisma/schema.prisma, src/routes/*, src/controllers/*, package.json, README.md
- All generated from the project's result data

**File:** `src/utils/generateProjectZip.ts` (new)
**Edit:** `src/pages/ProjectView.tsx` — add Download tab with button

#### 4. Environment Variables UI (new tab in ProjectView)
Add an "Env Vars" tab for managing environment variables per project:
- Add/edit/delete key-value pairs
- Mask values by default (show/hide toggle)
- Common keys suggestions (DATABASE_URL, JWT_SECRET, etc.)
- Stored in project data (localStorage per user)

**Edit:** `src/types/project.ts` — add `envVars` field to Project type
**File:** `src/components/EnvVarsManager.tsx` (new)
**Edit:** `src/pages/ProjectView.tsx` — add Env Vars tab

#### 5. Supabase Secrets Storage (store user's API keys in their own Supabase project)
Add ability for users to push secrets to their connected Supabase project via the Management API:
- UI in the Env Vars tab: "Push to Supabase" button
- Uses the existing `supabase-manage` edge function pattern
- Calls the Supabase Management API's secrets endpoint: `POST /v1/projects/{ref}/secrets`
- Requires the user's Supabase access token (already collected in deploy flow)

**Edit:** `supabase/functions/supabase-manage/index.ts` — add `set-secrets` action
**Edit:** `src/components/EnvVarsManager.tsx` — add "Push to Supabase" button

#### 6. Project Tab Reorganization
Update ProjectView tabs to match the spec:
- Schema | Routes | Docs | Playground | Env Vars | Download | ER Diagram

### Technical Notes

- **JSZip** dependency needed for ZIP download
- API Playground uses browser `fetch()` directly — CORS depends on the target server
- Swagger docs are client-side rendered from generated route/schema data (no server needed)
- Supabase secrets push uses existing Management API proxy pattern
- All new components are self-contained tabs within the existing ProjectView

### Files Changed/Created

| Action | File |
|--------|------|
| Create | `src/components/ApiPlayground.tsx` |
| Create | `src/components/SwaggerDocs.tsx` |
| Create | `src/components/EnvVarsManager.tsx` |
| Create | `src/utils/generateProjectZip.ts` |
| Edit | `src/pages/ProjectView.tsx` (add tabs) |
| Edit | `src/types/project.ts` (add envVars) |
| Edit | `supabase/functions/supabase-manage/index.ts` (add set-secrets) |
| Install | `jszip` package |

