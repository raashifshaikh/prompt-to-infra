

## Plan: Redesign Chat UI to Match Lovable-Style Interface

### Reference Analysis
The screenshot shows Lovable's chat interface with these key design traits:
- **Clean, minimal background** — no heavy gradients or glassmorphism
- **User messages**: light beige/cream bubble, right-aligned, no avatar
- **Assistant messages**: white card with subtle border, left-aligned, no avatar icon
- **"Thought for Xs"** collapsible thinking indicator
- **Collapsible action cards** like "Read `index.ts`" with description text
- **Bottom input**: rounded pill with "Ask Lovable..." placeholder, icon buttons (plus, ellipsis, chat mode, mic, stop)
- **Very clean spacing**, no clutter

### Changes to `src/pages/ChatBackend.tsx`

1. **Remove heavy glassmorphism/gradients** — use clean flat cards instead
2. **User messages**: cream/beige bubble (`bg-[hsl(30,30%,95%)]` in light, subtle dark variant), no user avatar, right-aligned
3. **Assistant messages**: plain white/card background, minimal border, no bot avatar icon — just the content
4. **Remove the Bot/User avatar circles** from message rows
5. **Simplify the header** — lighter, less prominent
6. **Redesign input area** to match Lovable style:
   - Rounded input container with placeholder "Ask AI Architect..."
   - Attach button (plus icon) on left
   - Send button on right
   - Bottom row of small icon buttons (optional)
7. **Simplify empty state** — cleaner, less busy, fewer suggestion pills
8. **Typing indicator** — show "Thinking..." text instead of bouncing dots
9. **Plan card** — keep functional but simplify styling (remove gradient top bar, use cleaner card)

### Files to Change

| File | Change |
|------|--------|
| `src/pages/ChatBackend.tsx` | Full UI redesign matching Lovable's minimal chat aesthetic |

