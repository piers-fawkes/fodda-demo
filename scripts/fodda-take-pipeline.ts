/**
 * Fodda Take — Daily News-Driven Blog Pipeline
 * 
 * Runs as a Cloud Function or standalone script.
 * 1. Scans top business news via Gemini + Google Search
 * 2. Matches stories to Fodda graph domains
 * 3. Generates editorial "Fodda Take" via Gemini + Fodda MCP
 * 4. Stores in Airtable (status: draft)
 * 5. Notifies Slack
 * 
 * Usage:
 *   npx tsx scripts/fodda-take-pipeline.ts          # run once
 *   npx tsx scripts/fodda-take-pipeline.ts --dry-run # preview without writing
 * 
 * Required env vars:
 *   GEMINI_API_KEY, AIRTABLE_API_KEY, FODDA_API_KEY,
 *   SLACK_WEBHOOK_URL (optional)
 */

// ── Config ──────────────────────────────────────────────────────────────────
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appUOmAcm4sSCaYcZ';
const AIRTABLE_TABLE_NAME = 'Fodda Takes';
const FODDA_MCP_URL = `https://mcp.fodda.ai/mcp?api_key=${process.env.FODDA_API_KEY}`;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TAKES_PER_RUN = 2;
const DRY_RUN = process.argv.includes('--dry-run');

const GRAPH_DOMAINS = [
  { id: 'retail', label: 'Retail', keywords: ['retail', 'store', 'ecommerce', 'dtc', 'shopping', 'fulfillment', 'consumer spending', 'grocery', 'walmart', 'target', 'amazon'] },
  { id: 'beauty', label: 'Beauty', keywords: ['beauty', 'cosmetics', 'skincare', 'wellness', 'dermatology', 'fragrance', 'sephora', 'ulta'] },
  { id: 'sports', label: 'Sports', keywords: ['sports', 'stadium', 'athlete', 'sponsorship', 'streaming rights', 'esports', 'fitness', 'nfl', 'nba', 'mlb'] },
  { id: 'sic', label: 'Culture & Platforms', keywords: ['gen z', 'tiktok', 'social media', 'creator', 'streaming', 'culture', 'gaming', 'instagram', 'youtube'] },
  { id: 'fashion', label: 'Fashion', keywords: ['fashion', 'luxury', 'apparel', 'streetwear', 'sustainability', 'textile', 'lvmh', 'nike', 'adidas'] },
];

const SKIP_TOPICS = ['politics', 'election', 'war', 'crime', 'scandal', 'lawsuit', 'controversy', 'death', 'obituary'];

// ── Types ───────────────────────────────────────────────────────────────────
interface NewsStory {
  headline: string;
  url: string;
  topic: string;
  matchedGraph: string;
  matchScore: number;
}

interface FoddaTake {
  title: string;
  content: string;
  sourceHeadline: string;
  sourceUrl: string;
  graphId: string;
  heroVisualSvg?: string;
}

// ── Gemini Helpers ──────────────────────────────────────────────────────────

/** Call Gemini Flash for fast, cheap tasks (news scan, matching) */
async function callGeminiFlash(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    }),
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
}

/** Create a Waverunner Interaction for deep research with MCP */
async function createInteraction(prompt: string): Promise<any> {
  const res = await fetch(`${GEMINI_API_BASE}/interactions?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'deep-research-preview-04-2026',
      input: [{ type: 'text', text: prompt }],
      tools: [
        { type: 'google_search' },
        { type: 'url_context' },
        {
          type: 'mcp_server',
          name: 'Fodda Research',
          url: FODDA_MCP_URL,
        }
      ],
      agent_config: {
        type: 'deep-research',
        thinking_summaries: 'auto',
        visualization: 'auto',
      },
      background: true,
    }),
  });
  return res.json();
}

/** Poll an Interaction until complete */
async function pollInteraction(interactionId: string, maxAttempts = 40): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(`${GEMINI_API_BASE}/interactions/${interactionId}?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    if (data.status === 'completed' || data.status === 'failed') return data;
  }
  throw new Error(`Interaction ${interactionId} timed out after ${maxAttempts * 5}s`);
}

