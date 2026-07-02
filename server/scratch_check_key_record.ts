import { queryAirtable } from './db.js';
import { API_KEYS_TABLE } from './constants.js';

async function checkKeyRecord() {
  const recordId = 'rechLtGfk8z7CXoto';
  console.log(`Checking key record: ${recordId}`);
  const keyQuery = await queryAirtable(API_KEYS_TABLE, `RECORD_ID() = '${recordId}'`);
  console.log(JSON.stringify(keyQuery, null, 2));
}

checkKeyRecord().catch(console.error);
