# Brief: Refresh Social Share Content for app.fodda.ai

**Date:** June 3, 2026
**For:** App Agent (Fodda App codebase at `/Users/piersfawkes/Documents/Fodda`)
**Priority:** High

---

## Problem

When someone shares `https://app.fodda.ai` on LinkedIn (or any social platform), the preview card looks dated and generic:

- **Title shows:** "Fodda - Demo"
- **Description:** "Fodda structures curated insights into AI-ready knowledge graphs that can be queried with traceable sources."
- **Image:** Social crawlers pull a screenshot/fallback because there is no `og:image` tag — the resulting preview shows a wireframe-like rendering of the AuthGate login page
- **No Twitter/X card markup** — defaults to a small link preview

The marketing website (`www.fodda.ai`) already has a polished, well-branded social card with proper OG tags, a custom 1200×630 image, and `summary_large_image` Twitter cards. The app needs to match this standard.

---

## Root Cause

All issues trace to `index.html` (lines 18–20):

```html
<title>Fodda - Demo</title>
<meta name="description"
  content="Fodda structures curated insights into AI-ready knowledge graphs that can be queried with traceable sources." />
```

There are **zero** Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`) and **zero** Twitter Card tags (`twitter:card`, `twitter:image`). Social platforms fall back to the `<title>` and `<meta description>` — both of which are stale.

---

## What the Marketing Website Does (Reference)

The website's `index.html` (lines 30–41) sets the bar:

```html
<!-- Social Meta Tags: Serve optimized 1200×630 (or reasonable preview) -->
<meta property="og:title" content="Fodda | Expert AI Context You Can Trust">
<meta property="og:description" content="Your AI produces generic output because it has generic context. Fodda gives it expert-curated knowledge and real institutional evidence, so its answers are specific, sourced, and defensible.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.fodda.ai/">
<meta property="og:image" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png">
<meta property="og:image:secure_url" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png">
```

Key things it does right:
- Clear value prop in the title — not just a product name
- Description is benefit-driven ("Your AI produces generic output…") not feature-listing
- Custom 1200×630 OG image hosted on a fast CDN (ucarecdn)
- `summary_large_image` Twitter card for full-width preview
- `og:image:secure_url` variant for HTTPS crawlers

---

## Files to Update

### 1. `index.html` — Meta Tags (lines 18–20)

**Current:**
```html
<title>Fodda - Demo</title>
<meta name="description"
  content="Fodda structures curated insights into AI-ready knowledge graphs that can be queried with traceable sources." />
```

**Replace with:**
```html
<title>Fodda | Expert AI Context You Can Trust</title>
<meta name="description"
  content="Your AI produces generic output because it has generic context. Fodda gives it expert-curated knowledge and real institutional evidence — so its answers are specific, sourced, and defensible." />

<!-- Open Graph -->
<meta property="og:title" content="Fodda | Expert AI Context You Can Trust" />
<meta property="og:description" content="Your AI produces generic output because it has generic context. Fodda gives it expert-curated knowledge and real institutional evidence — so its answers are specific, sourced, and defensible." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://app.fodda.ai/" />
<meta property="og:image" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png" />
<meta property="og:image:secure_url" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Fodda" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Fodda | Expert AI Context You Can Trust" />
<meta name="twitter:description" content="Your AI produces generic output because it has generic context. Fodda gives it expert-curated knowledge and real institutional evidence." />
<meta name="twitter:image" content="https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png" />
```

> [!NOTE]
> The OG image URL above points to the **same image the marketing website uses**. This is intentional — it maintains brand consistency. If a distinct app-specific image is preferred (e.g. showing the chat interface or a "Fodda App" variant), a new 1200×630 image should be created and uploaded to Uploadcare, then the URL updated above.

### 2. `metadata.json` — Project Metadata

**Current:**
```json
{
  "name": "Fodda Contextual Demo",
  "description": "A vertical-specific research assistant demo for Retail, Sports, and Beauty, powered by Gemini and grounded in curated datasets."
}
```

**Replace with:**
```json
{
  "name": "Fodda | Expert AI Context You Can Trust",
  "description": "Expert-curated knowledge graphs that give your AI specific, sourced, and defensible answers. Covers retail, beauty, sports, consumer electronics, and more."
}
```

---

## Messaging & Terminology Guide

The copy refresh should follow the website's current brand voice:

| Element | Old (App) | New (Aligned) |
|---|---|---|
| Page title | "Fodda - Demo" | "Fodda \| Expert AI Context You Can Trust" |
| Meta description | Feature-listing ("structures curated insights into AI-ready knowledge graphs…") | Benefit-driven ("Your AI produces generic output because it has generic context…") |
| Project name | "Fodda Contextual Demo" | "Fodda \| Expert AI Context You Can Trust" |
| Masthead tagline | "Turns your AI into a domain expert" (in `AuthGateAtoms.tsx` line 37) | ✅ Keep — this is good and consistent |

> [!IMPORTANT]
> The word **"Demo"** should be removed from all user-facing and crawler-visible text. The product is live — calling it a demo undersells it and looks unprofessional in social shares.

---

## OG Image Considerations

The brief currently references the website's existing OG image. Two options:

**Option A: Use the same image as the website** (recommended for speed)
- URL: `https://ucarecdn.com/619c8fa5-6f5b-4cab-818d-2454a34c5846/fodda_og_image.png`
- Pros: Immediate, consistent branding
- Cons: Doesn't differentiate app from marketing site

**Option B: Create an app-specific OG image** (recommended longer-term)
- Should be 1200×630px
- Could feature: Fodda logo + tagline over brand purple (#663399) gradient + a subtle screenshot of the chat/query interface
- Would need to be uploaded to Uploadcare and the URL swapped in

---

## Placement in `index.html`

Insert the new meta tags **immediately after the existing `<meta name="description">` tag** (line 20) and before the favicon link (line 22). This keeps the head structured logically: charset → viewport → title/description → social → favicon → scripts.

---

## Verification

After deploying, verify the share card using:

1. **LinkedIn Post Inspector:** https://www.linkedin.com/post-inspector/ — paste `https://app.fodda.ai` and confirm the new title, description, and image appear
2. **Twitter/X Card Validator:** https://cards-dev.twitter.com/validator — confirm `summary_large_image` renders correctly
3. **Facebook Sharing Debugger:** https://developers.facebook.com/tools/debug/ — scrape the URL and check for warnings
4. **Manual test:** Share `https://app.fodda.ai` in a private LinkedIn post (or Slack/Discord/iMessage) and confirm the preview card renders cleanly

> [!WARNING]
> LinkedIn and Facebook cache OG metadata aggressively. After deploying, you **must** use the LinkedIn Post Inspector and Facebook Debugger to force a re-scrape. Otherwise the old "Fodda - Demo" card will persist for days.

---

## Success Criteria

- [ ] `<title>` no longer contains "Demo"
- [ ] `og:title` reads "Fodda | Expert AI Context You Can Trust"
- [ ] `og:description` uses benefit-driven copy matching the website
- [ ] `og:image` points to a valid 1200×630 image on a fast CDN
- [ ] `twitter:card` is `summary_large_image`
- [ ] `metadata.json` no longer says "Contextual Demo"
- [ ] LinkedIn Post Inspector shows the refreshed card
- [ ] No broken or missing meta tags in a View Source check
