import { queryAirtable } from './db.js';
import { TRIALS_TABLE } from './constants.js';

async function checkTrials() {
  console.log(`Checking trials table: ${TRIALS_TABLE}`);
  const trialsQuery = await queryAirtable(TRIALS_TABLE, `OR(FIND('sic', LOWER({graph_id})), FIND('sic', LOWER({trial_key})))`);
  console.log(JSON.stringify(trialsQuery, null, 2));
}

checkTrials().catch(console.error);
