/**
 * Streak CRM Integration Service
 *
 * Adds new sign-ups to the "Fodda Sales" pipeline in Streak.
 * - Registration -> adds to "Email Not Confirmed" stage.
 * - Confirmation -> promotes to "Self Demo" stage.
 */

const STREAK_API_KEY = process.env.STREAK_API_KEY || '';
const STREAK_BASE_V1 = 'https://api.streak.com/api/v1';
const STREAK_BASE_V2 = 'https://api.streak.com/api/v2';

export const STAGE_SELF_DEMO = 'Self Demo';
export const STAGE_SELF_EXPERT = 'Self-Expert';
export const STAGE_NOT_CONFIRMED = 'Email Not Confirmed';
const PROMOTABLE_STAGES = ['Lead / Cold Call', 'In Contact', 'Email Not Confirmed'];

// Custom Field Keys
const FIELD_LAST_EMAIL_DATE = '1007'; // "Date of Last Email"

// ---------- helpers ----------

function authHeader(): Record<string, string> {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

async function streakFetch(path: string, opts: RequestInit = {}, version: 'v1' | 'v2' = 'v1'): Promise<any> {
  const base = version === 'v2' ? STREAK_BASE_V2 : STREAK_BASE_V1;
  const url = path.startsWith('http') ? path : `${base}${path}`;
  
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Streak API ${opts.method || 'GET'} ${path} -> ${res.status}: ${body}`);
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

// ---------- cached lookups ----------

const cachedPipelineKeys: Record<string, string> = {};
let cachedStageMap: Record<string, string> = {}; // stageName -> stageKey
let cachedStageMapPipeline: string | null = null;

async function getPipelineKey(pipelineName: string = 'Fodda Sales'): Promise<string> {
  if (cachedPipelineKeys[pipelineName]) return cachedPipelineKeys[pipelineName];

  const pipelines: any[] = await streakFetch('/pipelines');
  const pipeline = pipelines.find((p: any) => p.name === pipelineName);
  if (!pipeline) throw new Error(`Streak pipeline "${pipelineName}" not found`);

  cachedPipelineKeys[pipelineName] = pipeline.pipelineKey || pipeline.key;
  console.log(`[Streak] Resolved pipeline "${pipelineName}" -> ${cachedPipelineKeys[pipelineName]}`);
  return cachedPipelineKeys[pipelineName];
}

async function getStageMap(pipelineKey: string): Promise<Record<string, string>> {
  if (Object.keys(cachedStageMap).length > 0 && cachedStageMapPipeline === pipelineKey) return cachedStageMap;

  const pipeline = await streakFetch(`/pipelines/${pipelineKey}`);
  const stages = pipeline.stages || {};

  cachedStageMap = {};
  for (const [key, value] of Object.entries(stages)) {
    const stageObj = value as any;
    const stageName = stageObj.name || stageObj;
    cachedStageMap[stageName] = key;
  }
  cachedStageMapPipeline = pipelineKey;

  return cachedStageMap;
}

// ---------- search ----------

async function findBox(email: string, name: string | undefined, pipelineKey: string): Promise<any | null> {
  // 1. Try search by email first (efficient)
  try {
    const results = await streakFetch(`/search?query=${encodeURIComponent(email)}`);
    const boxes: any[] = results.results?.boxes || results.boxes || [];
    const match = boxes.find((b: any) => b.pipelineKey === pipelineKey);
    if (match) {
      console.log(`[Streak] Found existing box by email search for ${email}: ${match.name}`);
      return match;
    }
  } catch (e) {
    console.warn(`[Streak] Search failed for ${email}:`, e);
  }

  // 2. Fallback: Scan pipeline for name match (robust)
  try {
    const boxes: any[] = await streakFetch(`/pipelines/${pipelineKey}/boxes`);
    const searchName = name?.toLowerCase().trim();
    const searchEmail = email.toLowerCase().trim();

    for (const box of boxes) {
      const boxName = (box.name || '').toLowerCase().trim();
      const notes = (box.notes || '').toLowerCase();
      
      // Match by name
      if (searchName && boxName === searchName) {
        console.log(`[Streak] Found existing box by name match for ${name}`);
        return box;
      }
      
      // Match by email in notes (if search API missed it)
      if (notes.includes(searchEmail)) {
        console.log(`[Streak] Found existing box by email in notes for ${email}: ${box.name}`);
        return box;
      }
    }
  } catch (e) {
    console.warn(`[Streak] Pipeline scan failed:`, e);
  }

  return null;
}

// Cached team key for contact creation
let cachedTeamKey: string | null = null;

async function getTeamKey(): Promise<string | null> {
  if (cachedTeamKey) return cachedTeamKey;
  const teams: any[] = await streakFetch('/teams');
  if (teams && teams.length > 0) {
    cachedTeamKey = teams[0].teamKey || teams[0].key;
    return cachedTeamKey;
  }
  return null;
}

/**
 * Ensure an email address is linked as a contact on a Streak box.
 * If no contact exists for the email, creates one first via the Streak API,
 * then links it. This ensures contacts are always attached — even for
 * people we've never emailed.
 */
async function ensureBoxContact(boxKey: string, email: string): Promise<void> {
  try {
    // 1. Search for existing contact by email
    const searchResults = await streakFetch(`/search?query=${encodeURIComponent(email)}`);
    const contacts = searchResults?.results?.contacts || [];
    let match = contacts.find((c: any) => {
      const emails = (c.emailAddresses || []).map((e: string) => e.toLowerCase());
      return emails.includes(email.toLowerCase());
    });

    // 2. If no contact exists, create one
    if (!match?.key) {
      const teamKey = await getTeamKey();
      if (!teamKey) {
        console.warn(`[Streak] No team found — cannot create contact for ${email}`);
        return;
      }

      try {
        match = await streakFetch(`/contacts?teamKey=${encodeURIComponent(teamKey)}&getIfExisting=true`, {
          method: 'POST',
          body: JSON.stringify({ emailAddresses: [email] }),
        });
        console.log(`[Streak] Created contact for ${email}`);
      } catch (createErr: any) {
        console.warn(`[Streak] Could not create contact for ${email}: ${createErr.message}`);
        return;
      }
    }

    if (!match?.key) return;

    // 3. Fetch existing box contacts to preserve them
    const box = await streakFetch(`/boxes/${boxKey}`);
    const existingContacts = box.contacts || [];
    const existingKeys = existingContacts.map((c: any) => c.key).filter(Boolean);

    if (existingKeys.includes(match.key)) return; // Already linked

    // 4. Link contact to box using {key: contactKey} format
    const allContacts = [...existingContacts, { key: match.key }];
    await streakFetch(`/boxes/${boxKey}`, {
      method: 'POST',
      body: JSON.stringify({ contacts: allContacts }),
    });
    console.log(`[Streak] Linked contact ${email} to box ${boxKey}`);
  } catch (e: any) {
    console.warn(`[Streak] Could not link contact ${email} to box: ${e.message}`);
  }
}

/**
 * Prepend a structured note to the top of existing box notes.
 * SOP: [YYYY-MM-DD] Action: {Description} | Agent: {Agent Name} | Meta: {key=value}
 */
export async function prependStructuredNote(
  boxKey: string,
  action: string,
  agentName: string = 'Fodda App Agent',
  meta: Record<string, string | number> = {}
): Promise<void> {
  try {
    // 1. Fetch existing box (to get current notes)
    const box = await streakFetch(`/boxes/${boxKey}`);
    const existingNotes = box.notes || '';

    // 2. Format new note
    const today = new Date().toISOString().split('T')[0];
    const metaStr = Object.entries(meta)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const structuredNote = `[${today}] Action: ${action} | Agent: ${agentName} | Meta: ${metaStr}`;

    // 3. Prepend and update
    const finalNotes = structuredNote + (existingNotes ? '\n' + existingNotes : '');
    await streakFetch(`/boxes/${boxKey}`, {
      method: 'POST',
      body: JSON.stringify({ notes: finalNotes }),
    });
  } catch (e: any) {
    console.warn(`[Streak] Could not prepend structured note to box ${boxKey}: ${e.message}`);
  }
}

// ---------- public API ----------

/**
 * Main entry point: ensures a user exists in the Streak pipeline.
 * can be called with 'Self Demo' or 'Email Not Confirmed' as targetStage.
 */
export async function addToStreakPipeline(
  email: string, 
  name?: string, 
  company?: string, 
  targetStage: string = STAGE_SELF_DEMO,
  promoTag?: string,
  meta: Record<string, string | number> = {},
  pipelineName: string = 'Fodda Sales'
): Promise<void> {
  if (!STREAK_API_KEY) {
    console.warn('[Streak] STREAK_API_KEY not set - skipping Streak integration');
    return;
  }

  try {
    const pipelineKey = await getPipelineKey(pipelineName);
    const stageMap = await getStageMap(pipelineKey);

    const targetStageKey = stageMap[targetStage];
    if (!targetStageKey) {
      console.error(`[Streak] Target stage "${targetStage}" not found. Available: ${Object.keys(stageMap).join(', ')}`);
      return;
    }

    const existingBox = await findBox(email, name, pipelineKey);

    if (existingBox) {
      const currentStageName = Object.entries(stageMap).find(([, key]) => key === existingBox.stageKey)?.[0];
      
      // If target is Self Demo, we only move from promotable stages
      // If target is Email Not Confirmed (registration), we only move if they are in an earlier stage (like Cold Call)
      let shouldMove = false;
      if (targetStage === STAGE_SELF_DEMO && currentStageName && PROMOTABLE_STAGES.includes(currentStageName)) {
        shouldMove = true;
      } else if (targetStage === STAGE_NOT_CONFIRMED && currentStageName === 'Lead / Cold Call') {
        shouldMove = true;
      }

      if (shouldMove) {
        await streakFetch(`/boxes/${existingBox.boxKey}`, {
          method: 'POST',
          body: JSON.stringify({ stageKey: targetStageKey }),
        });
        console.log(`[Streak] Moved existing box for ${email} from "${currentStageName}" -> "${targetStage}"`);
        
        // Log the move in notes following SOP
        await prependStructuredNote(existingBox.boxKey, `Promoted lead to ${targetStage}`, 'Fodda App Agent', {
          fromStage: currentStageName || 'Unknown',
          toStage: targetStage,
          ...meta
        });

        // Update date field if moving to unconfirmed
        if (targetStage === STAGE_NOT_CONFIRMED) {
          await streakFetch(`/boxes/${existingBox.boxKey}/fields/${FIELD_LAST_EMAIL_DATE}`, {
            method: 'POST',
            body: JSON.stringify({ value: Date.now() })
          });
        }
      } else {
        console.log(`[Streak] User ${email} already at stage "${currentStageName}". No move required.`);
      }
      // Ensure contact email is linked to existing box
      await ensureBoxContact(existingBox.boxKey, email);
    } else {
      // Create new box WITH email contact (so Streak links email history)
      const boxName = name || email.split('@')[0];
      
      const newBox = await streakFetch(`/pipelines/${pipelineKey}/boxes`, {
        method: 'POST',
        body: JSON.stringify({
          name: boxName,
          stageKey: targetStageKey,
          contacts: [{ email }],
        })
      }, 'v2');

      console.log(`[Streak] Created new box for ${email} in stage "${targetStage}" (contact linked)`);

      // Update notes with metadata following SOP
      const today = new Date().toISOString().split('T')[0];
      const metaObj = { stage: targetStage, ...(promoTag ? { promo: promoTag } : {}), ...meta };
      const metaStr = Object.entries(metaObj).map(([k, v]) => `${k}=${v}`).join(' ');
      const structuredNote = `[${today}] Action: Created new pipeline box from signup | Agent: Fodda App Agent | Meta: ${metaStr}`;
      
      const details = [
        `Email: ${email}`,
        `Company: ${company || 'N/A'}`,
        `Source: Self-Demo Sign-up`,
        promoTag ? `Promo: ${promoTag}` : null,
        `Date: ${new Date().toISOString()}`
      ].filter(Boolean).join('\n');

      const finalNotes = structuredNote + '\n\n' + details;

      await streakFetch(`/boxes/${newBox.boxKey}`, {
        method: 'POST',
        body: JSON.stringify({ notes: finalNotes }),
      });

      // Update Date of Last Email field if it's the unconfirmed stage
      if (targetStage === STAGE_NOT_CONFIRMED) {
        await streakFetch(`/boxes/${newBox.boxKey}/fields/${FIELD_LAST_EMAIL_DATE}`, {
          method: 'POST',
          body: JSON.stringify({ value: Date.now() })
        });
      }
    }
  } catch (err) {
    console.error(`[Streak] ❌ Error in addToStreakPipeline for ${email}:`, err);
  }
}
