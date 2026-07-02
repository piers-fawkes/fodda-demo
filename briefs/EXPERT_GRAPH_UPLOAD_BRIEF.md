# Expert Graph PDF Upload — Suggestions for App Integration

> **From:** Expert Graph Pipeline (Fodda CE / expert.fodda.ai)
> **To:** Fodda App Agent
> **Date:** 2026-04-08
> **Context:** We're building a self-service pipeline on the CE side where users can upload trend report PDFs, have them reviewed, and get them ingested into knowledge graphs. The upload lives in the App since it has auth, API keys, and the existing "My Pattern Graphs" tab. The key framing shift: **the graph is the user's first** — it's available to them via their own account. They can then choose to share it to the network (free) or sell access (revenue share). The tab should be called "My Graphs" and feel like a personal graph library.
>
> **Updated 2026-04-08:** Reframed from "Sell My Graph" to "My Graphs" — upload-first, distribution-choice-second.

---

## What We're Building on the CE Side

1. **Admin review dashboard** at `expert.fodda.ai/admin` — Piers reviews pending submissions, approves/provides feedback/declines
2. **Full PDF ingestion pipeline** — on approval, CE runs `extractFromPDF()` → `ingestPDFReport()` → taxonomy categorization → registry update → brief generation
3. **Query usage tracking** — `incrementGraphQueryCount()` function that the API will call to track queries per graph
4. **Revenue share model** — 50% of query revenue goes to the expert (tracked via `queryCount` on Graph List table)

The App's job is the **front door** — getting the expert's PDF, profile pic, and metadata into a `pending_review` state that CE can pick up.

---

## Suggested App Changes

### 1. New Signup Intent: "Create My Graph"

The AuthGate currently has 3 intents (Self Demo, Use with Claude, Developer/API). We'd suggest adding a 4th:

```typescript
sell: {
  icon: '📊',
  label: 'Create My Graph',
  subtext: 'Upload a trend report PDF — use it, share it, or sell it',
  emailLine: "You're almost ready to create your own knowledge graph."
}
```

When selected, after account creation → auto-route to the "My Graphs" tab with PDF upload mode active.

### 2. PDF Upload in "My Graphs" Tab

The existing tab (AccountPortal.tsx ~lines 1680–1945, currently labeled "My Pattern Graphs") should be renamed to **"My Graphs"**. It currently supports Google Sheets via a 3-column source picker. We'd suggest adding PDF as the primary option:

**Source buttons:**
- 📄 **PDF Report** — primary, highlighted, enabled (new)
- 📊 Google Sheet — existing, keep as-is
- 📋 Airtable — coming soon (existing, disabled)

**When PDF selected, suggested flow:**

| Step | What Happens |
|------|-------------|
| 1. Upload PDF | Drag-and-drop zone (max 50MB, `.pdf`). Upload to **Uploadcare** (same project CE uses — env vars `UPLOADCARE_PUBLIC_KEY`, `UPLOADCARE_SECRET_KEY`). Store CDN URL. |
| 2. Profile photo | Expert uploads headshot OR pastes URL. Upload to Uploadcare with filename `{firstname}-{lastname}.jpg`. This becomes the headshot on their graph's website page. |
| 3. Extract & review | POST `{ pdfUrl }` to a new endpoint `/api/expert-graph/extract-pdf`. This does a **lightweight** Gemini extraction — metadata + trend/evidence counts only (NOT the full CE pipeline). Pre-fill an editable form with: Graph Name, Description, Creator, Organization, Domain, Geographic Scope, Update Cadence, Report Title, Publication Date. Show preview: "X trends, Y evidence items found". |
| 4. Distribution | **Choose how to share your graph:**<br>• 🔒 **Private** — only available to you via your account (default)<br>• 🌐 **Share to Network** — free for others to query via the Fodda network<br>• 💰 **Sell Access** — earn 50% revenue share when others query your graph. If selected: "By submitting, you agree to Fodda's [revenue sharing terms](https://www.fodda.ai/expert-terms)." |
| 5. Submit | POST `/api/expert-graph/submit` → creates `pending_review` entry in the App Graph Registry table + sends admin notification email to hello@psfk.com |
| 6. Confirmation | "✅ Submitted for review! We'll email you at {email} when it's reviewed." |

### 3. Lightweight Gemini Extraction (App-Side)

The App's extraction is **metadata-only** — it does NOT need to replicate the full CE pipeline. A simple Gemini 2.0 Flash call with a prompt like:

> "Extract from this PDF report: title, author name, organization, publication date, count of trends/themes discussed, count of supporting evidence/case studies, and list the trend/theme names."

This gives the expert a preview to review. The full extraction (trend descriptions, evidence excerpts, citations, categorization) happens on the CE side after admin approval.

