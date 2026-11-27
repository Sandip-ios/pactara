import type { Food, Nutrition, Portion } from './meals';
const nutrient = (rows: Record<string, unknown>[], ids: number[]) => { const row=rows.find(n => ids.includes(Number(n['nutrientId'] ?? (n['nutrient'] as Record<string,unknown>|undefined)?.['id']))); const v=row?.['value'] ?? row?.['amount']; return typeof v==='number' ? v : null; };
export function normalizeUsdaFood(row:Record<string,unknown>):Food {
 const nutrients=(row['foodNutrients'] ?? []) as Record<string,unknown>[];
 const nutrition:Nutrition={ calories:nutrient(nutrients,[1008,2047,2048]), protein:nutrient(nutrients,[1003]), carbs:nutrient(nutrients,[1005]), fat:nutrient(nutrients,[1004]) };
 const portions:Portion[]=[];
 const serving=Number(row['servingSize']); const servingUnit=String(row['servingSizeUnit'] ?? '').toLowerCase();
 if(serving>0 && ['g','grm'].includes(servingUnit)) portions.push({unit:'serving',grams:serving});
 for(const p of (row['foodPortions'] ?? []) as Record<string,unknown>[]) { const weight=Number(p['gramWeight']);const amount=Number(p['amount'])||1; const measure=p['measureUnit'] as Record<string,unknown>|undefined; const unit=String(p['modifier']||measure?.['name']||p['portionDescription']||'serving').replace(/^\d+(?:\.\d+)?\s*/, '').trim().slice(0,50) || 'serving'; if(weight>0 && unit!=='undetermined' && !portions.some(x=>x.unit===unit)) portions.push({unit,grams:weight/amount}); }
 if(!portions.some(p=>p.unit==='g')) portions.push({unit:'g',grams:1});
 if(!portions.some(p=>p.unit==='oz')) portions.push({unit:'oz',grams:28.349523125});
 return {id:`usda:${row['fdcId']}`,name:String(row['description'] ?? 'Food').slice(0,200),portions,nutrition,yours:false};
}
export async function fetchUsda(path:string,body?:unknown):Promise<Record<string,unknown>> {
 const key=process.env['USDA_API_KEY']; if(!key) throw new Error('USDA credential unavailable');
 const response=await fetch(`https://api.nal.usda.gov/fdc/v1/${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(12000),redirect:'manual'});
 if(!response.ok) throw new Error(`USDA request status ${response.status}`);return await response.json() as Record<string,unknown>;
}
