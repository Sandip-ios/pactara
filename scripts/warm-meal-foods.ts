/** Bounded one-off job. Run with Bun and draft credentials, never the repo's .env.
 * Completed terms are skipped on rerun. --wait-for-budget spreads work across UTC
 * hourly windows; without it the process exits safely when the shared limiter refuses.
 * Default spacing: one term every two seconds, maximum 300 terms / three attempts.
 * Provider rows only: no accounts, owned foods, recent foods or popularity writes.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import terms from './common-meal-food-terms.json';
import { FOOD_SEARCH_VERSION, remoteMealFoods } from '../src/lib/meal-food-search.server';

const url=process.env['SUPABASE_URL'];
const key=process.env['SUPABASE_SERVICE_ROLE_KEY'];
if(!url||!key)throw new Error('Set draft Supabase credentials in the process environment.');
if(!['localhost','127.0.0.1'].includes(new URL(url).hostname)&&!process.argv.includes('--allow-hosted'))throw new Error('Hosted warming requires explicit --allow-hosted.');
const admin=createClient(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{
 const headers=new Headers(init?.headers);headers.set('apikey',key);
 if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');
 return fetch(input,{...init,headers});
}}});
const waitForBudget=process.argv.includes('--wait-for-budget');
const limit=Number(process.argv.find(a=>a.startsWith('--max-terms='))?.split('=')[1]??300);
const progress={version:FOOD_SEARCH_VERSION,total:terms.length,warmed:[] as string[],partial:[] as string[],remaining:[] as string[],limited:false};
const progressPath='/tmp/meal-food-warm-progress.json';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const controller=new AbortController();
process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());
let attempted=0;
for(const term of terms){
 const cached=await admin.from('meal_food_searches').select('query').eq('query',`${FOOD_SEARCH_VERSION}:${term}`).maybeSingle();
 if(cached.error)throw new Error('Could not read warming progress');
 if(cached.data){progress.warmed.push(term);continue;}
 if(attempted>=limit)break;
 attempted++;
 for(let attempt=0;attempt<3;attempt++){
  const result=await remoteMealFoods(admin,term,false,controller.signal);
  if('limited' in result&&result.limited){
   progress.limited=true;
   if(waitForBudget){
    writeFileSync(progressPath,JSON.stringify(progress,null,2));
    console.log('Hourly budget full. Waiting until the next UTC hour.');
    await delay(3600000-Date.now()%3600000+2000);attempt--;continue;
   }
   break;
  }
  if(!('incomplete' in result&&result.incomplete)){progress.warmed.push(term);break;}
  if(attempt===2)progress.partial.push(term);
  else await delay(2000);
 }
 progress.remaining=terms.filter(t=>!progress.warmed.includes(t));
 writeFileSync(progressPath,JSON.stringify(progress,null,2));
 console.log(`${progress.warmed.length}/${terms.length} complete; ${progress.partial.length} partial; last term: ${term}`);
 if(progress.limited&&!waitForBudget)break;
 progress.limited=false;await delay(2000);
}
progress.remaining=terms.filter(t=>!progress.warmed.includes(t));
writeFileSync(progressPath,JSON.stringify(progress,null,2));
console.log(`Finished bounded run: ${progress.warmed.length} warmed, ${progress.remaining.length} remaining.`);
