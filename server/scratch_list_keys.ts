import { queryAirtable } from './db.js';
import { API_KEYS_TABLE } from './constants.js';

async function listAllKeys() {
  console.log(`Listing keys in ${API_KEYS_TABLE}`);
  const keysQuery = await queryAirtable(API_KEYS_TABLE, `NOT({API Key} = '')`);
  console.log(`Found ${keysQuery.records?.length || 0} keys.`);
  if (keysQuery.records && keysQuery.records.length > 0) {
    console.log(JSON.stringify(keysQuery.records[0], null, 2));
  }
}

listAllKeys().catch(console.error);
