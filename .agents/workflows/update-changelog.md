---
description: Update the CHANGELOG.md file after completing any code changes
---

# Update Changelog Workflow

After completing any meaningful code change — whether it's a bug fix, new feature, refactor, deployment, or configuration update — you **must** update `CHANGELOG.md` at the project root before considering the task complete.

## When to Update

Update the changelog when you have done **any** of the following:

- Added a new feature or component
- Fixed a bug
- Changed existing behavior
- Deployed to production
- Updated dependencies or configuration
- Refactored code with user-visible effects
- Added or updated documentation (READMEs, API docs, etc.)
- Added items to `BACKLOG.md` or `BACKBURNER.md`

**Do NOT update** for trivial changes like fixing a typo in a comment, or when the user is just asking a question without any code changes.

## How to Update

### 1. Open the changelog

Read the current `CHANGELOG.md` at `/Users/piersfawkes/Documents/Fodda/CHANGELOG.md` to understand the existing format and most recent entry.

### 2. Determine the correct section

- If today's date already has an entry at the top of the file, **add your changes to that existing entry** under the appropriate sub-heading (`Added`, `Changed`, `Fixed`, `Removed`, `Deployed`, `Investigated`).
- If today's date does **not** have an entry, create a **new entry at the top** of the file (below the header), using the format below.

### 3. Entry format

```markdown
## [YYYY-MM-DD] — Short Descriptive Title

### Added
- **Feature Name**: Brief description of what was added and why.

### Changed
- **Component/Area**: What changed and the user-visible effect.

### Fixed
- **Bug Name**: What was broken, what the root cause was, and how it was fixed.

### Removed
- **What was removed**: Reason for removal.

### Deployed
- Deployment target and any relevant notes.

### Investigated
- **Issue Name**: What was looked into and the conclusion.
```

### 4. Writing guidelines

- **Be specific**: Include component names, file names, and endpoint paths where relevant. Use backticks for code references.
- **Explain the "why"**: Don't just say "Updated App.tsx" — say what the update achieved.
- **Use bold for titles**: Each bullet should start with a bolded short title followed by a colon and description.
- **Keep it concise**: One to two sentences per bullet point. Link to READMEs or docs for detailed explanations.
- **Group related changes**: If you made 5 changes to the Evidence Drawer, group them under one bullet with sub-bullets, not 5 separate entries.
- **Only include sub-headings that apply**: If there are no removals, don't include a `### Removed` section.

### 5. Save and confirm

After editing, briefly confirm to the user that the changelog has been updated with a summary of what was logged.

## Example

If the user asked you to add a dark mode toggle and fix a login bug, and today is 2026-03-07, you would add this at the top of the changelog (after the header):

```markdown
## [2026-03-07] — Dark Mode Toggle & Login Fix

### Added
- **Dark Mode Toggle**: Added a theme switcher to `Sidebar.tsx` that persists preference to `localStorage`. Applies a `.dark` class to the root element with inverted color palette.

### Fixed
- **Login Redirect Loop**: Fixed a bug in `AuthGate.tsx` where expired magic link tokens caused an infinite redirect loop instead of showing the "link expired" message. Root cause: missing token expiry check before redirect.
```

## Reminder

This workflow is a **post-task step**. Treat it as part of your definition of done — the task is not complete until the changelog is updated.
