// Quick check: what fields does the Paralogy row have in Airtable Graph List?
import 'dotenv/config';

const BASE_ID = 'appXUeeWN1uD9NdCW';
const GRAPH_LIST_TABLE = 'tblf8OPpi0F16ofAX';
const PAT = process.env.AIRTABLE_PAT;

const url = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_LIST_TABLE}?filterByFormula=${encodeURIComponent(`{graphId} = 'paralogy'`)}`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
const data = await res.json();

if (data.records?.length) {
  console.log('=== Paralogy row fields ===');
  console.log(JSON.stringify(data.records[0].fields, null, 2));
} else {
  console.log('No Paralogy row found. Checking for case variations...');
  // Try broader search
  const url2 = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_LIST_TABLE}?filterByFormula=${encodeURIComponent(`FIND('paralogy', LOWER({graphId}))`)}`;
  const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${PAT}` } });
  const data2 = await res2.json();
  if (data2.records?.length) {
    console.log('Found with case variation:');
    console.log(JSON.stringify(data2.records[0].fields, null, 2));
  } else {
    // Check for skill type graphs
    const url3 = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_LIST_TABLE}?filterByFormula=${encodeURIComponent(`{graphType} = 'skill'`)}`;
    const res3 = await fetch(url3, { headers: { Authorization: `Bearer ${PAT}` } });
    const data3 = await res3.json();
    console.log(`Found ${data3.records?.length || 0} skill-type rows:`);
    data3.records?.forEach((r) => {
      console.log(`  - ${r.fields.graphId}: ${r.fields['Graph Name'] || r.fields.name}`);
      console.log(`    Fields:`, JSON.stringify(r.fields, null, 2));
    });
  }
}
