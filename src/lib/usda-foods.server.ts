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
 // Drop descriptors after the comma unless another portion shares the base unit.
 const base=(u:string)=>u.split(',')[0]!.trim();for(const p of portions){const b=base(p.unit);if(b!==p.unit&&portions.filter(x=>base(x.unit)===b).length===1)p.unit=b;}
 if(!portions.some(p=>p.unit==='g')) portions.push({unit:'g',grams:1});
 if(!portions.some(p=>p.unit==='oz')) portions.push({unit:'oz',grams:28.349523125});
 return {id:`usda:${row['fdcId']}`,name:usdaFoodName(row),portions,nutrition,yours:false};
}
const CATEGORY_PREFIXES=new Set(['cereals','cereals ready-to-eat','fish','spices','beverages','vegetables','fruits','nuts','seeds','poultry']);
const FILLER=new Set(['regular','enriched','unenriched','meat only','skinless','boneless','broiler or fryers','broilers or fryers','without salt','fresh','nfs','not fortified','ns as to form']);
const LEADING=new Set(['white','brown','wild','whole','atlantic','pink','sockeye','coho','chinook','rolled','steel cut','ground','sweet','red','green','black','jasmine','basmati']);
const PARTS=new Set(['breast','thigh','wing','drumstick','leg','fillet','yolk','white','tenders']);
/** Turns a USDA generic description into a natural name that keeps what sets the variant apart. */
/** Keeps USDA's capitals for proper nouns; words written in all caps become title case. */
export function usdaCase(text:string) { return text.replace(/\b[A-Z][A-Z'&]+\b/g,w=>w.charAt(0)+w.slice(1).toLowerCase()); }
export function cleanUsdaDescription(description:string,keepFiller=false) {
 let t=usdaCase(description).replace(/\s*\(includes [^)]*\)/gi,'').split(',').map(x=>x.trim()).filter(Boolean);
 if(t[0])t[0]=t[0].charAt(0).toLowerCase()+t[0].slice(1);
 const low=(x:string|undefined)=>x?.toLowerCase();
 if(t.length>1&&CATEGORY_PREFIXES.has(low(t[0])!))t=t.slice(1);
 if(!keepFiller)t=t.filter((x,i)=>i===0||!FILLER.has(x.toLowerCase()));
 const [head,next,...rest]=t;if(!head)return 'Food';
 let lead=head;let tail=next===undefined?[]:[next,...rest];
 if(next&&PARTS.has(low(next)!)&&(low(next)!=='white'||low(head)==='egg')){lead=`${head} ${next}`;tail=rest;}
 else if(next&&LEADING.has(low(next)!)){lead=`${next} ${head}`;tail=rest;}
 const label=[lead,...tail].join(', ');
 return label.charAt(0).toUpperCase()+label.slice(1);
}
export function usdaFoodName(row:Record<string,unknown>,keepFiller=false) {
 const raw=String(row['description']??'Food').trim();
 const branded=row['dataType']==='Branded';
 const name=branded?(raw===raw.toUpperCase()?raw.toLowerCase():usdaCase(raw)).replace(/^./,c=>c.toUpperCase()):cleanUsdaDescription(raw,keepFiller);
 const brand=usdaCase(String(row['brandOwner']??row['brandName']??'').trim());
 return `${name}${branded&&brand?` · ${brand}`:''}`.slice(0,200);
}
const TIER:Record<string,number>={'Foundation':0,'SR Legacy':1,'Survey (FNDDS)':2};
/** One name, one food: when cleaned names clash, generic foods keep the highest tier (Foundation, SR Legacy, Survey) and branded foods keep the first. */
export function distinctFoodNames(entries:{food:Food;row:Record<string,unknown>}[]):Food[] {
 const tier=(e:{row:Record<string,unknown>})=>TIER[String(e.row['dataType'])]??3;
 const kept=new Map<string,{food:Food;row:Record<string,unknown>;i:number}>();
 entries.forEach((e,i)=>{const prev=kept.get(e.food.name);if(!prev||tier(e)<tier(prev))kept.set(e.food.name,{...e,i:prev?prev.i:i});});
 return [...kept.values()].sort((a,b)=>a.i-b.i).map(e=>({...e.food}));
}
/** Ready-to-eat forms (cooked, boiled, steamed…) before plain ones, and raw, dry or flour forms last. */
export function preparedOrder(r:Record<string,unknown>) { const d=String(r['description']??'').toLowerCase(); return /\b(cooked|boiled|steamed|roasted|baked|grilled|braised|poached|prepared|scrambled|fried)\b/.test(d)?0:/\b(raw|dry|uncooked|flour)\b/.test(d)?2:1; }
/** Distinct cleaned names kept per generic tier, so near-duplicates don't push plain forms out. */
export function capPerTier(rows:Record<string,unknown>[],limit=12) { const seen=new Map<string,Set<string>>();return rows.filter(r=>{const t=String(r['dataType']);if(t==='Branded')return true;const set=seen.get(t)??new Set<string>();seen.set(t,set);const name=cleanUsdaDescription(String(r['description']??''));if(set.has(name))return true;if(set.size>=limit)return false;set.add(name);return true;}); }
/** Generic tiers first (Foundation, SR Legacy, Survey, then Branded); inside a tier, foods named for the query come first. */
export function rankUsdaRows(rows:Record<string,unknown>[],query='') {
 rows=rows.filter(r=>query.toLowerCase().split(/\s+/).filter(Boolean).every(w=>String(r['description']??'').toLowerCase().includes(w)));
 const rank=(r:Record<string,unknown>)=>r['dataType']==='Foundation'?0:r['dataType']==='SR Legacy'?1:r['dataType']==='Survey (FNDDS)'?2:3;
 const q=query.toLowerCase().trim();const head=(r:Record<string,unknown>)=>String(r['description']??'').toLowerCase().split(',')[0]!.trim();
 const match=(r:Record<string,unknown>)=>!q?0:head(r)===q?0:head(r).startsWith(q)||q.split(/\s+/).every(w=>head(r).includes(w))?1:2;
 const parts=(r:Record<string,unknown>)=>r['dataType']==='Branded'?0:cleanUsdaDescription(String(r['description']??'')).split(',').length;
 return rows.map((r,i)=>({r,i})).sort((a,b)=>rank(a.r)-rank(b.r)||match(a.r)-match(b.r)||parts(a.r)-parts(b.r)||preparedOrder(a.r)-preparedOrder(b.r)||a.i-b.i).map(x=>x.r);
}
export async function fetchUsda(path:string,body?:unknown):Promise<Record<string,unknown>> {
 const key=process.env['USDA_API_KEY']; if(!key) throw new Error('USDA credential unavailable');
 const response=await fetch(`https://api.nal.usda.gov/fdc/v1/${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(20000),redirect:'manual'});
 if(!response.ok) throw new Error(`USDA request status ${response.status}`);return await response.json() as Record<string,unknown>;
}
