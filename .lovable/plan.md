

## Problem

The user wants three major upgrades:

1. **Conversational AI planning flow** — Instead of just a prompt box, the system should chat with users, understand their requirements, plan the schema, and then execute. Like Lovable but for databases.
2. **AI-generated product images** — Integrate Puter.js `txt2img()` to auto-generate placeholder images for products during schema creation.
3. **Handle extreme complexity** — Banking systems, healthcare, etc. should work flawlessly with proper domain patterns (transactions, ledgers, audit trails, compliance tables).

## Plan

### 1. Conversational Chat Interface (New Page: `/chat`)

**New file:** `src/pages/ChatBackend.tsx`

Replace the simple prompt textarea with a full chat experience:

- **Chat UI**: Messages list (user + AI bubbles), input box at bottom, typing indicators
- **Multi-turn conversation**: The AI asks clarifying questions before generating:
  - "What kind of app?" → "Who are the users?" → "What are the main entities?" → "Do you need file uploads?" → "Auth requirements?"
- **Planning phase**: After gathering info, show a visual plan card summarizing tables, features, storage needs — user confirms before generation
- **Execution phase**: On confirm, call `generate-backend` with the enriched prompt from the conversation

**New edge function:** `supabase/functions/chat-backend/index.ts`
- Uses Groq API with a conversational system prompt
- Maintains conversation history (sent from client)
- Two modes: `chat` (ask questions, refine) and `generate` (produce final schema)
- The AI decides when it has enough info and returns a `ready_to_generate: true` flag with a summary

**Flow:**
```text
User: "I need a banking system"
AI: "What type? Retail banking, investment, or digital wallet?"
User: "Retail with accounts, transfers, loans"
AI: "Do you need multi-currency support? What about KYC/compliance?"
User: "Yes multi-currency, yes KYC"
AI: [Shows plan card with 15+ tables]
User: [Clicks "Generate"]
→ Schema generated with all tables
```

### 2. AI Image Generation with Puter.js

**File:** `src/pages/ProjectView.tsx` — Add "Generate Images" button per product/entity table

- Load Puter.js via `<script src="https://js.puter.com/v2/">` in `index.html`
- Add a `GenerateImagesButton` component that:
  - Reads table names from the generated schema
  - For product-like tables, offers "Generate sample images"
  - Calls `puter.ai.txt2img(prompt)` with contextual prompts (e.g., "Professional product photo of [product name]")
  - Displays generated images in a gallery
  - Provides download links or stores URLs in the schema output

**File:** `index.html` — Add Puter.js script tag

### 3. Enhanced Domain-Specific Prompts

**File:** `supabase/functions/generate-backend/index.ts` — Extend system prompt with domain patterns:

- **Banking**: accounts, transactions (double-entry ledger), transfers, loan_applications, loan_payments, interest_rates, KYC_documents, compliance_logs, currency_exchange_rates, beneficiaries, standing_orders, card_management
- **Healthcare**: patients, appointments, medical_records, prescriptions, lab_results, insurance_claims, billing
- **SaaS**: tenants, subscriptions, invoices, usage_metrics, feature_flags
- **Social**: posts, comments, likes, follows, messages, stories, reports

Add a "domain detection" instruction: the AI should identify the domain from the prompt and apply the relevant patterns automatically.

### 4. Update Routing & Navigation

**File:** `src/App.tsx` — Add route for `/chat`
**File:** `src/pages/Landing.tsx` — Change "Start Building" button to go to `/chat`
**File:** `src/components/AppSidebar.tsx` — Add "Chat" nav link

### 5. Config Updates

**File:** `supabase/config.toml` — Add `[functions.chat-backend]` with `verify_jwt = false`

### Files to create/modify:
- **Create:** `src/pages/ChatBackend.tsx` (conversational chat UI)
- **Create:** `supabase/functions/chat-backend/index.ts` (conversational AI edge function)
- **Modify:** `index.html` (add Puter.js script)
- **Modify:** `src/App.tsx` (add `/chat` route)
- **Modify:** `src/pages/Landing.tsx` (update CTA)
- **Modify:** `src/pages/ProjectView.tsx` (add image generation button)
- **Modify:** `src/components/AppSidebar.tsx` (add nav link)
- **Modify:** `supabase/functions/generate-backend/index.ts` (domain-specific patterns)
- **Modify:** `supabase/config.toml` (new function config)

