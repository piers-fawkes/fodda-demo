# APP Agent Brief — MCP Test Harness Refinement

**Objective**

Refine the existing Dual-Mode Test Harness so that the App behaves strictly as a **transparent execution window** over:

1.  **Direct API calls**
2.  **MCP → API tool calls**

The App must **not** introduce logic drift or mutate API behavior.

---

## 1️⃣ Execution Mode Must Be Routing Only

**The toggle:**

`DIRECT | MCP AGENT`

**Must:**

*   Change routing path only
*   Add `X-Fodda-Execution-Mode` header
*   Display execution mode clearly

**It must NOT:**

*   Alter deterministic mode
*   Alter limits
*   Alter usage calculation
*   Alter graphId
*   Alter tool arguments
*   Alter response payload

*Execution mode is informational.*

---

## 2️⃣ App Must Be a Transparent Window

**The DevTools drawer must show:**

*   **Request**
    *   Endpoint called
    *   Full request body
    *   Full request headers
    *   Execution mode
*   **Response**
    *   Raw JSON exactly as received
    *   No mutation
    *   No field removal
    *   No reordering
    *   No summarization

**Display:**

*   `requestId`
*   `graphId`
*   `version`
*   `schema_version`
*   `generated_at`
*   `data`
*   `meta.usage`

*Never collapse meta.*

---

## 3️⃣ Add Side-by-Side Drift View (Enhancement)

*Instead of manual toggle-only testing:*

**Allow an optional “Compare Modes” action that:**

1.  Executes **Direct**
2.  Executes **MCP**
3.  Displays both responses side-by-side

**Highlights:**

*   Usage equivalence
*   Data deep equality
*   Latency difference
*   RequestId difference

*This turns the App into a real test console.*

---

## 4️⃣ Display Deterministic Status

**Pull from:**

`GET /v1/system/validation`

**Display clearly:**

`Deterministic Mode: ENFORCED`

*This should appear visibly in DevTools.*

---

## 5️⃣ Simulation Mode Clarity (If Enabled)

**If Gemini simulation mode is used:**

**Display clearly:**

*   Simulation Mode: **ON**
*   Simulation Type: `gemini_echo`

*Simulated responses must never look identical to real API responses.*

---

## 6️⃣ No Business Logic in App

**The App must never:**

*   Calculate usage
*   Calculate limits
*   Adjust billing
*   Adjust traversal limits
*   Enforce rate limits
*   Modify headers except `execution-mode`
*   Retry requests silently

*It is a UI test harness only.*

---

**End State**

The App becomes:
**A deterministic execution console.**
