

## Plan: Upgrade AI Analysis Pipeline + Apple-Polished Chat UI

### Problem
1. **analyze-repo** uses Groq/Llama which poorly understands repo structure — it only fetches a few hardcoded files and sends truncated data
2. **chat-backend** already uses Lovable AI (Gemini 2.5 Flash) but receives only a brief summary from the analysis, not the actual code
3. The Chat UI needs an Apple-level design refresh (frosted glass, smooth animations, refined typography)

### Solution

#### 1. Upgrade `analyze-repo` to use Lovable AI Gateway (Gemini)
- Switch from Groq/Llama to `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions`
- Use `LOVABLE_API_KEY` (already available) instead of `GROQ_API_KEY`
- Increase `MAX_PROJECT_INFO` from 12,000 to 30,000 chars (Gemini handles much larger contexts)
- Fetch MORE key files: also grab `README.md`, `src/pages/*`, `src/components/*`, `src/lib/*`, `src/hooks/*`, `src/types/*`, route files, config files
- Fetch up to 15 additional source files (not just the hardcoded 8) by scanning the tree for important patterns
- Improve the analysis prompt to be more thorough about understanding data models, API patterns, and existing integrations

#### 2. Pass Full Analysis Context to Chat AI
- In `ChatBackend.tsx`, when analyzing attachments, pass the **full raw file contents** (not just the summary) into the chat context so the conversational AI can reason about actual code
- Include file structure tree in the context message
- For uploaded files, include their full content (up to 3000 chars each) directly in the chat message

#### 3. Apple-Polished Chat UI Redesign
- **Frosted glass header** with backdrop blur matching the landing page
- **Refined message bubbles**: softer corners, subtle shadows, SF-style typography
- **Smooth animations**: framer-motion fade-in for messages, slide-up for attachment panel
- **Premium empty state**: larger, more spacious layout with gradient accents
- **Mobile optimization**: full-width bubbles, bottom-safe input area, compact attachment panel
- **Typing indicator**: pulse animation instead of bouncing dots
- **Plan card**: glassmorphic card with subtle border glow

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/analyze-repo/index.ts` | Switch to Lovable AI Gateway, fetch more files, better prompt, larger context window |
| `src/pages/ChatBackend.tsx` | Pass richer context to chat, Apple-style UI redesign with framer-motion |

### Technical Details

**analyze-repo changes:**
- Replace `https://api.groq.com/openai/v1/chat/completions` with `https://ai.gateway.lovable.dev/v1/chat/completions`
- Replace `GROQ_API_KEY` with `LOVABLE_API_KEY`
- Replace model `llama-3.3-70b-versatile` with `google/gemini-2.5-flash`
- Expand key files list to dynamically discover important files from the tree (pages, components, types, hooks, configs)
- Increase per-file content limit from 2000 to 4000 chars
- Increase MAX_PROJECT_INFO from 12000 to 30000

**ChatBackend UI changes:**
- Add `framer-motion` animations (already installed) for message entrance
- Frosted glass header matching landing page style
- Refined color palette using existing Tailwind theme tokens
- Mobile-first responsive layout with safe areas

