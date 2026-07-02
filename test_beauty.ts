import fetch from "node-fetch";

const API_KEY = process.env.FODDA_API_KEY || 'test-key';
const BASE_URL = 'https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app';

async function run() {
    const url = `${BASE_URL}/v1/graphs/beauty/search`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-Fodda-Execution-Mode': 'direct'
        },
        body: JSON.stringify({ query: 'ar try-on', limit: 3 })
    });
    const json = await response.json();
    console.log(JSON.stringify(json, null, 2));
}

run();
