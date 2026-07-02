import 'dotenv/config';

const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Basic ' + Buffer.from(`${STREAK_API_KEY}:`).toString('base64'),
};

async function fetchBox(boxKey) {
  const resp = await fetch(`https://api.streak.com/api/v1/boxes/${boxKey}`, {
    headers: STREAK_HEADERS,
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function run() {
  const neffKey = 'agxzfm1haWxmb29nYWVyKwsSDE9yZ2FuaXphdGlvbiIIcHNmay5jb20MCxIEQ2FzZRiAgOWq1f6SCgw';
  const mulliganKey = 'agxzfm1haWxmb29nYWVyKwsSDE9yZ2FuaXphdGlvbiIIcHNmay5jb20MCxIEQ2FzZRiAgKWp9_v8CQw';

  console.log('--- Chris Neff Streak Notes ---');
  const neff = await fetchBox(neffKey);
  console.log(neff?.notes || 'No notes found');

  console.log('\n--- Chris Mulligan Streak Notes ---');
  const mulligan = await fetchBox(mulliganKey);
  console.log(mulligan?.notes || 'No notes found');
}

run().catch(console.error);