### 4. Status Display & Feedback Loop

Expert's graph cards (in the existing `myGraphs.map()` list) should show status:

| Status | Badge | What the Expert Sees |
|--------|-------|---------------------|
| `pending_review` | 🟡 Awaiting Review | "Your graph is being reviewed by our team." |
| `needs_revision` | 🟠 Revision Requested | Admin feedback text + "Edit & Resubmit" / "Upload New PDF" buttons |
| `declined` | 🔴 Declined | Admin note + dismiss button |
| `active` / `live` | 🟢 Live | **Usage dashboard**: query count this month, all-time, estimated earnings |

When status is `needs_revision`, the expert can edit metadata or upload a new PDF, which resets status to `pending_review`.

When `declined`, the graph card should be dismissable (acknowledged by user).

### 5. Usage Stats (Live Graphs)

For graphs with status `active`/`live`, show:
- Queries this month / all time (from `queryCount` field on Graph List table)
- Estimated earnings: `queryCount × $0.50` (simplified top-up estimate)
- "Full earnings dashboard coming soon"

Fetch via `GET /api/expert-graph/usage/:graphSlug` which reads from the Airtable Graph List table.

### 6. Suggested Server Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/expert-graph/extract-pdf` | Accepts `{ pdfUrl }`. Runs lightweight Gemini extraction. Returns `{ graphName, description, creator, org, trendCount, evidenceCount, reportTitle, publicationDate, trends: [{name}] }` |
| `POST` | `/api/expert-graph/upload-headshot` | Accepts `{ imageUrl }` or multipart file. Uploads to Uploadcare with expert's name as filename. Returns `{ headshotUrl }` |
| `POST` | `/api/expert-graph/submit` | Creates `pending_review` record in App Graph Registry + sends admin email |
| `GET` | `/api/expert-graph/my-submissions` | Returns all submissions for logged-in user |
| `POST` | `/api/expert-graph/resubmit/:graphSlug` | Updates metadata or swaps PDF, resets to `pending_review` |
| `GET` | `/api/expert-graph/usage/:graphSlug` | Returns query count + earnings estimate from Graph List table |

### 7. Uploadcare Service

The App will need an Uploadcare service. CE already has one at `src/graphs/piers-fawkes/consumer-electronics/services/uploadcare.ts` — it can be ported. The App version should support:

- `uploadFromUrl(sourceUrl, filename?)` — for headshot URLs
- `uploadFile(buffer, filename, mimeType)` — for direct PDF/image uploads

Same Uploadcare project (same API keys). Tag all expert uploads with `"ExpertGraph"` folder metadata.

### 8. Email Templates

We'd suggest 4 new templates in `emailTemplates.ts`:

| Key | To | When |
|-----|-----|------|
| `EXPERT_GRAPH_SUBMITTED_ADMIN` | hello@psfk.com | Expert submits (include review link: `https://expert.fodda.ai/admin?review={graphSlug}`) |
| `EXPERT_GRAPH_APPROVED` | Expert | Admin approves (include App dashboard link) |
| `EXPERT_GRAPH_FEEDBACK` | Expert | Admin requests revisions (include feedback text) |
| `EXPERT_GRAPH_DECLINED` | Expert | Admin declines (include optional note) |

### 9. Multi-Graph Support

The existing UI already has `myGraphs.map()` and a "+ Register Another" button — this naturally supports multiple graphs per user. No special work needed, just make sure the submit endpoint allows the same `ownerId` to create multiple graphs.

### 10. Airtable Fields

The App Graph Registry table (`tblezSucv8qmbSSy9`) will need these new fields:

| Field | Type | Purpose |
|-------|------|---------|
| `sourceType` | Add `"pdf"` to existing select | New source type |
| `pdfUrl` | URL | Uploadcare PDF CDN URL |
| `headshotUrl` | URL | Expert headshot CDN URL |
| `distributionMode` | Single select: `private`, `network`, `sell` | How the user wants to share their graph. **Private** = only for their account. **Network** = free for all Fodda users. **Sell** = 50% revenue share. Visible to admin during review. |
| `adminFeedback` | Long text | Revision notes from admin |
| `publicationDate` | Date | Report publication date |
| `reportTitle` | Text | Original report title |

---

## Precise Code References

These are the exact files and line numbers the App agent needs to modify:

### AuthGate.tsx (`frontend/components/AuthGate.tsx`)

**Line 16** — `SignupIntent` type: add `| 'sell'`
**Line 18-22** — `INTENT_CONFIG`: add the `sell` entry after `api`
**Line 529-543** — Intent buttons render via `Object.entries(INTENT_CONFIG).map(...)` — the new `sell` button will appear automatically
**Line 37** — `signupIntent` state defaults to `'account'` — no change needed
**Line 166** — `onRegister()` call passes `signupIntent` — the `'sell'` value flows to the server and gets stored in Airtable

