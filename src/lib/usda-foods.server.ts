import type { Food, Nutrition, Portion } from './meals';
const nutrient = (rows: Record<string, unknown>[], ids: number[]) => { const row=rows.find(n => ids.includes(Number(n['nutrientId'] ?? (n['nutrient'] as Record<string,unknown>|undefined)?.['id']))); const v=row?.['value'] ?? row?.['amount']; return typeof v==='number' ? v : null; };
export function normalizeUsdaFood(row:Record<string,unknown>):Food {
 const nutrients=(row['foodNutrients'] ?? []) as Record<string,unknown>[];
 const nutrition:Nutrition={ calories:nutrient(nutrients,[1008,2047,2048]), protein:nutrient(nutrients,[1003]), carbs:nutrient(nutrients,[1005]), fat:nutrient(nutrients,[1004]) };
 const portions:Portion[]=[];
 const serving=Number(row['servingSize']); const servingUnit=String(row['servingSizeUnit'] ?? '').toLowerCase();
 const household=String(row['householdServingFullText']??'');const match=household.match(/^(\d+(?:\.\d+)?)\s+(cup|tbsp|tsp|piece|slice|scoop)s?\b/i);
 if(serving>0 && ['g','grm'].includes(servingUnit)) portions.push({unit:match?.[2]?.toLowerCase()??'serving',grams:serving/(Number(match?.[1])||1)});
 for(const p of (row['foodPortions'] ?? []) as Record<string,unknown>[]) { const weight=Number(p['gramWeight']);const amount=Number(p['amount'])||1; const measure=p['measureUnit'] as Record<string,unknown>|undefined; const unit=String(p['modifier']||measure?.['name']||p['portionDescription']||'serving').replace(/^\d+(?:\.\d+)?\s*/, '').replace(/\s*\([^)]*\)/g,'').trim().slice(0,50) || 'serving'; if(weight>0 && unit!=='undetermined' && !/^racc$/i.test(unit) && !portions.some(x=>x.unit===unit)) portions.push({unit,grams:weight/amount}); }
 portions.sort((a,b)=>Number(a.unit==='serving')-Number(b.unit==='serving'));
 if(!portions.some(p=>p.unit==='g')) portions.push({unit:'g',grams:1});
 if(!portions.some(p=>p.unit==='oz')) portions.push({unit:'oz',grams:28.349523125});
 return {id:`usda:${row['fdcId']}`,name:usdaFoodName(row),portions,nutrition,yours:false};
}
const CATEGORY_PREFIXES=new Set(['cereals','cereals ready-to-eat','fish','spices','beverages','vegetables','fruits','nuts','seeds','poultry']);
const FILLER=new Set(['regular','enriched','unenriched','meat only','skinless','boneless','broiler or fryers','broilers or fryers','without salt','fresh','nfs','not fortified','ns as to form']);
const LEADING=new Set(['white','brown','wild','whole','atlantic','pink','sockeye','coho','chinook','rolled','steel cut','ground','sweet','red','green','black','jasmine','basmati']);
const PARTS=new Set(['breast','thigh','wing','drumstick','leg','fillet','yolk','white','tenders']);
/** Turns a USDA generic description into a natural name that keeps what sets the variant apart. */
export function cleanUsdaDescription(description:string,keepFiller=false) {
 let t=description.toLowerCase().replace(/\s*\(includes [^)]*\)/g,'').split(',').map(x=>x.trim()).filter(Boolean);
 if(t.length>1&&CATEGORY_PREFIXES.has(t[0]!))t=t.slice(1);
 if(!keepFiller)t=t.filter((x,i)=>i===0||!FILLER.has(x));
 const [head,next,...rest]=t;if(!head)return 'Food';
 let lead=head;let tail=next===undefined?[]:[next,...rest];
 if(next&&PARTS.has(next)&&(next!=='white'||head==='egg')){lead=`${head} ${next}`;tail=rest;}
 else if(next&&LEADING.has(next)){lead=`${next} ${head}`;tail=rest;}
 const label=[lead,...tail].join(', ');
 return label.charAt(0).toUpperCase()+label.slice(1);
}
export function usdaFoodName(row:Record<string,unknown>,keepFiller=false) {
 const raw=String(row['description']??'Food').trim();
 const branded=row['dataType']==='Branded';
 const name=branded?(raw.toLowerCase().replace(/^./,c=>c.toUpperCase())):cleanUsdaDescription(raw,keepFiller);
 const brand=String(row['brandOwner']??row['brandName']??'').trim();
 return `${name}${branded&&brand?` · ${brand}`:''}`.slice(0,200);
}
const SOURCE:Record<string,string>={'Foundation':'lab tested','SR Legacy':'reference','Survey (FNDDS)':'as eaten'};
const nutritionKey=(f:Food)=>JSON.stringify(f.nutrition?(['calories','protein','carbs','fat'] as const).map(k=>f.nutrition?.[k]==null?null:Math.round(f.nutrition[k]??0)):null);
/** Same name must mean same numbers: give clashing foods a fuller qualifier, then a source label. */
export function distinctFoodNames(entries:{food:Food;row:Record<string,unknown>}[]):Food[] {
 const clash=(list:{food:Food}[],f:Food)=>list.some(e=>e.food!==f&&e.food.name===f.name&&nutritionKey(e.food)!==nutritionKey(f));
 let list=entries.map(e=>({...e,food:{...e.food}}));
 const pass=(rename:(e:{food:Food;row:Record<string,unknown>})=>string)=>{const flagged=list.filter(e=>clash(list,e.food));for(const e of flagged)e.food.name=rename(e);};
 pass(e=>usdaFoodName(e.row,true));
 pass(e=>{const src=SOURCE[String(e.row['dataType'])];return src?`${e.food.name} (${src})`:e.food.name;});
 pass(e=>e.food.nutrition?.calories!=null?`${e.food.name} (${Math.round(e.food.nutrition.calories)} cal per 100 g)`:e.food.name);
 list=list.filter((e,i)=>!list.slice(0,i).some(o=>o.food.name===e.food.name&&nutritionKey(o.food)===nutritionKey(e.food)));
 return list.map(e=>e.food);
}
/** Generic tiers first (Foundation, SR Legacy, Survey, then Branded); inside a tier, foods named for the query come first. */
export function rankUsdaRows(rows:Record<string,unknown>[],query='') {
 rows=rows.filter(r=>query.toLowerCase().split(/\s+/).filter(Boolean).every(w=>String(r['description']??'').toLowerCase().includes(w)));
 const rank=(r:Record<string,unknown>)=>r['dataType']==='Foundation'?0:r['dataType']==='SR Legacy'?1:r['dataType']==='Survey (FNDDS)'?2:3;
 const q=query.toLowerCase().trim();const head=(r:Record<string,unknown>)=>String(r['description']??'').toLowerCase().split(',')[0]!.trim();
 const match=(r:Record<string,unknown>)=>!q?0:head(r)===q?0:head(r).startsWith(q)||q.split(/\s+/).every(w=>head(r).includes(w))?1:2;
 return rows.map((r,i)=>({r,i})).sort((a,b)=>rank(a.r)-rank(b.r)||match(a.r)-match(b.r)||String(a.r['description']??'').split(',').length-String(b.r['description']??'').split(',').length||a.i-b.i).map(x=>x.r);
}
export async function fetchUsda(path:string,body?:unknown):Promise<Record<string,unknown>> {
 const key=process.env['USDA_API_KEY']; if(!key) throw new Error('USDA credential unavailable');
 const response=await fetch(`https://api.nal.usda.gov/fdc/v1/${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(20000),redirect:'manual'});
 if(!response.ok) throw new Error(`USDA request status ${response.status}`);return await response.json() as Record<string,unknown>;
}
