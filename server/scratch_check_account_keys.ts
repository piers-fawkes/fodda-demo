import { queryAirtable } from './db.js';
import { API_KEYS_TABLE } from './constants.js';

async function checkAccountKeys() {
  const accountId = 'recwhwOGGYX3hddsr';
  console.log(`Checking keys for account: ${accountId}`);
  const keysQuery = await queryAirtable(API_KEYS_TABLE, `FIND('${accountId}', {Account})`);
  console.log(JSON.stringify(keysQuery, null, 2));
}

checkAccountKeys().catch(console.error);
