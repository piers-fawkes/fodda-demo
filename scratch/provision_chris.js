import 'dotenv/config';

const FODDA_INTERNAL_KEY = process.env.FODDA_INTERNAL_API_KEY || 'fodda-internal-service-key';

async function provisionChris() {
  console.log('--- Provisioning Trial for Chris Neff ---');
  
  const res = await fetch('https://app.fodda.ai/api/account/trial-provision', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-fodda-internal-key': FODDA_INTERNAL_KEY,
    },
    body: JSON.stringify({
      email: 'cneff@anomaly.com',
      firstName: 'Chris',
      lastName: 'Neff',
      company: 'Anomaly',
      suppressEmail: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to provision trial (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

provisionChris().catch(console.error);
