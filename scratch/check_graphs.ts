import 'dotenv/config';
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/all_graphs.json', 'utf8'));

const typeCounts: Record<string, number> = {};
const subTypeCounts: Record<string, number> = {};
const expertGraphs: any[] = [];

for (const r of data) {
  const t = r.fields.graphType || 'undefined';
  const st = r.fields.graphSubType || 'undefined';
  
  typeCounts[t] = (typeCounts[t] || 0) + 1;
  subTypeCounts[st] = (subTypeCounts[st] || 0) + 1;
  
  if (t === 'expert') {
    expertGraphs.push(r.fields);
  }
}

console.log('Graph Type counts:', typeCounts);
console.log('Graph Sub Type counts:', subTypeCounts);
console.log('Expert Graphs:', expertGraphs);
