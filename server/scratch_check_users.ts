import { queryAirtable } from './db.js';
import { USERS_TABLE } from './constants.js';

async function checkUsers() {
  const email = 'ben.dietz@gmail.com';
  console.log(`Checking users for email: ${email}`);
  const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
  console.log(JSON.stringify(userQuery, null, 2));
}

checkUsers().catch(console.error);
