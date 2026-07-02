# App Agent Brief — Stabilization Phase

**Objective**

The App is a developer test harness, not a product surface.

The goal is to ensure:
*   **Zero logic drift**
*   **Full transparency**
*   **No response mutation**
*   **Clean separation** from API and MCP layers

No new features are required. **Only stabilization.**

---

## 1️⃣ Execution Mode Must Remain UI-Only

**The toggle:**
`DIRECT | MCP AGENT`

**Must:**
*   Only change routing path
*   Only add `X-Fodda-Execution-Mode` header
*   Only be used for display and logging

**It must NEVER:**
*   Alter deterministic behavior
*   Alter limits
*   Alter usage calculation
*   Alter response structure
*   Trigger alternate parsing logic

*Execution mode is informational only.*

---

## 2️⃣ App Must Display Raw Payload

**The DevTools drawer must:**
*   Display exactly what is received from the API.

**No:**
*   Reformatting
*   Field reordering
*   Field collapsing
*   Field omission
*   Synthetic summaries
*   Injected UI properties

**Display:**
*   `requestId`
*   `graphId`
*   `version`
*   `schema_version`
*   `generated_at`
*   `data`
*   `meta`
*   `meta.usage`

*As raw JSON.*

---

## 3️⃣ Headers Must Be Visible

**Display:**

*   **Outgoing request headers**
    *   `X-Fodda-Mode`
    *   `X-Fodda-Execution-Mode`
    *   `X-User-Id` (if present)
    *   Authorization/API key
*   **Incoming response headers** (if present)

*This allows enterprise debugging.*

---

## 4️⃣ Deterministic Status Indicator

**Fetch:**
`GET /v1/system/validation`

**Display:**
*   Deterministic Mode: `ENFORCED`
*   Schema Version: `xxxx`
*   Limits: `{...}`

*This reinforces system integrity during demos.*

---

## 5️⃣ Dual Mode Comparison Must Not Mutate Data

If running both modes for comparison:
*   Store both raw responses separately
*   Compare internally
*   Display differences visually
*   **Never merge the two.**
*   **Never normalize them.**
*   **Never “clean” them.**

---

## 6️⃣ Simulation Mode Must Be Clearly Flagged

If MCP simulation mode is active:

**Display clearly:**
*   Simulation Mode: **ON**
*   Simulation Type: `gemini_echo`

*Simulated results must never appear indistinguishable from real API calls.*

---

## 7️⃣ The App Must Not Become a Logic Layer

**The App must NOT:**
*   Calculate billing
*   Calculate usage
*   Enforce limits
*   Retry requests silently
*   Modify tool responses
*   Provide summarization
*   Interpret graph relationships

*It is a window only.*
