# Brief: Fix Gemini Schema Constraint Error in Web Chat Sandbox

**Target Repo:** `piers-fawkes/fodda` (`Fodda` web app)  
**Agent:** `App Agent`  
**Priority:** P0 (Critical — blocks query execution in `app.fodda.ai/sandbox`)  
**Related Components:** `server/services/mcpChatService.ts`, `frontend/App.tsx`  

---

## 1. Problem Statement & Root Cause

Submitting a query in `app.fodda.ai/sandbox` (e.g. *"What is Global Meets Local?"*) fails with this error bubble:
```
Error: The specified schema produces a constraint that has too many states for serving. Typical causes of this error are schemas with lots of text (for example, very long property or enum names), schemas with long array length limits (especially when nested), or schemas using complex value matchers (for example, integers or numbers with minimum/maximum bounds or strings with complex formats like date-time)
```

### Verified Root Cause
1. **Forced `ANY` Mode on 52 Tools (`server/services/mcpChatService.ts:197`)**:
   ```typescript
   const callingMode = iterations === 1 ? 'ANY' : 'AUTO';
   ```
   When `mode: 'ANY'` is configured, Gemini 2.5 Flash compiles a strict Finite State Automaton (FSA) representing the union of all declared function schemas. With 52 tools declared on `/mcp`, this grammar graph exceeds Google's internal serving limit (`MAX_GRAMMAR_STATES`) and fails with HTTP 400.
2. **`AUTO` Mode Works Cleanly**:
   Live diagnostic tests confirm that when `mode: 'AUTO'` is passed with all 52 tools, Gemini 2.5 Flash succeeds with HTTP 200 and immediately selects `search_graph` for the query.
3. **Narrow Catch Block (`mcpChatService.ts:214`)**:
   The catch block only checks `/both be empty|output.*empty|no.*output|cannot.*empty/i`. When the schema constraint error occurs, it is not caught or retried with `AUTO` — it falls through to `throw genErr;` and crashes the chat session.
4. **Schema Bloat**:
   `mcpChatService` loads all 52 tools from the MCP server, including onboarding tools (`begin_expert_onboarding`, `submit_basic_info`, `submit_mcp_source`, `finalize_byo_mcp_onboarding`, `verify_byo_mcp_token`), account management (`update_user_profile`, `sign_up_free_account`), and drafting tools (`draft_linkedin_post`, `draft_linkedin_article`). These are irrelevant to research queries, wasting LLM context tokens and inflating schema state.

---

## 2. Requirements & Expected Changes

### Change 1: Update `callingMode` and Catch Block in `server/services/mcpChatService.ts`
1. **Set `callingMode` to `'AUTO'` by default**:
   ```typescript
   // Use AUTO mode so Gemini does not construct an overly constrained grammar DFA.
   // If ANY mode is desired, only use it if tool count is small (<= 20).
   const callingMode = (iterations === 1 && geminiFunctions.length <= 20) ? 'ANY' : 'AUTO';
   ```
2. **Catch Schema Constraint Errors & Retry with `AUTO`**:
   Update the catch block around line 214:
   ```typescript
   } catch (genErr: any) {
     const isConstraintError = /too many states for serving|constraint|schema/i.test(genErr.message);
     const isEmptyOutput = /both be empty|output.*empty|no.*output|cannot.*empty/i.test(genErr.message);

     if (isConstraintError || isEmptyOutput) {
       console.warn(`[McpChat] Model generation error on iteration ${iterations} (mode=${callingMode}):`, genErr.message);
       if (callingMode === 'ANY') {
         try {
           console.warn('[McpChat] Retrying iteration 1 with AUTO mode');
           result = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents,
             config: {
               systemInstruction: systemPrompt,
               temperature: 0.4,
               maxOutputTokens: 8192,
               tools: [{ functionDeclarations: geminiFunctions }],
               toolConfig: { functionCallingConfig: { mode: 'AUTO' as any } },
             },
           });
         } catch (retryErr: any) {
           console.error('[McpChat] Retry with AUTO also failed:', retryErr.message);
           break;
         }
       } else {
         break;
       }
     } else {
       throw genErr;
     }
   }
   ```

### Change 2: Filter Non-Research Tools in `server/services/mcpChatService.ts`
Before converting tools to Gemini functions, filter out onboarding, account management, and social drafting tools:
```typescript
const EXCLUDED_SANDBOX_TOOLS = new Set([
  'begin_expert_onboarding',
  'submit_basic_info',
  'submit_mcp_source',
  'finalize_byo_mcp_onboarding',
  'verify_byo_mcp_token',
  'update_user_profile',
  'sign_up_free_account',
  'draft_linkedin_post',
  'draft_linkedin_article',
  'manage_scheduled_reports',
]);

const filteredTools = mcpTools.filter(t => !EXCLUDED_SANDBOX_TOOLS.has(t.name));
const geminiFunctions = mcpToolsToGeminiFunctions(filteredTools);
```
This reduces tool count from 52 to ~38, saving latency and tokens on every turn while preserving all research, analysis, evidence, brand intelligence, and supplemental tools.

### Change 3: Sanitize Raw Compiler Errors in `frontend/App.tsx`
Ensure any uncaught schema/model errors are rendered to the user as friendly guidance rather than raw internal compiler text:
```typescript
if (/too many states for serving|schema.*constraint/i.test(rawError)) {
  return "We encountered a temporary processing error with the research model. Please try submitting your question again.";
}
```

---

## 3. Verification Plan
1. Run local dev server: `npm run dev` in `Fodda`.
2. In `app.fodda.ai/sandbox` (or `localhost:5173/sandbox`), submit the prompt:
   *"What is Global Meets Local?"*
3. Verify that:
   - No `too many states for serving` error appears.
   - `search_graph` executes and returns trend evidence.
   - The assistant synthesizes a complete, cited answer with next-move suggestions.
