import { queryAirtable } from './db.js';
import { API_KEYS_TABLE } from './constants.js';

async function testQuery() {
  const accountId = 'recwhwOGGYX3hddsr';
  const filter = `AND({Account} = '${accountId}', {API Key Status} = 'Active')`;
  console.log(`Testing query: ${filter}`);
  const keysQuery = await queryAirtable(API_KEYS_TABLE, filter);
  console.log(JSON.stringify(keysQuery, null, 2));
}

testQuery().catch(console.error);
