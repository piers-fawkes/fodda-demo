# Brief (Website Agent) — Remove 'Talk to Expert in App' CTA from Expert Pages

**Owning repo:** Fodda Website (`www.fodda.ai`) · **Agent:** Website Agent  
**Created:** 2026-08-26 · **Priority:** P1

---

## 1. Problem & Context
On expert profile and landing pages (e.g. `/experts/:slug`), there is an option or secondary CTA to "Ask on Fodda" / "Talk in App". When clicked by trial users or users exploring an expert, it routes them to `app.fodda.ai/ask` (Test Bench), which lands on a blank chat screen without pre-selecting the expert persona or question cards.

To keep the onboarding path clean, focused, and high-converting, we want to remove the in-app chat CTA on expert profile pages and keep users focused on their primary LLM workflow (Claude / MCP / direct prompt).

---

## 2. Required Changes

### 2.1 Remove In-App Chat / "Ask on Fodda" Button
- In expert profile and detail components (`src/pages/ExpertPage.tsx`, `src/pages/ExpertDetailPage.tsx`, or equivalent CTA components):
  - Remove / comment out the secondary "Talk to Expert in App" / "Open in Fodda" / "Ask on Fodda" button.

### 2.2 Streamline Direct Actions
- Keep the primary CTA focused on 1-click LLM access (e.g., "Add to Claude", copy prompt, or connector instructions).

---

## 3. Files Expected to Change
- Expert detail / profile page components in `src/`
- `CHANGELOG.md`

---

## 4. Verification Plan
1. Run local dev build on `Fodda Website`.
2. Visit `/experts/sledge-smith` (and another expert profile).
3. Confirm the "Talk to Expert in App" / "Ask in Fodda" CTA is gone, and only the direct LLM / Claude connector actions are present.
