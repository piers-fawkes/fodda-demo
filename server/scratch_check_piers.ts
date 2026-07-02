import { queryAirtable } from './db.js';
import { USERS_TABLE } from './constants.js';

async function checkPiers() {
  const email = 'piers.fawkes@psfk.com';
  console.log(`Checking user: ${email}`);
  const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
  console.log(JSON.stringify(userQuery, null, 2));
}

checkPiers().catch(console.error);
