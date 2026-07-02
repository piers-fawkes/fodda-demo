require('dotenv').config();
const URL = `https://api.airtable.com/v0/appXUeeWN1uD9NdCW/tblf8OPpi0F16ofAX?maxRecords=100`;
fetch(URL, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` } })
.then(r => r.json())
.then(d => console.log(JSON.stringify(d.records.map(r => r.fields), null, 2).substring(0, 1500)));
