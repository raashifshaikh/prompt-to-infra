

## Plan: AI Avatar Generation on Signup + Profile Page + DB Manager Integration

### Overview
Three features: (1) auto-generate a unique avatar for each user on signup using the existing `generate-image` edge function, (2) create a dedicated Profile page where users can edit their display name, username, and avatar, (3) make the DB Manager more accessible from the profile/settings area.

### 1. Auto-Generate Avatar on Signup

**New edge function: `generate-avatar/index.ts`**
- Triggered from the client after signup completes (in AuthContext when a new user is detected)
- Calls `generate-image` edge function with a prompt like: "Generate a unique, colorful, abstract geometric avatar icon for a user profile, minimal style, solid background, square format"
- Uploads the base64 result to a new Supabase **storage bucket** called `avatars`
- Updates the user's `profiles.avatar_url` with the public URL

**Storage bucket migration:**
- Create `avatars` bucket (public) with appropriate policies

**AuthContext changes:**
- After detecting a new user signup (no existing avatar_url in profile), call the avatar generation flow
- Store the generated avatar URL in the profiles table

### 2. Profile Page (`src/pages/ProfilePage.tsx`)

- New route `/profile` added to App.tsx (protected)
- Displays user's avatar (large), display name, username, email (read-only from auth)
- Editable fields: display name, username
- "Regenerate Avatar" button that calls the avatar generation flow again
- Upload custom avatar option (file upload to `avatars` bucket)
- Save button updates `profiles` table via Supabase client
- Clean, minimal design consistent with the existing UI

### 3. Sidebar & Settings Updates

- Add "Profile" link to AppSidebar (with User icon)
- Settings page: add a card linking to Profile page and to DB Manager for quick access
- DB Manager link also added prominently in profile/settings for "edit your existing Supabase database easily"

### 4. DB Manager Accessibility

- Add a prominent "Manage Database" card on the Settings page
- Add DB Manager to the sidebar with better visibility (already exists, just ensure it's prominent)

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-avatar/index.ts` | New — calls generate-image, uploads to storage, returns URL |
| `src/pages/ProfilePage.tsx` | New — profile editing page |
| `src/App.tsx` | Add `/profile` route |
| `src/components/AppSidebar.tsx` | Add Profile nav item |
| `src/context/AuthContext.tsx` | Add avatar generation on new signup |
| `src/pages/SettingsPage.tsx` | Add profile card + DB Manager card |
| `supabase/config.toml` | Add generate-avatar function |
| Migration SQL | Create `avatars` storage bucket + policies |

### Technical Notes
- The existing `generate-image` edge function already works with Lovable AI gateway — the new `generate-avatar` function will reuse the same pattern but with a fixed avatar prompt and upload logic
- Avatar storage bucket will be public so avatar URLs can be used in `<img>` tags without auth
- Profile updates use the existing RLS policies on `profiles` table (users can update own profile)

