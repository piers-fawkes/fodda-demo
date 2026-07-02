// Set skillAttribution to 🔀 for Paralogy
import 'dotenv/config';

const BASE_ID = 'appXUeeWN1uD9NdCW';
const GRAPH_LIST_TABLE = 'tblf8OPpi0F16ofAX';
const PAT = process.env.AIRTABLE_PAT;
const RECORD_ID = 'reckCFsFO8qFUh94l';

const url = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_LIST_TABLE}/${RECORD_ID}`;

const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${PAT}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ fields: { skillAttribution: '🔀' } }),
});

const data = await res.json();
if (res.ok) {
  console.log('✅ skillAttribution set to:', data.fields.skillAttribution);
} else {
  console.error('❌', data.error?.message);
}