// ── Step 1: Scan News ───────────────────────────────────────────────────────
async function scanNews(): Promise<NewsStory[]> {
  console.log('📰 Step 1: Scanning top business news...');
  
  const text = await callGeminiFlash(
    `Find today's top 8 business news stories across retail, beauty, sports, consumer tech, and fashion.

Return ONLY a JSON array, no other text. Each item:
{"headline": "...", "url": "https://...", "topic": "retail|beauty|sports|fashion|tech"}

Focus on: product launches, strategic pivots, earnings surprises, partnerships, trend shifts.
Skip: politics, lawsuits, scandals, obituaries.`
  );
  
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    const stories: NewsStory[] = JSON.parse(jsonMatch[0]);
    console.log(`   Found ${stories.length} stories`);
    return stories;
  } catch (e) {
    console.error('   Failed to parse news:', (e as Error).message);
    console.error('   Raw output:', text.substring(0, 300));
    return [];
  }
}

// ── Step 2: Match to Graphs ─────────────────────────────────────────────────
function matchToGraphs(stories: NewsStory[]): NewsStory[] {
  console.log('🎯 Step 2: Matching stories to Fodda graphs...');
  
  const matched: NewsStory[] = [];
  
  for (const story of stories) {
    const headlineLower = (story.headline + ' ' + (story.topic || '')).toLowerCase();
    
    // Skip controversial topics
    if (SKIP_TOPICS.some(t => headlineLower.includes(t))) continue;
    
    let bestGraph = '';
    let bestScore = 0;
    
    for (const domain of GRAPH_DOMAINS) {
      const hits = domain.keywords.filter(kw => headlineLower.includes(kw)).length;
      const score = hits / domain.keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestGraph = domain.id;
      }
    }
    
    if (bestScore > 0) {
      matched.push({ ...story, matchedGraph: bestGraph, matchScore: bestScore });
    }
  }
  
  const top = matched.sort((a, b) => b.matchScore - a.matchScore).slice(0, MAX_TAKES_PER_RUN);
  console.log(`   Matched ${top.length} stories:`);
  top.forEach(s => console.log(`     "${s.headline.substring(0, 60)}..." → ${s.matchedGraph}`));
  return top;
}

