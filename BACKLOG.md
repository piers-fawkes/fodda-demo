# Future Tasks: Account Admin Enhancements

This document tracks planned features for the Account Admin interface.

## 🚨 Critical Priority
- [x] **Secure Login Flow**: Implemented Magic Link authentication. Users receive a secure, time-limited link via email to log in.
    - **Session Security**: Tokens are single-use and expire after 15 minutes.
    - [ ] **Persistent Sessions**: Allow users to stay logged in for the duration of the day (e.g., 24-hour cookie/token).
    - [ ] **Auth Policy Toggle**: Implement a toggle in the Admin/Settings panel to choose between "Request login link every time" vs "Once a day".

## User Management
- [x] **Email Confirmation**: Implemented a flow where a new user must confirm their email address before being granted access to the platform.
- [x] Transition primary domain to `app.fodda.ai` and rename GCP service to `fodda-production` (Confirmed by user)
- [x] Add "How will you query Fodda graphs?" dropdown to signup flow (Field: `apiUse`)
- [x] Resolve remaining TypeScript lint errors in frontend and backend
- [ ] Optimize mobile sidebar responsiveness
- [x] **User Listing**: Implementation of a table/list view to show all users associated with the current account.
- [x] **Delete Users**: Functionality for account owners to remove users from their account.
- [ ] **Edit User Emails**: Interface to update the email addresses of sub-users.
- [x] **Usage Tracking**: Display the current monthly query count for each user to monitor activity.

## Signup Code & Employee Onboarding (Completed)
- [x] **Generate Signup Code**: Automatically create a unique `signupCode` when a new Account is created.
- [x] **Admin Visibility**: Allow Account Owners to view and share their company's `signupCode` from the Dashboard.
- [x] **Optional Code on Signup**: Add a `signupCode` field to the registration form.
- [x] **Account Linking Logic**: 
  - If a code is provided and matches an existing Account:
    - Link user to that Account.
    - Set User Role to 'Employee'.
    - Skip new Account/API Key creation.
  - If no code is provided, proceed with 'Owner' role and new Account creation.

## Implementation Notes
- **API Endpoints**: Will require new endpoints in `server/index.ts` for:
  - `GET /api/account/users` (fetching linked users)
  - `GET /api/account/usage` (total monthly queries for the account)
  - `GET /api/account/users/usage` (list of users and their monthly query counts)
  - `DELETE /api/user/:id` (removal logic)
  - `PATCH /api/user/:id/email` (email updates)
  - **Documentation**: Update API documentation with new details and the `BACKLOG.md` file status.
- **Frontend**: Expansion of the `Dashboard.tsx` or a new `AccountAdmin.tsx` component to display these metrics.
- **Data Security**: Ensure only users with the "Owner" or "Admin" role can perform these actions.

## Plan Enforcement & Upgrades
- [x] **Enforce Plan Maximums**: Implement server-side logic to block prompts when `monthlyQueries` reaches `maxplanQueries`.
  - **Restricted State**: If a user maxes out or hits 0 queries, they can still view the dashboard, history, and evidence but CANNOT submit new prompts. (Implemented in `/api/query` proxy AND `/v1/graphs/:graphId/search` proxy)

- [ ] **Plan Transitions (Free -> Lapsed)**:
  - New users start on **Free** (planCode 2, non-recurring, limit: 12).
  - **Trigger**: When `monthlyQueries` >= 12 (or current limit):
    - Auto-downgrade Account to **Lapsed** (planCode 7).
    - Set `maxMonthlyQueries` to 0.

- [ ] **Upgrade Offers (Post-Lapse)**:
  - Display upgrade options when a user is in 'Lapsed' state or maxed out.
  - **One-off Option**:
    - **Trial Extra Credit** (planCode 8): 25 queries for $500.
  - **Subscription Options**:
    - Single Graph - Small Team
    - All Graphs - Small Team
    - Single Graph - Enterprise
    - All Graphs - Enterprise

- [x] **Usage Warnings**: Display a clear message in the UI when a user or account is restricted due to plan limits.
- [x] **Query Usage Chip**: Show remaining queries (X / Y) in the ChatInterface toolbar when usage > 50%. Turns amber/red at higher thresholds.
- **Challenge**: ~~Direct API calls (via external keys) are currently not tracked/restricted by the internal system.~~ V1 proxy now enforces limits. External calls to the Fodda API have their own enforcement via `checkAvailableCredits()`.

## API Usage & Monitoring
- [ ] **Unified Usage Tracking**:
  - Update `verify_api.ts` (middleware) to increment `monthlyQueries` for all valid API requests with an API Key.
  - Differentiate between **App Usage** (Internal session) vs **External API Usage** (cURL/Postman).
  - Add `source` field to usage logs to track origin (e.g., 'web-app', 'external-api').

