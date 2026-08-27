# Brief — AuthGate sign-in button hierarchy (LinkedIn-first)

> Owning repo: Fodda App. Execute with `/build-from-brief briefs/authgate-button-hierarchy.md`.
> SEQUENCING: run only AFTER `briefs/clerk-email-code-oauth-resume.md` is deployed and its live
> e2e verification has passed. Same surface (AuthGate) — do not overlap the changes.

## Context

AuthGate currently shows three equal-weight SSO buttons — Google, GitHub, LinkedIn
(`frontend/components/AuthGate.tsx:603-605`, repeated ~697) — plus the email form. Peer feedback
(Victor Lee, 2026-08-26) was explicit that each extra choice inhibits action. Decision from
Piers 2026-08-26: LinkedIn is the audience-fit primary; Google stays as a compact secondary;
email and GitHub become quiet text links.

## What to build

1. Reorder/restyle the auth options on BOTH sign-in and sign-up variants of AuthGate:
   - **LinkedIn** — large primary button, full width, first.
   - **Google** — secondary button below it, visually smaller/quieter.
   - **Email** — text link ("or continue with email") that reveals the existing email-code flow.
   - **GitHub** — text link alongside/below email (e.g. "or GitHub"), same quiet treatment.
2. No functional changes to any auth flow — `handleOAuth` providers, the email-code flow, and
   the OAuth redirect/resume logic all stay exactly as shipped by the email-code brief.
3. Before demoting GitHub, check the Clerk dashboard (or ask Piers) for existing
   GitHub-provider users; note the count in the CHANGELOG entry. Demotion to a text link keeps
   them functional either way.

## Where to register

Nothing to register. Deploy the app per its normal pipeline.

## Definition of Done

- Both AuthGate variants render: LinkedIn primary, Google secondary, email + GitHub as text
  links; all four paths verified working in a browser (SSO round-trips + one email-code entry).
- The Claude-connector OAuth screen (redirect_url present) shows the same hierarchy and still
  returns to Claude after LinkedIn sign-in.
- CHANGELOG.md updated with a real verification result.

## Do Not

- Do not remove any provider or touch Clerk dashboard settings.
- Do not modify the email-code logic, redirect allowlist, or resume/session-storage handling.
- Do not restyle unrelated AuthGate screens (code entry, notices, team-domain fields).

## Files-changed (expected)

- `frontend/components/AuthGate.tsx` (and `AuthGateAtoms.tsx` if button variants need a prop)
- `CHANGELOG.md`