// ── Step 3: Generate Fodda Take ─────────────────────────────────────────────
async function generateTake(story: NewsStory): Promise<FoddaTake | null> {
  console.log(`\n✍️  Step 3: Generating take for "${story.headline.substring(0, 60)}..."...`);
  
  const prompt = `You are writing a "Fodda Take" — a short, expert analysis that connects today's business news to Fodda's structured trend intelligence.

NEWS STORY:
${story.headline}
${story.url}

INSTRUCTIONS:
1. First, query the Fodda Research MCP server to find relevant trends, signals, and evidence from Fodda's knowledge graphs
2. Then search the web for additional context on this story
3. Write a 500-800 word analysis with this structure:

## Title
A provocative, expert-level headline that reframes the news through Fodda's lens. Not a summary — a perspective.

## The Take
2-3 paragraphs connecting the news to specific trends and signals from Fodda's graphs. Name the trends. Cite the evidence. Show the reader something they wouldn't get from reading the news story alone.

## What the Data Says
Pull in specific data points from Fodda's supplemental sources (Census, BLS, FRED, etc.) or graph statistics that support the analysis.

## Why It Matters
Forward-looking: what does this mean for strategists, brands, or the industry? What should they do differently?

## Sources
- Link to the original news story
- Name the Fodda graph(s) used
- Cite any supplemental data sources

TONE: Confident, editorial, PSFK-style. Not academic. Not generic.
Think "business intelligence brief meets trend commentary."

CRITICAL: Return ONLY the markdown. No preamble.`;

  try {
    const interaction = await createInteraction(prompt);
    
    if (!interaction.id && !interaction.name) {
      console.error('   ❌ Failed to create interaction:', JSON.stringify(interaction).substring(0, 200));
      return null;
    }

    const id = interaction.id || interaction.name;
    console.log(`   ⏳ Interaction ${id} — polling...`);
    
    const result = await pollInteraction(id);

    if (result.status === 'failed') {
      console.error('   ❌ Agent failed:', result.error?.message || 'unknown');
      return null;
    }

    // Extract text from outputs
    const outputs = result.outputs || result.response?.candidates?.[0]?.content?.parts || [];
    const markdown = outputs
      .filter((o: any) => o.type === 'text' || o.text)
      .map((o: any) => o.text || '')
      .join('\n');
    
    if (!markdown || markdown.length < 200) {
      console.error('   ❌ Output too short:', markdown.length, 'chars');
      return null;
    }

    // Extract title from first ## heading
    const titleMatch = markdown.match(/^##\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].replace(/^Title\s*/i, '').trim() : story.headline;

    // Check for SVG visuals
    const svgMatch = markdown.match(/<svg[\s\S]*?<\/svg>/);
    
    console.log(`   ✅ Generated ${markdown.length} chars`);
    console.log(`   Title: "${title.substring(0, 80)}"`);

    return {
      title,
      content: markdown,
      sourceHeadline: story.headline,
      sourceUrl: story.url,
      graphId: story.matchedGraph,
      heroVisualSvg: svgMatch ? svgMatch[0] : undefined,
    };
  } catch (e) {
    console.error(`   ❌ Generation failed:`, (e as Error).message);
    return null;
  }
}

// ── Step 4: Store in Airtable ───────────────────────────────────────────────
async function storeInAirtable(take: FoddaTake): Promise<string | null> {
  console.log(`💾 Step 4: Storing "${take.title.substring(0, 50)}..." in Airtable...`);
  
  if (DRY_RUN) {
    console.log('   [DRY RUN] Would write to Airtable');
    return 'dry-run-id';
  }

  const fields: Record<string, any> = {
    'Title': take.title,
    'Content': take.content,
    'Source Headline': take.sourceHeadline,
    'Source URL': take.sourceUrl,
    'Graph ID': take.graphId,
    'Status': 'draft',
    'Published Date': new Date().toISOString().split('T')[0],
    'Type': 'Fodda Take',
  };

  if (take.heroVisualSvg) {
    fields['Hero Visual SVG'] = take.heroVisualSvg;
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    
    const data = await res.json();
    if (data.id) {
      console.log(`   ✅ Stored as ${data.id}`);
      return data.id;
    } else {
      console.error('   ❌ Airtable error:', JSON.stringify(data).substring(0, 200));
      return null;
    }
  } catch (e) {
    console.error('   ❌ Airtable write failed:', (e as Error).message);
    return null;
  }
}

// ── Step 5: Notify Slack ────────────────────────────────────────────────────
async function notifySlack(takes: FoddaTake[]) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || DRY_RUN) return;

  const text = [
    `📝 *${takes.length} New Fodda Take${takes.length > 1 ? 's' : ''} Generated*`,
    ...takes.map(t => `• _${t.title}_ → \`${t.graphId}\` graph`),
    `→ Review in <https://airtable.com/${AIRTABLE_BASE_ID}|Airtable> (status: draft)`,
  ].join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    console.log('📣 Slack notified');
  } catch { /* fire and forget */ }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Fodda Take Pipeline — ${new Date().toISOString()}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Validate env
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
  if (!DRY_RUN && !process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY required');
  if (!process.env.FODDA_API_KEY) throw new Error('FODDA_API_KEY required');

  // Step 1: Scan
  const stories = await scanNews();
  if (stories.length === 0) {
    console.log('⚠️  No stories found. Exiting.');
    return;
  }

  // Step 2: Match
  const matched = matchToGraphs(stories);
  if (matched.length === 0) {
    console.log('⚠️  No stories matched Fodda graphs. Exiting.');
    return;
  }

  // Step 3+4: Generate + Store
  const takes: FoddaTake[] = [];
  for (const story of matched) {
    const take = await generateTake(story);
    if (take) {
      takes.push(take);
      await storeInAirtable(take);
    }
  }

  if (takes.length === 0) {
    console.log('⚠️  No takes generated. Exiting.');
    return;
  }

  // Step 5: Notify
  await notifySlack(takes);

  console.log(`\n✅ Pipeline complete. ${takes.length} take${takes.length > 1 ? 's' : ''} generated.\n`);
  
  if (DRY_RUN) {
    console.log('═══ DRY RUN OUTPUT ═══\n');
    for (const take of takes) {
      console.log(`Title:   ${take.title}`);
      console.log(`Graph:   ${take.graphId}`);
      console.log(`Source:  ${take.sourceHeadline}`);
      console.log(`Length:  ${take.content.length} chars`);
      console.log(`Has SVG: ${!!take.heroVisualSvg}`);
      console.log('─── Preview ───');
      console.log(take.content.substring(0, 600) + '\n...\n');
    }
  }
}

// ── Cloud Function Export ───────────────────────────────────────────────────
// To deploy as a Cloud Function, wrap with:
//   export const foddaTakePipeline = onSchedule('every day 06:00', main);
// For standalone: just run directly
main().catch(e => {
  console.error('💥 Pipeline failed:', e.message);
  process.exit(1);
});
