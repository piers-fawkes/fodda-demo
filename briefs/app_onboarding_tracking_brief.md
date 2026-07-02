# Brief: Add Google Analytics & Onboarding Tracking to Fodda App

**Context:** We want to track user journeys on `app.fodda.ai` and seamlessly stitch them to the main marketing site (`fodda.ai`) funnel. Both sites must use the same GA4 Measurement ID (`G-LE4WLW1868`) to enable cross-domain session stitching.

**Target Codebase:** Fodda App (`/Users/piersfawkes/Documents/Fodda`)

---

## Required Tasks

### 1. Modify `index.html`
**File:** `/Users/piersfawkes/Documents/Fodda/index.html`
*   Add a preconnect link for the tag manager:
    ```html
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    ```
*   Load the GA4 Google Tag (`gtag.js`) inside the `<head>` tag:
    ```html
    <!-- Google Analytics 4 (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-LE4WLW1868"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-LE4WLW1868');
    </script>
    ```

### 2. Create Analytics Service Utility
**File:** `/Users/piersfawkes/Documents/Fodda/frontend/services/analytics.ts`
*   Create a simple tracking helper that attaches a session ID to stitch the session:
    ```typescript
    const getSessionId = (): string => {
      if (typeof window === 'undefined') return '';
      let sid = sessionStorage.getItem('fodda_session_id');
      if (!sid) {
        sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('fodda_session_id', sid);
      }
      return sid;
    };

    export const trackEvent = (eventName: string, params?: Record<string, any>) => {
      if (typeof window !== 'undefined') {
        const enrichedParams = { ...params, session_id: getSessionId() };

        // Push to GTM dataLayer
        // @ts-ignore
        window.dataLayer = window.dataLayer || [];
        // @ts-ignore
        window.dataLayer.push({
          event: eventName,
          ...enrichedParams,
        });

        // Push to GA4 directly
        if (typeof (window as any).gtag === 'function') {
          (window as any).gtag('event', eventName, enrichedParams);
        }
      }
    };
    ```

### 3. Wire Tracking into AuthGate.tsx
**File:** `/Users/piersfawkes/Documents/Fodda/frontend/components/AuthGate.tsx`
*   **Gate / Login Page View:** Add a `useEffect` at mount to track when a user lands on the login/signup gate:
    ```typescript
    useEffect(() => {
      trackEvent('app_gate_view', {
        referral_graph: referralGraph || 'none',
        promo: promoTag || 'none'
      });
    }, [referralGraph, promoTag]);
    ```
*   **Onboarding Step 1 (Basic Details) Submit:** Inside the submit handler (`handleSubmit`), track when the user successfully fills out page 1 (First Name, Last Name, Company, Job Title):
    ```typescript
    // Inside step 1 continuation block
    trackEvent('onboarding_details_submit', {
      job_title: jobTitle,
      company: company
    });
    ```
*   **Onboarding Step 2 (Query Type) Submit / Complete Registration:** Track when the user selects their querying platform (Claude, Notion, Copilot, API, etc.) and triggers the signup:
    ```typescript
    // Inside signUp.create block
    trackEvent('onboarding_api_use_submit', {
      api_use: apiUse,
      is_professional_services: isProfessionalServices
    });
    ```

### 4. Wire Tracking into App.tsx
**File:** `/Users/piersfawkes/Documents/Fodda/frontend/App.tsx`
*   **Session Start / Onboarding Completion:** Inside the Clerk authentication sync flow, when `handleSessionStart` executes successfully, track the session creation and note if it is their first login (onboarding complete):
    ```typescript
    // Inside handleSessionStart after setting state components
    trackEvent('onboarding_complete', {
      is_first_login: auth.isFirstLogin || false
    });
    ```