## Email Confirmations & Notifications
- [x] **System Emails**:
  - [x] **Signup Confirmation**: "Verify your email to continue." (Implemented via Nodemailer)
  - [ ] **Welcome Email**: "Welcome to Fodda. Here is your start guide." (Template exists, needs trigger)
  - [ ] **Plan Limit Warning**: "You have used 80% of your monthly queries."
  - [ ] **Lapsed Notification**: "Your free trial has ended. Upgrade to continue."
  
- [x] **Delivery Mechanism (Initial Setup)**:
  - [ ] **Option A (Recommended)**: Use a transactional email service like **Resend** (free tier is generous) or SendGrid.
  - [x] **Option B (Temporary)**: Use **Nodemailer** with Gmail SMTP (Implemented).

## Recent Fixes & Refinements
- [x] **Duplicate User Fix**: Resolved race condition where Airtable created ghost users from Account Owner link.
- [x] **Capture Company Name**: Ensure Company name is saved to User record during registration.
- [x] **Chat Anchor & Formatting**:
  - [x] Implemented markdown repair for broken links.
  - [x] Refined System Prompts to stop title repetition in descriptions.

## Documentation & API Maintenance
- [ ] **Continuous API Doc Sync**: Ensure the API doc Modal is always updated with the latest architectural changes. Coordinate with the agent or codee at `/Fodda API` for the latest endpoint specs and security protocols.

## UI Refinements
- [ ] **Security & Determinism Links**: Add links or modal triggers in the sidebar (near API Docs) pointing to:
    - `Fodda_Security_Overview_README.md`
    - `Fodda_API_Deterministic_Mode_README.md`
- [ ] **Graph Header Alignment**: Increase left padding for Graph Name/Headline and Suggested Questions to match the alignment of the User Input area.
- [ ] 🐛 **Logout Button Bug**: Logout button on User Profile page exits the profile modal but does not actually log out or exit the app. Needs to clear session/auth state and redirect to login.

## Evidence Drawer Improvements

### Bug Fixes (from UI Display Issue Investigation)
- [ ] Inconsistent chat window labels for articles
- [ ] Incorrect "Adjacent Possibilities" formatting
- [ ] Unclear body text sourcing in the Evidence drawer

### New Features
- [ ] Evidence type badges: Signal 🔵, Metric 📊, Quote 💬, Case Study 📗
- [ ] Timeline view: Articles plotted chronologically
- [ ] Brand tag chips: Clickable to see "all articles mentioning Nike"

## 🐛 Graph Bugs (Live Server)

### Sports & Beauty Graphs Not Working
**Reported**: 2026-03-05
**Status**: Needs investigation

**Symptom**: On live server, PSFK Retail Graph returns data but Sports and Beauty graphs do not.

**Investigation notes**:
- The frontend correctly lowercases the vertical and constructs the search URL: `/v1/graphs/sports/search`, `/v1/graphs/beauty/search`
- The sandbox server at `server/index.ts:1697` proxies to `FODDA_API_URL/v1/graphs/${graphId}/search` — this is correct
- Server also filters rows by `psfk_graph_slug` (line 1717-1718) — if upstream returns cross-graph data, rows without matching slug are dropped
- **Possible causes**:
  1. Upstream Fodda API (`fodda-api-v4`) doesn't have sports/beauty vector indexes loaded
  2. The `psfk_graph_slug` values in Neo4j for sports/beauty trends don't match `"sports"`/`"beauty"` exactly
  3. Upstream API returns 403 or empty for those graph slugs  
- **Next steps**: Check upstream API logs, verify Neo4j has nodes with `psfk_graph_slug = "sports"` and `psfk_graph_slug = "beauty"`, test direct API calls to `FODDA_API_URL/v1/graphs/sports/search`

## 📌 My Graphs — Use Airtable URL / Logo / Curator URL

**Added**: 2026-04-10

The `MyGraphsPage.tsx` graph cards should use the `sourceURL`, `portrait_url` (logo), and `curator_url` fields that are already persisted in Airtable and available on the `KnowledgeGraph` type, rather than displaying plain text and fallback avatar initials.

- [ ] **Curator name → clickable link**: Wrap the curator name in `renderGraphCard` (and the owned-graphs section) with an `<a>` tag linking to `curator_url` when available.
- [ ] **Report logo**: Display the report/graph logo from `portrait_url` (or a dedicated `logo_url` field if added) more prominently — currently only used as a small avatar circle.
- [ ] **Source URL link**: Add a "View Report" or external-link icon next to the graph name that opens `sourceURL` in a new tab when available.
- [ ] **Owned graphs section**: The "Your Graphs" card currently shows a gradient initial circle — should pull `portrait_url` from the catalog entry for a real logo/avatar if one exists.

