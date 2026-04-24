

## Plan: Run the Full Flow Test Suite

### What this does

Execute the existing Deno test file (`supabase/functions/security-pentest/index.test.ts`) against the live test Supabase project (`eshpnklgpbdbnoqxnerk`) plus add three missing end-to-end checks, then write a fresh `FULL_FLOW_TEST_REPORT.md` capturing actual results — pass/fail, scores, table counts, and any errors.

### Tests that will run

**Already in the test file (will execute):**
1. `chat-backend` streaming — returns SSE
2. `chat-backend` non-streaming — returns parseable JSON (auto-fix path)
3. `security-pentest` — rejects empty credentials
4. `security-pentest` — runs against test DB, returns score + grade + report
5. `supabase-manage` — lists tables via run-sql
6. `supabase-manage` — rejects missing access token
7. `apply-supabase` — rejects without dbUrl
8. `apply-supabase` — rejects empty tables
9. `generate-backend` — produces a valid blog schema

**New tests to add to the same file:**
10. `introspect-supabase` — pulls live schema from test DB and returns tables/columns/FKs
11. `apply-supabase` end-to-end — deploys a small `__flowtest_*` schema to the test DB, asserts tables created, then drops them
12. `security-pentest` after deploy — re-runs pentest on the freshly deployed schema and asserts score ≥ 80 (validates Fix 1 from prior plan)

### How it runs

- Use `supabase--test_edge_functions` to execute all tests in one shot with a 300s timeout
- Use `supabase--read_query` and `supabase--curl_edge_functions` for any spot-checks that fail
- Capture stdout (scores, table lists, timings) into the report

### Files

| Action | File |
|--------|------|
| Edit | `supabase/functions/security-pentest/index.test.ts` (add tests 10–12) |
| Replace | `FULL_FLOW_TEST_REPORT.md` (real results, not the previous narrative version) |

### Report contents

The new `FULL_FLOW_TEST_REPORT.md` will include:
- Test run timestamp + Deno version
- Per-test pass/fail with duration
- PenTest score before vs after deploy (Fix 1 validation)
- List of tables introspected from the test DB
- Any failures with stack traces and the edge-function logs that explain them
- Concrete next-step recommendations for any failing test

### Out of scope

No app code changes — this is verification only. If a test reveals a regression, I'll surface it in the report and propose a follow-up fix in a separate plan rather than silently patching.

