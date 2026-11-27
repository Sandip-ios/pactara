import type { Food, Nutrition, Portion } from './meals';
const nutrient = (rows: Record<string, unknown>[], ids: number[]) => { const row=rows.find(n => ids.includes(Number(n['nutrientId'] ?? (n['nutrient'] as Record<string,unknown>|undefined)?.['id']))); const v=row?.['value'] ?? row?.['amount']; return typeof v==='number' ? v : null; };
export function normalizeUsdaFood(row:Record<string,unknown>):Food {
 const nutrients=(row['foodNutrients'] ?? []) as Record<string,unknown>[];
 const nutrition:Nutrition={ calories:nutrient(nutrients,[1008,2047,2048]), protein:nutrient(nutrients,[1003]), carbs:nutrient(nutrients,[1005]), fat:nutrient(nutrients,[1004]) };
 const portions:Portion[]=[];
 const serving=Number(row['servingSize']); const servingUnit=String(row['servingSizeUnit'] ?? '').toLowerCase();
 const household=String(row['householdServingFullText']??'');const match=household.match(/^(\d+(?:\.\d+)?)\s+(cup|tbsp|tsp|piece|slice|scoop)s?\b/i);
 if(serving>0 && ['g','grm'].includes(servingUnit)) portions.push({unit:match?.[2]?.toLowerCase()??'serving',grams:serving/(Number(match?.[1])||1)});
 for(const p of (row['foodPortions'] ?? []) as Record<string,unknown>[]) { const weight=Number(p['gramWeight']);const amount=Number(p['amount'])||1; const measure=p['measureUnit'] as Record<string,unknown>|undefined; const unit=String(p['modifier']||measure?.['name']||p['portionDescription']||'serving').replace(/^\d+(?:\.\d+)?\s*/, '').trim().slice(0,50) || 'serving'; if(weight>0 && unit!=='undetermined' && !portions.some(x=>x.unit===unit)) portions.push({unit,grams:weight/amount}); }
 portions.sort((a,b)=>Number(a.unit==='serving')-Number(b.unit==='serving'));
 if(!portions.some(p=>p.unit==='g')) portions.push({unit:'g',grams:1});
 if(!portions.some(p=>p.unit==='oz')) portions.push({unit:'oz',grams:28.349523125});
 return {id:`usda:${row['fdcId']}`,name:usdaFoodName(row),portions,nutrition,yours:false};
}
export function usdaFoodName(row:Record<string,unknown>) {
 const raw=String(row['description']??'Food').toLowerCase().trim();
 const rice=/^rice,?\s+(white|brown).*\bcooked\b/.exec(raw);
 const label=rice?`${rice[1]} rice, cooked`:raw;
 const name=label.charAt(0).toUpperCase()+label.slice(1);
 const brand=String(row['brandOwner']??row['brandName']??'').trim();
 return `${name}${row['dataType']==='Branded'&&brand?` · ${brand}`:''}`.slice(0,200);
}
export function rankUsdaRows(rows:Record<string,unknown>[],query='') { const rank=(r:Record<string,unknown>)=>r['dataType']==='Foundation'?0:r['dataType']==='SR Legacy'?1:r['dataType']==='Survey (FNDDS)'?2:3;const direct=(r:Record<string,unknown>)=>query.toLowerCase()==='rice'?Number(!/^(White|Brown) rice, cooked$/.test(usdaFoodName(r))):0;return [...rows].sort((a,b)=>rank(a)-rank(b)||direct(a)-direct(b)||(query.toLowerCase()==='rice'?Number(b['fdcId']===168878)-Number(a['fdcId']===168878):0)); }
export async function fetchUsda(path:string,body?:unknown):Promise<Record<string,unknown>> {
 const key=process.env['USDA_API_KEY']; if(!key) throw new Error('USDA credential unavailable');
 const response=await fetch(`https://api.nal.usda.gov/fdc/v1/${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(12000),redirect:'manual'});
 if(!response.ok) throw new Error(`USDA request status ${response.status}`);return await response.json() as Record<string,unknown>;
}
