

## Problem

Projects are stored in localStorage under a single key (`backendforge_projects`), so every user on the same browser sees the same projects. When switching accounts, the projects persist across all logins.

## Solution

Make the localStorage key user-specific by incorporating the authenticated user's ID.

### Changes to `src/context/ProjectContext.tsx`

1. Import and use `useAuth` from AuthContext to get the current user ID
2. Change the storage key from `backendforge_projects` to `backendforge_projects_{userId}`
3. Reset projects state when the user changes (login/logout/switch account)
4. Only read/write localStorage when a user is authenticated

### Changes to `src/App.tsx`

Move `ProjectProvider` inside `BrowserRouter` so it's nested under `AuthProvider` (it already is, but ensure proper ordering so `useAuth` works inside `ProjectProvider`).

### Implementation Detail

```typescript
const STORAGE_KEY_PREFIX = 'backendforge_projects_';

// Inside ProjectProvider:
const { user } = useAuth();
const userId = user?.id;

// Derive storage key from user
const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;

// Load projects when user changes
useEffect(() => {
  if (!storageKey) { setProjects([]); return; }
  const stored = localStorage.getItem(storageKey);
  setProjects(stored ? JSON.parse(stored) : []);
}, [storageKey]);

// Save projects when they change (only if logged in)
useEffect(() => {
  if (storageKey) localStorage.setItem(storageKey, JSON.stringify(projects));
}, [projects, storageKey]);
```

This ensures each user sees only their own projects, and switching accounts loads the correct project list.

