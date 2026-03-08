

## Bytebase Improvement Plan

After reviewing the full codebase, here are the key areas to improve:

### 1. Mobile Responsiveness
- The sidebar doesn't collapse well on mobile; chat page needs full-screen mobile layout without sidebar chrome
- Landing page hero text is too large on small screens
- Input area on chat needs mobile-friendly padding

### 2. Dark Mode Polish
- Settings page has a nested `<p>` tag bug (line 8 in SettingsPage.tsx — double `<p>` wrapper)
- Chat user bubbles (`hsl(30,25%,93%)`) look good in light mode but the dark variant (`hsl(30,10%,20%)`) needs better contrast
- Plan card and attachment panel need dark mode border refinement

### 3. Chat UX Improvements
- **Auto-resize textarea**: The input textarea should grow dynamically as user types (currently has `max-h-[120px]` but no auto-grow logic)
- **New chat button**: No way to start a fresh conversation — add a "New Chat" button in the header
- **Chat history**: Store previous conversations in localStorage so users can revisit them
- **Scroll-to-bottom button**: When user scrolls up, show a floating button to jump back down

### 4. Dashboard Polish
- Empty state is bland — add an illustration or a more inviting CTA
- Project cards lack hover animations
- No search/filter for projects

### 5. Landing Page Fixes
- Footer says "© 2027" — should be 2026
- Nav links (Features, Docs, Pricing, Changelog) all route to `/about` — they should either scroll to sections or be distinct pages
- "Trusted by 2,000+ developers" is placeholder text with no social proof

### 6. Settings Page Bug Fix
- Line 8: `<p className="..."><p className="...">` — nested `<p>` tags cause hydration warning

---

### Recommended Priority Order

| Priority | Task | File(s) |
|----------|------|---------|
| 1 | Fix Settings page nested `<p>` bug | `SettingsPage.tsx` |
| 2 | Add textarea auto-resize + "New Chat" button | `ChatBackend.tsx` |
| 3 | Add chat history with localStorage | `ChatBackend.tsx` |
| 4 | Mobile-optimize chat (full-screen, no sidebar) | `ChatBackend.tsx`, `DashboardLayout.tsx` |
| 5 | Polish dark mode across chat and dashboard | `ChatBackend.tsx`, `Dashboard.tsx` |
| 6 | Fix landing page nav links and footer year | `Landing.tsx` |
| 7 | Add project search/filter to dashboard | `Dashboard.tsx` |

