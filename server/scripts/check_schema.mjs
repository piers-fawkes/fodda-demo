import dotenv from 'dotenv';
dotenv.config();

const BASE_ID = 'appXUeeWN1uD9NdCW';
const CE_BASE_ID = 'appnYwCT6QlDSy5i3';
const PAT = process.env.AIRTABLE_PAT;

async function getSchema(baseId, label, targetTableIds) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${PAT}` }
  });
  const data = await res.json();
  for (const table of (data.tables || [])) {
    if (targetTableIds.includes(table.id) || targetTableIds.includes(table.name)) {
      console.log(`\n=== ${label}: ${table.name} (${table.id}) ===`);
      for (const f of table.fields) {
        console.log(`  ${f.name} [${f.type}]`);
      }
    }
  }
}

(async () => {
  await getSchema(BASE_ID, 'APP REGISTRY', ['tblezSucv8qmbSSy9']);
  await getSchema(CE_BASE_ID, 'CE GRAPHS', ['Graphs']);
})();
