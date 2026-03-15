

## Plan: AI-Powered Security Auto-Fix, Schema Chat, and Database Versioning

### Overview
Three major features: (1) After security audit, feed findings to AI to auto-fix the schema JSON, (2) A post-generation chat interface to iteratively refine the database, (3) Schema version history with instant rollback.

### Feature 1: AI Auto-Fix After Security Audit

**Current state**: SecurityAuditPanel shows findings with manual "fix" text suggestions. No automation.

**Change**: Add "Auto-Fix All Issues" button that sends audit findings to the AI (`chat-backend` edge function) with a specialized prompt. The AI returns a corrected `GenerationResult` JSON which replaces the current one.

**Files**:
- `src/components/SecurityAuditPanel.tsx` — Add "Auto-Fix with AI" button. After audit completes, serialize findings into a prompt, call `chat-backend` with a system instruction to return a corrected schema JSON. Parse the response and call `onFixApplied(updatedResult)` callback.
- `src/pages/ProjectView.tsx` — Pass `onFixApplied` handler to SecurityAuditPanel that updates the project's `result`.

### Feature 2: Schema Refinement Chat (Post-Generation)

**Current state**: Chat only exists at `/chat` for initial generation. Once generated, users can't iterate.

**Change**: Add a "Refine" tab in ProjectView with an inline chat. The chat sends the current schema as context so the AI can suggest and apply modifications. Each AI response can include a JSON block with updated tables/routes/etc.

**Files**:
- `src/components/SchemaChat.tsx` (new) — Inline chat component that:
  - Shows current schema context to AI automatically
  - Lets user ask things like "add soft deletes to all tables" or "add an audit_logs table"
  - When AI returns a JSON block with updated schema, shows a "Apply Changes" button
  - Applies changes by merging into the project's `result`
- `src/pages/ProjectView.tsx` — Add "Refine" tab with SchemaChat component

### Feature 3: Schema Version History & Rollback

**Current state**: No versioning. If schema gets broken, no recovery.

**Change**: Every time the project `result` is updated (generation, auto-fix, chat refinement), snapshot the previous