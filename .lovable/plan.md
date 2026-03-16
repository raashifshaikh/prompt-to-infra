

## Plan: Fix Auto-Fix, Persist Credentials, Clean Up UI

### Issues Identified

1. **Auto-Fix "AI did not return valid JSON"**: `supabase.functions.invoke()` doesn't handle SSE streaming responses properly — it tries to auto-parse the body. The `chat-backend` function returns an SSE stream (`text/event-stream`), so `invoke` either gets garbled data or an empty object. **Fix**: Use raw `fetch()` with manual SSE parsing (same pattern as `SchemaChat.tsx`).

2. **Credentials not persisted**: The Deploy tab's `projectUrl` and `dbPassword` are local `useState` — lost on tab switch or page refresh. Users must re-enter every time. **Fix**: Store `supabaseProjectUrl` and `supabaseDbPassword` on the `Project` type and persist in localStorage via `ProjectContext`.

3. **Tab bar cluttered on mobile (393px)**: 11 tabs overflow and wrap awkwardly. **Fix**: Use `ScrollArea` horizontal scroll on the `TabsList` so tabs are swipeable.

### Changes

#### 1. `src/components/SecurityAuditPanel.tsx` — Fix Auto-Fix
- Replace `supabase.functions.invoke('chat-backend', ...)` with direct `fetch()` to the edge function URL
- Use the same SSE line-by-line parsing pattern used in `SchemaChat.tsx`
- Accumulate full response text, then extract JSON
- Add a `stream: false` option in the request body so `chat-backend` returns a non-streaming response (simpler parsing)

Actually, the simplest fix: call `chat-backend` with `stream: false` — but looking at `chat-backend/index.ts`, it always passes `stream: true`. **Better approach**: use raw `fetch()` and parse the SSE stream, matching the proven pattern in `SchemaChat.tsx`.

#### 2. `src/components/DeployAndTutorial.tsx` — Persist Credentials
- Initialize `projectUrl` from `project.supabaseProjectUrl || ''`
- Initialize `dbPassword` from `project.supabaseDbPassword || ''`
- On successful apply or on blur/change, call `onUpdateProject({ supabaseProjectUrl, supabaseDbPassword })`
- Show a "Saved ✓" indicator when credentials are stored
- Add a "Save Credentials" button that persists without applying

#### 3. `src/types/project.ts` — Add credential fields
- Add `supabaseProjectUrl?: string` and `supabaseDbPassword?: string` to `Project` interface

#### 4. `src/pages/ProjectView.tsx` — Horizontal scroll tabs
- Wrap `TabsList` in a horizontal `ScrollArea` to prevent wrapping on mobile
- Group related tabs visually

#### 5. `supabase/functions/chat-backend/index.ts` — Support non-streaming mode
- When request body includes `stream: false`, pass `stream: false` to the AI gateway and return the JSON response directly (not SSE). This makes `SecurityAuditPanel` auto-fix simpler and more reliable.

### Technical Detail

**Auto-fix fetch pattern (SecurityAuditPanel.tsx):**
```typescript
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;

const resp = await fetch(CHAT_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  }),
});
const data = await resp.json();
const responseText = data.choices?.[0]?.message?.content || '';
```

**chat-backend non-streaming support:**
```typescript
const stream = mode === 'fix-schema' ? false : true;
// ... if !stream, return response.json() directly
```

### Files

| Action | File |
|--------|------|
| Edit | `supabase/functions/chat-backend/index.ts` (add non-streaming support) |
| Edit | `src/components/SecurityAuditPanel.tsx` (fix auto-fix with fetch + non-streaming) |
| Edit | `src/components/DeployAndTutorial.tsx` (persist credentials, show "Saved") |
| Edit | `src/types/project.ts` (add credential fields) |
| Edit | `src/pages/ProjectView.tsx` (horizontal scroll tabs) |

