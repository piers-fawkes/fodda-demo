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
  - **Restricted State**: If a user maxes out or hits 0 queries, they can still view the dashboard, history, and evidence but CANNOT submit new prompts. (Implemented in `/api/query` proxy)

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
- **Challenge**: Direct API calls (via external keys) are currently not tracked/restricted by the internal system. Need a strategy for unified usage monitoring.

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
