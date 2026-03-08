

## Problem

The current UI is confusing. The Create Backend page mixes too many concerns: backend type selection, input mode tabs, GitHub OAuth, all on one page. The post-generation ProjectView has 7 tabs that overwhelm users. The flow should be dead simple:

1. Choose how to describe your backend (Prompt / GitHub / Upload)
2. Enter your input and generate
3. See results with clear output based on backend type chosen

## Simplified Flow

```text
Step 1: Create Page (cleaned up)
  ┌──────────────────────────────────┐
  │  How do you want to generate?    │
  │                                  │
  │  [Prompt] [GitHub] [Upload]      │
  │                                  │
  │  <input area based on choice>    │
  │                                  │
  │  Where do you want to deploy?    │
  │  ○ Supabase (provide DB URL)     │
  │  ○ Firebase (download files)     │
  │  ○ Local (download & self-host)  │
  │  ○ Cloud (coming soon)           │
  │                                  │
  │  [Generate Backend]              │
  └──────────────────────────────────┘

Step 2: Project Results (simplified)
  ┌──────────────────────────────────┐
  │  Project: My Blog Backend        │
  │                                  │
  │  Schema | API Routes | Files     │
  │                                  │
  │  ── Deploy Section ──            │
  │  Based on backend type:          │
  │  • Supabase: paste DB URL,       │
  │    apply schema                  │
  │  • Firebase: download rules +    │
  │    indexes, tutorial             │
  │  • Local: download Dockerfile,   │
  │    docker-compose, .env +        │
  │    personalized hosting tutorial │
  │  • Cloud: "Coming soon" badge    │
  └──────────────────────────────────┘
```

## Changes

### 1. Simplify `CreateBackend.tsx`
- Remove the separate "Backend Type" dropdown from the top
- Replace with clear deploy target cards below the input (radio-style selection with descriptions):
  - **Supabase** — "Connect your Supabase project and apply schema directly"
  - **Firebase** — "Download Firestore rules, indexes, and setup files"
  - **Local / Self-hosted** — "Get Docker files and a step-by-step hosting tutorial"
  - **Cloud Hosting** — "Coming soon" (disabled)
- Keep the 3 input mode tabs (Prompt / GitHub / Upload) but cleaner
- Remove the GitHub Connection card clutter — just show a small "Connect for private repos" link inline

### 2. Simplify `ProjectView.tsx`
- Reduce from 7 tabs to 3-4 max:
  - **Schema** — tables + API routes combined
  - **Files** — Docker files, Firebase config files, SQL migration (all downloadable files in one place)
  - **Deploy & Tutorial** — merged deploy actions + personalized hosting tutorial based on backend type
- Remove the Logs tab (just noise)
- Remove standalone Features tab (merge auth/features info into Schema view as a summary card)

### 3. Improve `DeployTab.tsx` → rename to `DeployAndTutorial`
- Show different content based on `backendType`:
  - **Supabase**: DB URL input + Apply Schema + generated SQL download
  - **Firebase**: Auto-show downloadable rules/indexes + tutorial steps for `firebase deploy`
  - **Local**: Show all Docker files + personalized tutorial: "How to host your backend" with step-by-step (install Docker, clone, docker-compose up, configure env vars, etc.)
  - **Cloud**: "Cloud hosting coming soon" message with Railway teaser
- Each section includes a clear, personalized tutorial generated from the AI result

### 4. Sidebar cleanup
- Remove "Import Project" link (merged into Create)
- Keep: Home, Projects, Create New, Settings, About

### 5. Remove `/import` route
- Delete ImportProject page and route since it's redundant

### Files to modify:
- `src/pages/CreateBackend.tsx` — simplified layout with deploy target cards
- `src/pages/ProjectView.tsx` — reduce tabs, merge content
- `src/components/DeployTab.tsx` — merge deploy + tutorial, type-aware content
- `src/components/AppSidebar.tsx` — remove Import Project
- `src/App.tsx` — remove `/import` route
- `src/pages/ImportProject.tsx` — delete