### AccountPortal.tsx (`frontend/components/AccountPortal.tsx`)

**Lines 59-69** — My Graphs state declarations. Add new state:
```typescript
const [pdfFile, setPdfFile] = useState<File | null>(null);
const [pdfUrl, setPdfUrl] = useState('');
const [headshotUrl, setHeadshotUrl] = useState('');
const [extractedMeta, setExtractedMeta] = useState<any>(null);
const [extracting, setExtracting] = useState(false);
const [requestPayment, setRequestPayment] = useState(false);
```

**Lines 1694-1716** — Source selection grid. Add PDF Report as first button:
```typescript
<button
    onClick={() => { setRegSourceType('pdf' as any); }}
    className={`p-4 rounded-xl border text-left transition-all ${regSourceType === 'pdf' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-black/30 hover:border-zinc-700'}`}
>
    <p className="text-lg mb-1">📄</p>
    <p className="text-xs font-bold text-white">PDF Report</p>
    <p className="text-[10px] text-zinc-500 mt-1">Upload a trend report</p>
</button>
```

**Lines 1860-1872** — Empty state hero. Update copy to mention PDF upload as primary path alongside the Sheet template.

**Lines 1885-1933** — Graph cards `myGraphs.map()`. Extend status display to include `pending_review`, `needs_revision`, `declined`, and usage stats for `active`/`live`.

### server/index.ts

**Lines 199-207** — Airtable table constants. The Graph Registry table is already referenced:
```typescript
// Existing: GRAPH_REGISTRY_TABLE used via imported graph-registry.ts
// The App Graph Registry table ID is: tblezSucv8qmbSSy9
```

Add new endpoints after the existing graph registration endpoints (around line ~3800). Follow the same pattern as `app.post("/api/graph/register", ...)` at approximately line 3300.

### server/services/emailTemplates.ts

**Lines 1-243** — Full file. Add 4 new templates after `PLAN_UPGRADED` (line 240). Follow the exact same `EmailTemplate` interface pattern:
```typescript
interface EmailTemplate {
    subject: string;
    body: (data: any) => string;
    html?: (data: any) => string;
}
```

### Existing Patterns to Follow

**Uploadcare** — Reference implementation at `Fodda CE/src/graphs/piers-fawkes/consumer-electronics/services/uploadcare.ts` (82 lines). Uses `axios` for URL-based uploads + polling. Key pattern:
1. POST to `https://upload.uploadcare.com/from_url/` with `pub_key`, `source_url`, `store: '1'`
2. Poll `https://upload.uploadcare.com/from_url/status/` with returned token
3. CDN URL = `https://ucarecdn.com/${uuid}/`

**Graph Registration** — The existing `handleRegisterGraph()` function in AccountPortal.tsx calls `dataService.registerGraph()` which POSTs to `/api/graph/register`. The new PDF submission should follow the same pattern but POST to `/api/expert-graph/submit`.

**Email sending** — Use existing `sendSystemEmail(templateKey, toEmail, data)` from `server/services/emailService.ts`. Already has mock mode when `EMAIL_USER`/`EMAIL_PASS` aren't set.

---

## Data Flow Summary

```
Expert in App                    App Server                          CE Admin
────────────────                ─────────────                      ──────────
Upload PDF                      
  → Uploadcare CDN URL          
Upload headshot                 
  → Uploadcare CDN URL          
Click "Extract"                 
  → POST /extract-pdf ────────→ Gemini Flash scrape
                                ← { meta, trendCount }
Review + edit form              
Click "Submit" ──────────────→ POST /submit
                                → Create record in
                                  Graph Registry (tblezSucv8qmbSSy9)
                                  status: pending_review
                                  pdfUrl, headshotUrl stored
                                → Email hello@psfk.com ──────────→ Piers reviews
                                                                   at expert.fodda.ai/admin
                                                                   Approve/Feedback/Decline
                                                                   → Updates status in Airtable
                                                                   → Emails expert
Expert sees status update ←──── Polls /my-submissions
  pending_review → 🟡
  needs_revision → 🟠 + feedback
  declined → 🔴 + note
  active/live → 🟢 + stats
```

---

## Dependencies

- `GEMINI_API_KEY` env var (for lightweight extraction)
- `UPLOADCARE_PUBLIC_KEY`, `UPLOADCARE_SECRET_KEY` env vars (same as CE project)
- Optional: `@uploadcare/upload-client` npm package for frontend direct uploads
- `axios` — already in App package.json

