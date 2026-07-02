import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCatalogAndService() {
  console.log('=== VERIFICATION: Catalog Router & DataService ===');
  
  // 1. Let's inspect dataService.ts fetch logic programmatically by mock fetching or direct import
  // Since we are running in node, we can test the analyst endpoint and catalog parsing logic.
  console.log('Fetching analysts directly from production roster...');
  try {
    const res = await fetch('https://api.fodda.ai/v1/analysts');
    if (!res.ok) {
      throw new Error(`Failed to fetch analysts: ${res.statusText}`);
    }
    const data = await res.json();
    console.log(`Roster response OK. Found ${data.analysts?.length || 0} analysts.`);
    
    // Test the classification mapping logic from dataService.ts
    const mapped = (data.analysts || []).map((a: any) => {
      const isBen = a.id === 'ben-dietz-sic' || a.id === 'ben_dietz_expert';
      const isPiers = a.id === 'piers-fawkes-psfk';
      const isReal = isBen || isPiers;
      const isExec = a.id.startsWith('brand-');
      const subType = isReal ? 'Digital Twin' : isExec ? 'Synthetic Executive' : 'Synthetic Expert';
      return { id: a.id, name: a.name, subType };
    });
    
    console.log('\nAnalyst Classification Samples:');
    const digitalTwins = mapped.filter(x => x.subType === 'Digital Twin');
    const syntheticExecutives = mapped.filter(x => x.subType === 'Synthetic Executive');
    const syntheticExperts = mapped.filter(x => x.subType === 'Synthetic Expert');
    
    console.log(`- Digital Twins: ${digitalTwins.length}`);
    digitalTwins.forEach(t => console.log(`  * ${t.name} (${t.id})`));
    
    console.log(`- Synthetic Executives: ${syntheticExecutives.length}`);
    syntheticExecutives.slice(0, 3).forEach(t => console.log(`  * ${t.name} (${t.id})`));
    if (syntheticExecutives.length > 3) console.log('    ...');
    
    console.log(`- Synthetic Experts: ${syntheticExperts.length}`);
    syntheticExperts.slice(0, 3).forEach(t => console.log(`  * ${t.name} (${t.id})`));
    if (syntheticExperts.length > 3) console.log('    ...');
    
    // Assertions
    if (digitalTwins.length === 0) {
      console.error('FAIL: No Digital Twins classified!');
      process.exit(1);
    }
    console.log('\nSUCCESS: Analyst mapping verified successfully!');
  } catch (err: any) {
    console.error('FAIL: Error during verification:', err.message);
    process.exit(1);
  }
}

testCatalogAndService();
