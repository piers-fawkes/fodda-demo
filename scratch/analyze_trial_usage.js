import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const TRIALS_TABLE = 'tblKZ7VRjGrcZkw7B'; // Trials table
const LOGS_TABLE_QUESTIONS = 'tblvHx1DzwuTq3TJE'; // Questions logs

async function analyzeTrials() {
    console.log("Analyzing trial usage data from Airtable...");
    
    // 1. Fetch from TRIALS_TABLE
    let trialsUrl = `https://api.airtable.com/v0/${BASE_ID}/${TRIALS_TABLE}`;
    let trials = [];
    try {
        const res = await fetch(trialsUrl, {
            headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
        });
        if (res.ok) {
            const data = await res.json();
            trials = data.records || [];
        } else {
            console.error("Failed to query TRIALS_TABLE:", await res.text());
        }
    } catch (e) {
        console.error("Error reading TRIALS_TABLE:", e);
    }

    if (trials.length > 0) {
        console.log(`\n--- TRIALS TABLE ANALYSIS (${trials.length} records) ---`);
        let totalUsed = 0;
        let activeCount = 0;
        let activeUsed = 0;
        let exhaustedCount = 0;
        let exhaustedUsed = 0;
        
        for (const t of trials) {
            const used = Number(t.fields.tokens_used || t.fields.tokensUsed || 0);
            const status = t.fields.status || 'active';
            
            totalUsed += used;
            if (status === 'exhausted') {
                exhaustedCount++;
                exhaustedUsed += used;
            } else {
                activeCount++;
                activeUsed += used;
            }
        }
        
        console.log(`Average tokens used (overall): ${(totalUsed / trials.length).toFixed(1)}`);
        if (exhaustedCount > 0) {
            console.log(`Average tokens used for Exhausted trials: ${(exhaustedUsed / exhaustedCount).toFixed(1)} (count: ${exhaustedCount})`);
        }
        if (activeCount > 0) {
            console.log(`Average tokens used for Active trials: ${(activeUsed / activeCount).toFixed(1)} (count: ${activeCount})`);
        }
    }

    // 2. Fetch from LOGS_TABLE_QUESTIONS for trial sources
    // Formula to find trial logs: OR(LEFT({accessKey}, 9) = 'sk_trial_', {source} = 'trial')
    const filter = `OR(LEFT({accessKey}, 9) = 'sk_trial_', {source} = 'trial')`;
    let logsUrl = `https://api.airtable.com/v0/${BASE_ID}/${LOGS_TABLE_QUESTIONS}?filterByFormula=${encodeURIComponent(filter)}&maxRecords=1000`;
    let logs = [];
    try {
        let offset = '';
        do {
            const url = logsUrl + (offset ? `&offset=${offset}` : '');
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
            });
            if (res.ok) {
                const data = await res.json();
                logs.push(...(data.records || []));
                offset = data.offset;
            } else {
                console.error("Failed to query LOGS_TABLE_QUESTIONS:", await res.text());
                break;
            }
        } while (offset && logs.length < 3000);
    } catch (e) {
        console.error("Error reading LOGS_TABLE_QUESTIONS:", e);
    }

    if (logs.length > 0) {
        console.log(`\n--- QUESTIONS LOG ANALYSIS (${logs.length} trial queries found) ---`);
        // Group queries by userEmail or accessKey
        const userQueryCounts = {};
        for (const log of logs) {
            // Identify user: prioritize userEmail if it's not generic/anonymous, otherwise accessKey
            let identifier = log.fields.userEmail || log.fields.accessKey || 'anonymous';
            if (identifier === 'anonymous' || identifier.startsWith('sk_trial_')) {
                // If it's a shared key without email, use key as is
                identifier = log.fields.accessKey || 'anonymous';
            }
            
            userQueryCounts[identifier] = (userQueryCounts[identifier] || 0) + 1;
        }

        const counts = Object.values(userQueryCounts);
        const totalUsers = counts.length;
        const totalQueries = counts.reduce((a, b) => a + b, 0);
        
        console.log(`Total unique trial identifiers (emails or keys): ${totalUsers}`);
        console.log(`Average queries per trial identifier: ${(totalQueries / totalUsers).toFixed(1)}`);
        
        // Distribution
        let singleQueryCount = counts.filter(c => c === 1).length;
        let twoToFiveCount = counts.filter(c => c >= 2 && c <= 5).length;
        let sixToTenCount = counts.filter(c => c >= 6 && c <= 10).length;
        let tenPlusCount = counts.filter(c => c > 10).length;
        
        console.log(`Distribution of queries per trial user:`);
        console.log(`  1 query: ${singleQueryCount} (${((singleQueryCount/totalUsers)*100).toFixed(1)}%)`);
        console.log(`  2-5 queries: ${twoToFiveCount} (${((twoToFiveCount/totalUsers)*100).toFixed(1)}%)`);
        console.log(`  6-10 queries: ${sixToTenCount} (${((sixToTenCount/totalUsers)*100).toFixed(1)}%)`);
        console.log(`  10+ queries: ${tenPlusCount} (${((tenPlusCount/totalUsers)*100).toFixed(1)}%)`);
        
        // Top users
        const sortedUsers = Object.entries(userQueryCounts).sort((a, b) => b[1] - a[1]);
        console.log(`\nTop active trial users:`);
        sortedUsers.slice(0, 5).forEach(([user, count]) => {
            console.log(`  ${user}: ${count} queries`);
        });
    } else {
        console.log("\nNo trial logs found in QUESTIONS_TABLE.");
    }
}

analyzeTrials();
