# Brief — Fodda App: first-touch prompts, Next Moves in chat, and question-log reliability

**From:** Piers (2026-08-22, from the "What People Ask Fodda" analysis)
**Owning repo:** Fodda App (`/Fodda`). No dedicated agent in the topology — run with Antigravity in this repo; `api-agent` may advise on the API contract.
**Execution handle:** `/build-from-brief briefs/brief_app_second_question_and_logging.md`
**Status:** ready to build. Three independent parts; ship in the order below.

---

## Context

The Questions-table analysis (2,858 rows, Feb–Aug 2026) found that for most app users the **suggested prompt is the only query they ever run** — eight static starters account for 133 runs and almost no second question. Second questions, when they happen, come from a live job (a brand/brief in hand), a brand lookup after a topic, or a drill-down on something the answer named. The MCP now ends every answer with a three-line "Next Moves" block built from a `next_moves` envelope; the app does not render it.

Separately: 33 April app signups logged only `[SESSION_START]`. From this repo's history that is a **logging hole, not bounces** — `POST /api/query/log` returned `ok: true` on Airtable failures until commit `3516331` (2026-07-02; "silent drops here masked broken query tracking for weeks"), and the April rows came from a build older than `main` (the frontend stopped sending `[SESSION_START]` on 2026-02-14). Logging works now; nothing alerts if it breaks again.

## What to build

### 1. First touch: ask for the job, and stop serving one static list

- **Replace the static welcome chips** (`shared/constants.ts` `SUGGESTED_QUESTIONS`, rendered in `frontend/components/ChatInterface.tsx` ~L492) with a two-part welcome:
  1. A single input above the chips: *"What are you working on? (a brand, a category, or an audience)"*. Submitting it sends the text as the first query with `promptSource: 'job_scoped'` and stores it on the session so later queries carry it as `context.userContext` (the API's Next Moves line 3 already uses it: "Want this cut to [brand] specifically?").
  2. Chips drawn **per graph from Airtable Graph List `exampleQueries`** (`server/services/promptSweep.ts` already fetches them) instead of the hard-coded five verticals. Show 4 chips: 2 from the user's selected graph, 2 from graphs the log shows people actually ask about next (Gen Z / health & longevity / F&B / sports — pick from `exampleQueries` of those graphs). `promptSource: 'welcome_catalog'`. Keep `'welcome_static'` only as a fallback when Airtable is unreachable.
- **Weekly sweep gate:** the existing `runPromptSweep` (cron) already tests prompts; extend it so any chip whose last sweep returned thin/empty coverage is dropped from rotation until it passes again. Log what was dropped.

### 2. Render Next Moves in the chat and log which line was taken

- `server/services/mcpChatService.ts` / `frontend/App.tsx` (~L860 `suggestedQuestions`): when the API/MCP response carries `next_moves` (or the server-rendered closing block text), render the **three sentences verbatim** as the last paragraph of the assistant message — no heading, no bullets, no emoji, no counts (house rule: never an exact count). Replace the current `suggestedQuestions` chips under a message with three tappable lines; tapping sends that line's implied query.
- On the **next** query, send `next_move_taken` to `/api/query/log` (`thread | specific_brand | specific_stat | specific_expert | shelf | scope | none`) using the same matching rules the MCP's `sessionTracker.evaluateNextMoveMatch` uses — port that function, don't reinvent it. The Questions table already has the single-select.
- `promptSource` for these taps: `'next_moves_thread'`, `'next_moves_specific'`, `'next_moves_scope'`.

### 3. Make question logging fail loudly, and deploy from a known commit

- `server/routers/queryRouter.ts` `POST /api/query/log`: on Airtable write failure keep returning `200` to the client, but **alert** — post to the ops Slack channel (reuse the API's `notifyInfraFailure` pattern or the app's existing Slack client) with a 15-minute throttle, and increment a counter exposed on `/health`. Add a daily cron check: if the app served chat traffic (any `/api/query/*` call) but wrote zero Questions rows in 24 h, alert.
- Users-vs-Questions reconciliation (weekly, same cron): users with `lastLogin` in the window and no Questions row → one summary line to Slack and written to the Users record (`noQuestionsRecorded: true`) so Streak/analysis can word it "no questions recorded", not "never asked".
- `.agents/workflows/deploy.md`: deploy **only from a clean `main`** (`git status` clean, `git rev-parse HEAD` recorded in the CHANGELOG entry alongside the Cloud Run revision). The April rows prove the deployed build drifted from `main`; this is the guard.

## Where to register

- `shared/constants.ts`, `frontend/components/ChatInterface.tsx`, `frontend/App.tsx`, `server/services/promptSweep.ts`, `server/services/mcpChatService.ts`, `server/routers/queryRouter.ts`, `server/routers/cronRouter.ts`, `.agents/workflows/deploy.md`, `CHANGELOG.md`.
- Bible (`Fodda API/docs/bibles/product_and_system_reference.md`, App row): one line — *App welcome = job input + catalog chips; app renders Next Moves and logs `next_move_taken`; question-log failures alert.* Bump `Last updated:`.

## Definition of Done

1. New user lands → sees the job input + 4 catalog chips; typing a brand and submitting produces a first answer whose closing line 3 says "Want this cut to [brand] specifically?". Screenshot + the Questions row (`promptSource: job_scoped`).
2. A chip tap logs `promptSource: welcome_catalog` and the chip text matches an Airtable `exampleQueries` entry for that graph. Static list only appears with Airtable mocked unreachable.
3. An answer in chat ends with exactly three plain sentences; tapping line 1 sends a follow-up whose Questions row carries `next_move_taken: thread`. Show both rows.
4. Sweep run with one prompt forced thin → that chip absent from the next welcome render; log line pasted.
5. Airtable write forced to fail → client still gets `200`, Slack alert fires once within 15 min, `/health` counter increments. Daily zero-rows check fires in a test window.
6. CHANGELOG entry records `git rev-parse HEAD` and the Cloud Run revision; `deploy.md` updated.

## Do Not

- Do NOT show costs, calls, tokens, or plan names in the welcome or the Next Moves lines.
- Do NOT render an exact remaining count in line 1 ("3 more signals") — "several more" / "many more" only (Piers, 08-22).
- Do NOT invent Next Moves lines client-side when the payload has none — render nothing rather than a generic "anything else?".
- Do NOT log `[SESSION_START]` or any placeholder to the Questions table.
- Do NOT deploy from a dirty working tree.

## Files-changed (expected)

`shared/constants.ts`, `frontend/components/ChatInterface.tsx`, `frontend/App.tsx`, `server/services/promptSweep.ts`, `server/services/mcpChatService.ts`, `server/routers/queryRouter.ts`, `server/routers/cronRouter.ts`, `server/services/` (new reconciliation job), `.agents/workflows/deploy.md`, `CHANGELOG.md`; API bible.
