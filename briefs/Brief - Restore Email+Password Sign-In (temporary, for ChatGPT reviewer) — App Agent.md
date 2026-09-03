# Brief — Restore Email + Password Sign-In (temporary) — App Agent

> **Type:** Agent Task · **Priority:** P0 (blocks ChatGPT Apps Directory submission) · **Owner:** App agent (`Fodda` repo)
> **Repo:** `~/Documents/Fodda` · **Files:** `frontend/components/AuthGate.tsx`, Clerk dashboard · **Prepared:** 2026-09-03
> **Decision (Piers, 2026-09-03):** bring back email + password sign-in **temporarily**, until the ChatGPT app is approved. Reversible afterward.

## 1. Why

OpenAI's ChatGPT Apps Directory review requires a reviewer demo account that signs in with **username + password and nothing else** — explicitly *no* MFA, SMS, email confirmation, emailed codes, magic links, or social login. Today `AuthGate` offers only LinkedIn/Google/GitHub SSO + a 6-digit **email code** ("No password, ever." — `AuthGate.tsx:502`). Both paths OpenAI disqualifies, so a reviewer cannot complete the OAuth sign-in that the ChatGPT connector triggers, and the submission's Test Credentials field cannot be satisfied. A password already exists on the Clerk user `chatgpt-review@fodda.ai`; there is simply no UI to enter it.

## 2. What to build

Restore an **email + password** sign-in option on the existing sign-in form, alongside the current SSO and email-code options (do not remove those). It must work for the OAuth-resume flow, since the reviewer arrives via ChatGPT's OAuth handshake.

### 2a. Clerk dashboard
- Enable **Password** as a sign-in authentication strategy. Keep it **optional** (email code stays the default factor) so existing users who have no password are unaffected — they keep using the code flow. Confirm `chatgpt-review@fodda.ai` has a password set.

### 2b. `frontend/components/AuthGate.tsx`
- Add a **password input** to the sign-in form and a submit path that mirrors the existing email-code handler (the sign-in handler around `:360–460`, `handleVerifyCode` around `:409`). Pattern to mirror:
  - Current code flow: `signIn.create({ identifier: email })` → `signIn.emailCode.sendCode()` → `signIn.emailCode.verifyCode({ code })` → `signIn.status === 'complete'` → `await signIn.finalize()` → `readPendingOAuthRedirect()` → redirect.
  - **Password flow:** `signIn.create({ identifier: email })` then `signIn.password({ password })` (Clerk Core-3 Future resource; confirm exact method — the alternative is a single `signIn.create({ strategy: 'password', identifier: email, password })`). On `signIn.status === 'complete'`, call `await signIn.finalize()`, then run the **same** pending-OAuth-resume logic used in `handleVerifyCode` (`readPendingOAuthRedirect()` / resume redirect) so the ChatGPT OAuth handshake continues. Do **not** invent a separate resume path — reuse the existing one so `writePendingOAuthRedirect` / `AuthenticateWithRedirectCallback` still work.
- **UI:** on the sign-in view, show the password field with a small "Sign in with a code instead" toggle back to the current email-code path, so both work. Suggested default: keep email-code primary for humans; the password field just has to be reachable and functional. Handle the standard Clerk password errors (wrong password, no password on account) via the existing `getClerkErrorCode` / `setErrorHeader` machinery.
- **Copy:** while password is enabled, fix the contradictory line at `:502` ("No password, ever.") and the `:956` "no password to remember" line so the UI isn't self-contradicting. Neutral wording, e.g. "Sign in with a 6-digit email code or your password."
- Scope: **sign-in only.** Do not add password to the sign-up flow; new users keep the existing path. The reviewer account already exists.

### 2c. Reversibility (this is temporary)
- Gate the password field behind a single constant/env flag (e.g. `ENABLE_PASSWORD_SIGNIN`) or keep the change small and self-contained, so it can be cleanly removed once OpenAI approves the app and Piers wants to return to code-only "No password, ever." Note in the code comment that this is a temporary measure tied to ChatGPT review. (It is low-harm to keep permanently as an optional factor, but treat removal as the default intent.)

## 3. Definition of Done
- [ ] Clerk Password strategy enabled (optional); `chatgpt-review@fodda.ai` has a working password.
- [ ] On `app.fodda.ai`, a user can sign in with email + password — no code sent, no MFA, no email step.
- [ ] End-to-end: from ChatGPT, connect the Fodda plugin → OAuth → Fodda sign-in → email+password → consent approved → tools list. Verify with the reviewer account in a clean browser.
- [ ] Existing SSO and email-code sign-in still work unchanged; users without a password are unaffected.
- [ ] Contradictory "no password" copy removed while the field is live.
- [ ] Deployed to the App service (the CSP/consent changes live in the running server) and confirmed on `app.fodda.ai`.
- [ ] CHANGELOG entry noting it is a temporary measure for ChatGPT review, with the flag name for later removal.

## 4. Do Not
- Do not remove or break the SSO or email-code paths.
- Do not require a password for existing users or the sign-up flow.
- Do not fork a new OAuth-resume path — reuse `readPendingOAuthRedirect` / `finalize()` exactly as the code flow does, or the ChatGPT handshake will not resume.
- Do not store or log the password; let Clerk handle it (no plaintext, no custom endpoint).
- Do not commit the reviewer account's password to the repo or CHANGELOG.

## 5. Handoff back
Once deployed, tell the MCP/submission thread so the Test Credentials block can be filled truthfully:
```
Login URL: https://app.fodda.ai
Tenant: Fodda (single workspace)
Username: chatgpt-review@fodda.ai
Password: <set in Clerk / shared vault>
Sign-in steps: In ChatGPT, connect the Fodda plugin. On the Fodda sign-in page choose "sign in with password," enter the username and password above, then approve the consent screen. No code, MFA, or email confirmation required.
```
