/**
 * MCP Chat Service — Server-side agentic loop
 *
 * Connects to the Fodda MCP server as a client, uses Gemini to decide
 * which tools to call, and returns a synthesized answer.
 *
 * Flow:
 *   1. Connect to MCP server with user's API key
 *   2. List available tools → convert to Gemini function declarations
 *   3. Send query + system prompt to Gemini with tools
 *   4. Agentic loop: Gemini calls tools → MCP executes → results fed back
 *   5. Return final answer with tool call log
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { executeOutputSkills, detectDepth } from './skillExecutorService.js';

export const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://mcp.fodda.ai';
const MAX_TOOL_ITERATIONS = 8;
const TOTAL_TIMEOUT_MS = 45_000;

interface ToolCallLog {
  tool: string;
  args: Record<string, any>;
  durationMs: number;
  resultPreview: string; // First 200 chars of result
}

export interface McpChatResult {
  answer: string;
  suggestedQuestions: string[];
  toolCalls: ToolCallLog[];
  totalDurationMs: number;
  failureType?: 'NO_COVERAGE' | 'DIDNT_ROUTE' | 'TIMEOUT' | null;
  traceJson?: string;
  error?: string;
}

/**
 * Convert MCP tool schemas (JSON Schema) to Gemini function declarations.
 */
function mcpToolsToGeminiFunctions(mcpTools: any[]): any[] {
  return mcpTools.map(tool => {
    // MCP uses JSON Schema; Gemini uses a similar but slightly different format
    const schema = tool.inputSchema || {};
    const properties: Record<string, any> = {};
    const required: string[] = schema.required || [];

    for (const [key, val] of Object.entries(schema.properties || {})) {
      const prop = val as any;
      // Map JSON Schema types to Gemini-compatible types
      const geminiProp: Record<string, any> = {
        type: (prop.type || 'STRING').toUpperCase(),
        description: prop.description || '',
      };
      // Handle arrays
      if (prop.type === 'array' && prop.items) {
        geminiProp.type = 'ARRAY';
        geminiProp.items = { type: (prop.items.type || 'string').toUpperCase() };
      }
      // Handle enums
      if (prop.enum) {
        geminiProp.enum = prop.enum;
      }
      // Gemini uses NUMBER not INTEGER
      if (geminiProp.type === 'INTEGER') {
        geminiProp.type = 'NUMBER';
      }
      properties[key] = geminiProp;
    }

    return {
      name: tool.name,
      description: tool.description || '',
      parameters: {
        type: 'OBJECT',
        properties,
        required,
      },
    };
  });
}

/**
 * Run the agentic chat loop.
 */
