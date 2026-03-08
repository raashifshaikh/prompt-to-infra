

## Plan: Disable GitHub Login, Show "Temporarily Unavailable"

Simple change to `src/pages/AuthPage.tsx`:

- Disable the GitHub button and change its label to "GitHub — Temporarily Unavailable"
- Add a muted styling to make it clear it's unavailable
- Show a toast if someone clicks it anyway explaining it's temporarily down
- Email login remains fully functional as-is

**Single file change:** `src/pages/AuthPage.tsx` — update the GitHub button block (lines 105-112).

