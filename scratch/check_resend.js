import 'dotenv/config';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function run() {
  // Resend only returns 100 most recent. Let's check with pagination to go further back.
  // Also check what the earliest email in the 100 is, so we know the time window.
  
  const res = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` }
  });
  const data = await res.json();
  const emails = data.data || data || [];
  
  // Show time range of the 100 emails
  if (emails.length > 0) {
    const oldest = emails[emails.length - 1];
    const newest = emails[0];
    console.log(`Time range of 100 emails: ${oldest.created_at} → ${newest.created_at}`);
  }

  // Now check: when was David's Airtable record created?
  // His user record was found, let's check the account creation date
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const BASE_ID = 'appXUeeWN1uD9NdCW';
  const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
  
  const userRes = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?filterByFormula=${encodeURIComponent("LOWER({email}) = 'dcutler@eatmedia.com'")}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
  );
  const userData = await userRes.json();
  const user = userData.records?.[0];
  if (user) {
    console.log(`\nDavid's Airtable record created: ${user.createdTime}`);
  }
  
  // Check if the "First prompts" email suggests someone DID trigger onboarding
  // That email is ONBOARDING_PROMPTS or CLIENT_WELCOME_PROMPTS - sent 5 min after /confirm
  // But David's clerkUserId is NOT SET and he's never logged in...
  // So who triggered that prompts email?
  
  // Search for ALL emails to David, paginating
  let allDavidEmails = [];
  let hasMore = true;
  let cursor = undefined;
  
  while (hasMore) {
    let url = 'https://api.resend.com/emails?limit=100';
    if (cursor) url += `&starting_after=${cursor}`;
    
    const pageRes = await fetch(url, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` }
    });
    
    if (!pageRes.ok) {
      console.error('Pagination error:', pageRes.status);
      break;
    }
    
    const pageData = await pageRes.json();
    const pageEmails = pageData.data || pageData || [];
    
    if (pageEmails.length === 0) { hasMore = false; break; }
    
    const matches = pageEmails.filter(e => {
      const to = Array.isArray(e.to) ? e.to : [e.to];
      return to.some(addr => 
        addr?.toLowerCase().includes('dcutler') || 
        addr?.toLowerCase().includes('dctcutler') ||
        addr?.toLowerCase().includes('eatmedia')
      );
    });
    
    allDavidEmails.push(...matches);
    
    // Check if we've gone far enough back (before David's signup)
    const lastEmail = pageEmails[pageEmails.length - 1];
    if (user && new Date(lastEmail.created_at) < new Date(user.createdTime)) {
      console.log(`\nReached emails before David's signup (${lastEmail.created_at}). Stopping.`);
      hasMore = false;
    } else {
      cursor = lastEmail.id;
    }
    
    // Safety: don't do more than 5 pages
    if (allDavidEmails.length > 0 || !cursor) break;
  }
  
  console.log(`\n=== All Resend emails to David ===`);
  console.log(`Found: ${allDavidEmails.length}`);
  for (const e of allDavidEmails) {
    console.log(`  ${e.created_at} | ${e.subject} | ${e.last_event}`);
  }
}

run().catch(console.error);
