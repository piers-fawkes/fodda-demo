# Brief — App: 3rd Party Data section (list, toggle, remove, add)

**From:** Piers (2026-09-14)
**Owning repo / agent:** Fodda App — `piers-fawkes/fodda-demo`
**Parent brief:** Fodda API — `briefs/brief_third_party_data_providers_pipes_pilot.md`
**Blocked on:** parent §2 endpoints live and verified. Do not start against an unbuilt contract.

---

## Context

**3rd Party Data Providers are partners that our customers and users bring to the experience** — the user's own tools, blended into a Fodda answer. Fodda does not charge for them; the user already pays the provider.

The API exposes the pipes; the App is where a user actually sees and controls them. Maryland Community Compass is the pilot provider and ships **on by default for every user**. Similarweb, Semrush and Remesh are in the catalog but **not yet connectable** — each needs a customer credential, which needs the runtime secret store that has not been built.

The user-facing verbs Piers named: **switch a provider on and off**, and **remove it**. These are different actions and the UI must not merge them.

## What to build

A **3rd Party Data** section in the user's app area, consuming the parent brief's §2 contract:

| Need | Endpoint |
|---|---|
| List the user's providers + the catalog | `GET /v1/user/providers` |
| Add from catalog | `POST /v1/user/providers` |
| Remove entirely | `DELETE /v1/user/providers/:id` |
| Switch on / off | `POST /v1/user/preferences/toggle` with the provider id as `target_id` |

### States to handle

- **Compass** — present, on by default. Show it as active without the user having added it, and explain briefly why it is there. It is public Maryland data, free to everyone.
- **Similarweb / Semrush / Remesh** — visible in the catalog, **not connectable yet**. Show them as coming, with no connect button that cannot complete. Do not build a credential form; there is nowhere safe to put a credential until the secret store lands.
- **Off vs removed** — switching off keeps the provider in the user's list, greyed and inactive. Removing takes it out of the list entirely. Make the difference legible; a user who meant "pause this" should not lose it.
- **Unreachable** — a provider whose last probe failed should say so rather than appearing healthy.

### Copy constraints

- Never show a price, credit cost, or token/SPT language for provider data. Fodda does not charge for data the user brings (settled 2026-09-14).
- Do not describe Compass as a licensed or premium partner tool. It is public and free to everyone.
- Do not imply Fodda supplies Similarweb, Semrush or Remesh. Those are the user's own seats.
- Published USD prices, anywhere they appear in the App, come from Airtable and are quoted exactly.

## Definition of Done

- [ ] Section lists the user's providers with correct on/off state read from the API, not from local state.
- [ ] Toggling off, then reloading, shows the provider still present and still off.
- [ ] Removing, then reloading, shows it gone from the list.
- [ ] Compass appears on by default for a brand-new account with no prior interaction.
- [ ] Similarweb / Semrush / Remesh render as not-yet-connectable with no dead connect control.
- [ ] A provider in `unreachable` state is visibly distinguished from a healthy one.
- [ ] Works at mobile width.
- [ ] `CHANGELOG.md` updated with a real verification result against the live API, not a mock.

## Do Not

- Do not build a credential entry form, or accept a token, key or password anywhere in this section. No authenticated provider is supported until the secret store exists (Fodda API bible §8b, "Secret Storage (Phase 2)").
- Do not let a user paste an arbitrary MCP URL. Catalog-only in v1; open URLs are an unresolved decision in the parent brief.
- Do not build a second toggle path. Use the existing preferences endpoint.
- Do not cache provider state client-side in a way that can disagree with the API after a toggle.
- Do not present provider data as Fodda evidence anywhere in the App. It is third-party, customer-brought, and must read as distinct from Fodda's own Signals and Libraries.

## Files changed (expected)

To be determined in the App repo — this brief is written against the API contract, not against the App's structure.