export async function mcpChat(
  query: string,
  vertical: string,
  apiKey: string,
  userEmail: string,
  userContext?: string,
  accountContext?: string,
  firstName?: string,
  personaContext?: string
): Promise<McpChatResult> {
  const startTime = Date.now();
  const toolCallLog: ToolCallLog[] = [];
  // Accumulate trend/evidence data from tool results for post-loop skill execution
  const collectedData: { trends: any[]; evidence: any[] } = { trends: [], evidence: [] };
  let mcpClient: Client | null = null;

  try {
    // 1. Connect to MCP server (Internal service-to-service call; intentionally legacy URL format)
    const mcpUrl = `${MCP_BASE_URL}/mcp?api_key=${encodeURIComponent(apiKey)}&user_id=${encodeURIComponent(userEmail)}`;

    mcpClient = new Client({
      name: 'fodda-sandbox',
      version: '1.0.0',
    });

    const transport = new StreamableHTTPClientTransport(
      new URL(mcpUrl)
    );

    await mcpClient.connect(transport);

    // 2. List available tools
    const toolsResult = await mcpClient.listTools();
    const mcpTools = toolsResult.tools || [];
    console.log(`[McpChat] Connected. ${mcpTools.length} tools available.`);

    // Convert to Gemini function declarations
    const geminiFunctions = mcpToolsToGeminiFunctions(mcpTools);

    // 3. Build the prompt
    let systemPrompt = `You are a research analyst using Fodda's tools to answer user queries.
You have access to knowledge graph search, evidence retrieval, and supplemental data tools.

WORKFLOW:
1. First call list_graphs to see available graphs
2. Search relevant graphs with search_graph
3. Get evidence for top trends with get_evidence
4. Call relevant supplemental tools for macro context
5. Synthesize everything into a comprehensive answer

Always attribute data sources. Include evidence links when available.
Format your final answer as rich markdown with ## headers for trends.`;

    // Add user/account context if available
    const userName = firstName || 'the user';
    if (accountContext?.trim()) {
      systemPrompt += `\n\nACCOUNT CONTEXT: ${accountContext}`;
    }
    if (userContext?.trim()) {
      systemPrompt += `\n\nUSER CONTEXT (About ${userName}): ${userContext}`;
    }
    if (personaContext?.trim()) {
      systemPrompt += `\n\nRESEARCH PERSONA (confirmed by user — use to tailor depth and framing): ${personaContext}`;
    }

    // Build initial messages for Gemini
    const userPrompt = vertical && vertical !== 'all'
      ? `Query: "${query}"\nIMPORTANT: You MUST search the graph "${vertical}" first using search_graph with graph_id="${vertical}". This is the user's selected expert/graph. After searching that graph, you may also search other relevant graphs for supplementary context. Do NOT skip searching the primary graph.\nUser ID: ${userEmail}`
      : `Query: "${query}"\nUser ID: ${userEmail}`;

    // 4. Run the agentic loop with Gemini
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // Build contents for multi-turn conversation
    const contents: any[] = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ];

    let iterations = 0;
    let finalAnswer = '';
    let suggestedQuestions: string[] = [];

    while (iterations < MAX_TOOL_ITERATIONS) {
      // Check timeout
      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        console.warn(`[McpChat] Timeout after ${iterations} iterations`);
        break;
      }

      iterations++;
      console.log(`[McpChat] Iteration ${iterations}/${MAX_TOOL_ITERATIONS}`);

      // Use ANY mode on first iteration to force a tool call (prevents empty output).
      // Use AUTO on subsequent iterations so the model can choose to call tools or respond with text.
      const callingMode = iterations === 1 ? 'ANY' : 'AUTO';

      let result: any;
      try {
        result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2,
            maxOutputTokens: 8192,
            tools: [{ functionDeclarations: geminiFunctions }],
            toolConfig: { functionCallingConfig: { mode: callingMode as any } },
          },
        });
      } catch (genErr: any) {
        // Handle empty model output error — break loop and fall through to fallback synthesis
        if (/both be empty|output.*empty|no.*output|cannot.*empty/i.test(genErr.message)) {
          console.warn(`[McpChat] Empty model output on iteration ${iterations} (mode=${callingMode}):`, genErr.message);
          // If this was ANY mode, retry once with AUTO before giving up
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
              console.error('[McpChat] Retry also failed:', retryErr.message);
              break; // fall through to fallback synthesis
            }
          } else {
            break; // fall through to fallback synthesis
          }
        } else {
          throw genErr; // re-throw non-empty-output errors
        }
      }

      if (!result) {
        console.warn('[McpChat] No result from Gemini, breaking loop');
        break;
      }

      const candidate = result.candidates?.[0];
      if (!candidate?.content?.parts) {
        console.warn('[McpChat] No content in Gemini response');
        break;
      }

      const parts = candidate.content.parts;

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // No more tool calls — extract final text answer
        const textParts = parts.filter((p: any) => p.text);
        finalAnswer = textParts.map((p: any) => p.text).join('\n');

        // Try to extract suggested questions from the response
        const sqMatch = finalAnswer.match(/(?:follow-up|next|suggested).*?(?:questions?|prompts?).*?:\s*\n((?:\d+\..+\n?)+)/i);
        if (sqMatch) {
          suggestedQuestions = sqMatch[1]
            .split('\n')
            .map(l => l.replace(/^\d+\.\s*/, '').trim())
            .filter(Boolean)
            .slice(0, 5);
        }

        break;
      }

      // Execute function calls via MCP in parallel
      // Add the model's response (with function calls) to conversation
      contents.push({ role: 'model', parts });

      const functionResponsePromises = functionCalls.map(async (fc) => {
        const fnCall = (fc as any).functionCall;
        const name: string = fnCall.name;
        const args: Record<string, any> = fnCall.args || {};
        const toolStart = Date.now();

        console.log(`[McpChat] Calling tool: ${name}`, JSON.stringify(args).substring(0, 100));

        try {
          const mcpResult = await mcpClient!.callTool({
            name,
            arguments: args,
          });

          const contentArr = Array.isArray(mcpResult.content) ? mcpResult.content : [];
          const resultText = contentArr
            .map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c))
            .join('\n') || '{}';

          const toolDuration = Date.now() - toolStart;

          toolCallLog.push({
            tool: name,
            args: args || {},
            durationMs: toolDuration,
            resultPreview: resultText.substring(0, 200),
          });

          // ── Capture structured data for post-loop skill execution ──
          if (/search_graph|search_all/i.test(name)) {
            try {
              const parsed = JSON.parse(resultText);
              const trendArr = parsed.trends || parsed.results || (Array.isArray(parsed) ? parsed : []);
              collectedData.trends.push(...trendArr.filter((t: any) => t && t.name));
            } catch { /* best-effort */ }
          }
          if (/get_evidence|evidence/i.test(name) && !/search/i.test(name)) {
            try {
              const parsed = JSON.parse(resultText);
              const evArr = parsed.evidence || (Array.isArray(parsed) ? parsed : []);
              collectedData.evidence.push(...evArr.filter((e: any) => e && (e.title || e.snippet)));
            } catch { /* best-effort */ }
          }

          console.log(`[McpChat] Tool ${name} completed in ${toolDuration}ms (${resultText.length} chars)`);

          return {
            functionResponse: {
              name,
              response: { result: resultText.substring(0, 15000) }, // Cap result size for Gemini context
            },
          };
        } catch (toolErr: any) {
          console.error(`[McpChat] Tool ${name} failed:`, toolErr.message);

          toolCallLog.push({
            tool: name,
            args: args || {},
            durationMs: Date.now() - toolStart,
            resultPreview: `ERROR: ${toolErr.message}`,
          });

          return {
            functionResponse: {
              name,
              response: { error: toolErr.message },
            },
          };
        }
      });

      const functionResponses = await Promise.all(functionResponsePromises);

      // Add function results back to the conversation
      contents.push({ role: 'user', parts: functionResponses });
    }

    // ── Fallback synthesis if the loop exited without a final answer ──
    // This handles cases where all Gemini calls with tools produced empty output
    // but we still have tool results in the conversation to synthesize.
    if (!finalAnswer && toolCallLog.length > 0) {
      console.warn('[McpChat] No final answer from loop — attempting fallback synthesis from tool results');
      try {
        const toolSummaries = toolCallLog
          .map(tc => `Tool: ${tc.tool}\nArgs: ${JSON.stringify(tc.args)}\nResult: ${tc.resultPreview}`)
          .join('\n\n');

        const fallbackResult = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Based on the following tool results, provide a comprehensive answer to the query: "${query}"\n\n${toolSummaries}`,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        });

        finalAnswer = fallbackResult.text || '';
        if (finalAnswer) {
          console.log('[McpChat] Fallback synthesis succeeded');
        }
      } catch (fallbackErr: any) {
        console.error('[McpChat] Fallback synthesis also failed:', fallbackErr.message);
      }
    }

    // ── Last-resort: no final answer AND no tool calls — generate without tools ──
    if (!finalAnswer) {
      console.warn('[McpChat] No answer produced — last-resort generation without tools');
      try {
        const lastResort = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Answer the following query as a research analyst. Be comprehensive and use markdown formatting.\n\nQuery: "${query}"${vertical && vertical !== 'all' ? `\nContext: This query is about the expert/topic "${vertical}".` : ''}`,
          config: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        });
        finalAnswer = lastResort.text || '';
        if (finalAnswer) {
          console.log('[McpChat] Last-resort generation succeeded');
        }
      } catch (lastErr: any) {
        console.error('[McpChat] Last-resort generation failed:', lastErr.message);
      }
    }

    // Clean up MCP connection
    try { await mcpClient.close(); } catch { /* ignore */ }

    // ══════════════════════════════════════════════════════════════
    // POST-LOOP: Execute output-phase skills (outside the tool loop)
    // ══════════════════════════════════════════════════════════════
    try {
      const skillResults = await executeOutputSkills({
        query,
        trends: collectedData.trends,
        evidence: collectedData.evidence,
        foddaAnswer: finalAnswer,
        disabledSkills: new Set(), // TODO: pass user's disabled skills from profile
      });

      const successfulSkills = skillResults.filter(r => r.protocol && !r.error);

      if (successfulSkills.length > 0) {
        console.log(`[McpChat] Synthesizing ${successfulSkills.length} skill protocols...`);
        const depth = detectDepth(query);

        // Execute each skill protocol via one LLM call per skill
        for (const skill of successfulSkills) {
          try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

            const synthesisResult = await ai2.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Apply the following thinking protocol to this trend data and produce a concise analytical section.\n\nUSER QUERY: ${query}\n\nTREND DATA:\n${JSON.stringify(collectedData.trends.slice(0, 10), null, 0)}\n\nTHINKING PROTOCOL TO EXECUTE:\n${skill.protocol}\n\nInstructions:\n- Apply the thinking framework genuinely to the trend data — generate reframes, blind spots, provocations\n- Be concise (3-5 paragraphs) and actionable\n- Do NOT summarize the protocol instructions or repeat the trend data\n- Output only the analysis`,
              config: { temperature: 0.4, maxOutputTokens: 2048 },
            });

            const skillAnalysis = synthesisResult.text || '';
            if (skillAnalysis.trim()) {
              finalAnswer += `\n\n---\n\n## ${skill.attribution}\n\n${skillAnalysis.trim()}`;
            }

            // Log skill as a tool call for transparency
            toolCallLog.push({
              tool: `skill:${skill.skillId}`,
              args: { depth, trends: collectedData.trends.length },
              durationMs: skill.durationMs,
              resultPreview: skillAnalysis.substring(0, 200),
            });
          } catch (synthErr: any) {
            console.error(`[McpChat] Skill synthesis failed for ${skill.skillId}:`, synthErr.message);
          }
        }
      }
    } catch (skillErr: any) {
      // Skills are fail-open — never block the main response
      console.error('[McpChat] Skill execution failed (fail-open):', skillErr.message);
    }

    const totalDuration = Date.now() - startTime;
    let failureType: 'NO_COVERAGE' | 'DIDNT_ROUTE' | 'TIMEOUT' | null = null;

    if (totalDuration >= TOTAL_TIMEOUT_MS) {
      failureType = 'TIMEOUT';
    } else if (toolCallLog.length === 0) {
      failureType = 'DIDNT_ROUTE';
    } else if (collectedData.trends.length === 0 && collectedData.evidence.length === 0) {
      const emptyIndicator = toolCallLog.some(t => {
        const lower = (t.resultPreview || '').toLowerCase();
        return lower.includes('0 nodes') || lower.includes('empty') || lower.includes('no results') || lower.includes('not found') || lower.includes('no evidence');
      });
      if (emptyIndicator) {
        failureType = 'NO_COVERAGE';
      }
    }

    // Compute evidence min/max dates (the 120-day window)
    let minDate: string | null = null;
    let maxDate: string | null = null;
    collectedData.evidence.forEach((ev: any) => {
      const dStr = ev.date || ev.Date || ev.published_date || ev.timestamp;
      if (dStr) {
        if (!minDate || dStr < minDate) minDate = dStr;
        if (!maxDate || dStr > maxDate) maxDate = dStr;
      }
    });

    const traceJson = JSON.stringify({
      version: '1.0',
      query,
      vertical,
      totalDurationMs: totalDuration,
      toolCalls: toolCallLog,
      evidenceDateRange: minDate && maxDate ? `${minDate.split('T')[0]} to ${maxDate.split('T')[0]}` : '120-day active window',
      humanExpertAttribution: vertical.startsWith('expert-') ? vertical.replace('expert-', '').replace(/-/g, ' ').toUpperCase() : null,
      failureType
    });

    return {
      answer: finalAnswer || 'No response generated.',
      suggestedQuestions,
      toolCalls: toolCallLog,
      totalDurationMs: totalDuration,
      failureType,
      traceJson
    };

  } catch (err: any) {
    console.error('[McpChat] Fatal error:', err);
    try { if (mcpClient) await mcpClient.close(); } catch { /* ignore */ }

    const totalDuration = Date.now() - startTime;
    let failureType: 'NO_COVERAGE' | 'DIDNT_ROUTE' | 'TIMEOUT' | null = 'DIDNT_ROUTE';
    const errMsg = (err.message || '').toLowerCase();

    if (totalDuration >= TOTAL_TIMEOUT_MS || errMsg.includes('timeout')) {
      failureType = 'TIMEOUT';
    } else if (toolCallLog.length > 0) {
      failureType = 'NO_COVERAGE';
    }

    return {
      answer: '',
      suggestedQuestions: [],
      toolCalls: toolCallLog,
      totalDurationMs: totalDuration,
      failureType,
      error: err.message,
    };
  }
}

/**
 * Metadata helper to list all available tools from the MCP server.
 */
export async function listMcpTools(apiKey: string, userEmail: string): Promise<any[]> {
  let mcpClient: Client | null = null;
  try {
    // Internal service-to-service metadata call; intentionally legacy URL format
    const mcpUrl = `${MCP_BASE_URL}/mcp?api_key=${encodeURIComponent(apiKey)}&user_id=${encodeURIComponent(userEmail)}`;
    mcpClient = new Client({ name: 'fodda-metadata-fetcher', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    await mcpClient.connect(transport);
    const result = await mcpClient.listTools();
    await mcpClient.close();
    return result.tools || [];
  } catch (err) {
    if (mcpClient) await mcpClient.close().catch(() => {});
    throw err;
  }
}