**Files**: `frontend/components/MyGraphsPage.tsx`, `shared/types.ts`, `shared/dataService.ts`

---

## 🔥 Backburner — Account & Profile Data Fixes

**Reported**: 2026-03-10

### Query Usage Disconnect
- [ ] **User Profile shows 0 queries**: Individual user query counts on the User Profile show 0. The sum of all users' queries in an account should match the account-level total shown in the Account modal. Need to fix per-user query tracking so each user's count is accurate and they all add up to the account total.

### Team Members Visibility
- [ ] **Current user not shown in Team Members**: When a user opens the Account modal and views Team Members, it should at minimum show the currently signed-in user for that account. Currently may show an empty list even though the user themselves is a member.

## 🔥 Backburner — StratMonday → Community Graph Onboarding

**Added**: 2026-03-23 (post StratMonday presentation)

Turn the StratMonday presentation materials into a permanent onboarding flow for new community graph creators:

- [ ] **Self-service graph registration**: Add a "Register Your Graph" page to `app.fodda.ai` — user pastes Sheet URL, Fodda validates structure, creates graph, issues MCP key automatically
- [ ] **Convert howto.fodda.ai into evergreen content**: Remove StratMonday-specific references, make it a general "Build Your Knowledge Graph" guide
- [ ] **Hosted Signal Collector demo**: Deploy the Brief 2 app to Cloud Run so new users can try it without building locally (needs shared Gemini key + read-only demo sheet)
- [ ] **Onboarding email sequence**: After graph registration, send welcome email with links to briefs, example page, and MCP setup guides
- [ ] **Video walkthrough**: Record a screen capture of the full 3-step flow (copy template → build signal collector → register on Fodda)
- [ ] **Brief 2 credential flow**: Explore letting new users use Fodda's shared service account key so they don't need their own GCP setup

**Context**: The StratMonday presentation assets live at:
- Landing page: `howto.fodda.ai` (deployed from `/Fodda Share/demo/`)
- Briefs: `/Fodda Share/briefs/`
- Speaker notes: `/Fodda Share/StratMonday Fodda Presentation README.md`
- Signal Collector app: `/Fodda Share/demo/signal-collector/`

## 🔗 Slack Integration — "Connect to Slack" Dashboard Button

**Added**: 2026-04-24

Add a one-time **"Connect to Slack"** button to the Fodda dashboard that lets users connect their Slack workspace via OAuth. Once connected, Fodda can deliver research alerts, trend digests, and agent outputs directly to the user's chosen Slack channel.

- [ ] **OAuth Flow**: Implement Slack OAuth 2.0 (V2) flow — user clicks "Connect to Slack", authorizes via Slack, callback stores `access_token`, `team_id`, `team_name`, and selected `channel_id`
- [ ] **Backend Endpoint**: Add `GET /api/slack/connect` (initiates OAuth redirect) and `GET /api/slack/callback` (handles token exchange and storage)
- [ ] **Airtable Storage**: Persist Slack connection data on the Account record — fields: `slackAccessToken`, `slackTeamId`, `slackTeamName`, `slackChannelId`, `slackConnectedAt`
- [ ] **Dashboard UI**: Add a "Connect to Slack" button (with Slack branding) to the Account Settings or Dashboard. Once connected, display the connected workspace name and channel, with a "Disconnect" option
- [ ] **One-Time Setup**: The button should be prominent for unconnected accounts and collapse to a status badge once connected
- [ ] **Scopes**: Request minimal scopes — `chat:write`, `channels:read`, `incoming-webhook` — to post messages to the selected channel
- [ ] **Security**: Encrypt the stored `access_token` at rest; never expose it to the frontend after initial connection
- [ ] **Handoff Report → API Agent**: Once Slack OAuth integration is complete, generate a structured brief for the API agent documenting the stored credentials schema, available scopes, and channel delivery mechanism — so it can implement **weekly trend report delivery** to connected Slack channels

**Next phase (API Agent)**: Using the stored Slack connection, the API agent will build a scheduled weekly digest that posts trend summaries, new evidence counts, and hot-spot alerts directly to each account's connected Slack channel.

**Files (likely)**: `server/index.ts` (new routes), `frontend/components/Dashboard.tsx` or `AccountSettings.tsx` (UI), `shared/types.ts` (Slack fields on Account type), Airtable Account table schema update

