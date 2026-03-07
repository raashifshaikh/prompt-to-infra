

# BackendForge — Implementation Plan

## Overview
A modern developer tool that lets users describe backends in plain English and generates infrastructure configs using AI (Groq). Dark theme, clean dashboard layout.

## Pages & Navigation

### 1. Landing Page (`/`)
- Dark, modern hero section with product title "BackendForge" and tagline
- "Start Building" CTA button → navigates to Dashboard
- Feature highlight cards: AI Backend Generation, Supabase Setup, Firebase Setup, Local DB Setup, Cloud Deployment

### 2. Dashboard (`/dashboard`)
- Sidebar navigation (collapsible) with links: Projects, Create New, Settings
- Main area shows list of user projects as cards (stored in localStorage for now)
- Each card shows project name, backend type, creation date
- "Create New Backend" button

### 3. Create Backend (`/create`)
- Dropdown to select backend type: Supabase, Firebase, Local Database, Cloud Database
- Large prompt textarea input
- Example prompts shown below (e.g., "Create a blog with auth, posts table, and comments")
- "Generate Backend" button → calls Groq via edge function → navigates to result page

### 4. Generation Result (`/project/:id`)
- Tabbed view: Schema, API Routes, Logs, Deploy
- **Schema tab**: Generated database tables displayed as cards/code blocks
- **API Routes tab**: List of generated endpoints
- **Logs tab**: Placeholder log viewer
- **Deploy tab**: Deploy button (mock), status indicator
- Action buttons: Apply Changes, Edit Prompt, Deploy

## Backend (Supabase Edge Functions)

### Edge Function: `generate-backend`
- Receives prompt + backend type
- Calls Groq API (using stored `GROQ_API_KEY` secret) with a system prompt that instructs the model to return structured JSON (tables, routes, auth requirements, features)
- Returns the structured generation result

### Edge Function: `backend-actions`
- Handles mock endpoints: apply changes, deploy, get project, get logs
- Returns mock data for now, structured for future real integrations

## AI Integration
- Groq API key stored as a Supabase secret
- System prompt instructs the LLM to output structured JSON with: database tables, API routes, auth requirements, detected features
- Uses tool calling / structured output format for reliable JSON

## State Management
- React context for current project state
- localStorage for persisting project list (no database needed yet)
- React Query for edge function calls

## Design
- Dark theme throughout (Tailwind dark mode)
- Card-based layouts, clean sidebar
- Monospace fonts for code/schema display
- Responsive design
- Professional developer-tool aesthetic with subtle accent colors

