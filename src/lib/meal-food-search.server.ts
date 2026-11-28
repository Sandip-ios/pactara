import type { SupabaseClient } from '@supabase/supabase-js';
import { foodRelevance, foodWords, preparedFoodScore } from './food-search';
import { mealForViewer, type Food } from './meals';
import { cleanUsdaDescription, fetchUsda, normalizeUsdaFood, rankUsdaRows, capPerTier, distinctFoodNames } from './usda-foods.server';
export const FOOD_SEARCH_VERSION='v12';
export type MealFoodSearchResult={under18:boolean;foods:Food[];own:Food[];error:boolean;cached:boolean;incomplete?:boolean;limited?:boolean};
const toFood=(r:Record<string,unknown>):Food=>({id:String(r['id']),name:String(r['name']),portions:r['portions'] as Food['portions'],nutrition:r['nutrition'] as Food['nutrition'],yours:!!r['owner_id']});
export async function localMealFoods(admin:SupabaseClient,userId:string,q:string,under18:boolean,signal:AbortSignal):Promise<MealFoodSearchResult>{
 const word=foodWords(q)[0]??'';
 const [own,shared,cache]=await Promise.all([
  admin.from('meal_foods').select('*').eq('owner_id',userId).ilike('name',`%${q.replace(/[%_]/g,'')}%`).limit(30).abortSignal(signal),
  q?admin.from('meal_foods').select('*').is('owner_id',null).ilike('name',`%${word}%`).limit(150).abortSignal(signal):Promise.resolve({data:[]}),
  q?admin.from('meal_food_searches').select('food_ids').eq('query',`${FOOD_SEARCH_VERSION}:${q.toLowerCase()}`).abortSignal(signal).maybeSingle():Promise.resolve({data:null}),
 ]);
 let rows=(shared.data??[]) as Record<string,unknown>[];
 if(!q){const recent=await admin.from('meal_food_recent').select('food_id').eq('user_id',userId).order('used_at',{ascending:false}).limit(6).abortSignal(signal);const ids=(recent.data??[]).map(r=>r.food_id);if(ids.length){const r=await admin.from('meal_foods').select('*').in('id',ids).abortSignal(signal);rows=(r.data??[]).filter(r=>!r.owner_id||r.owner_id===userId);}}
 if(cache.data){const ids=cache.data.food_ids as string[];const r=await admin.from('meal_foods').select('*').in('id',ids).is('owner_id',null).abortSignal(signal);rows=ids.flatMap(id=>{const row=r.data?.find(r=>r.id===id);return row?[row]:[];});}
 else if(q)rows=rows.filter(r=>foodRelevance(String(r['name']),q).match).sort((a,b)=>foodRelevance(String(a['name']),q).score+(String(a['name']).includes(' · ')?100:0)-foodRelevance(String(b['name']),q).score-(String(b['name']).includes(' · ')?100:0));
 let foods=rows.map(r=>{const f=toFood(r);return !f.yours&&!f.name.includes(' · ')?{...f,name:cleanUsdaDescription(f.name)}:f;});
 if(q&&!cache.data){const score=(f:Food)=>{const [name,brand]=f.name.split(' · ');const relevance=foodRelevance(name??f.name,q,brand??'');return preparedFoodScore(name??f.name,q,brand??'')+(brand&&!relevance.brandAsked?100:0);};foods.sort((a,b)=>score(a)-score(b));const best=foods[0];if(best)foods=foods.filter(f=>score(f)<=score(best)+2);}
 return mealForViewer({under18,foods,own:(own.data??[]).map(toFood),error:false,cached:!!cache.data},under18);
}
export async function remoteMealFoods(admin:SupabaseClient,q:string,under18:boolean,signal:AbortSignal):Promise<MealFoodSearchResult>{
 const key=`${FOOD_SEARCH_VERSION}:${q.toLowerCase()}`;
 const cache=await admin.from('meal_food_searches').select('food_ids').eq('query',key).abortSignal(signal).maybeSingle();
 if(cache.data){const ids=cache.data.food_ids as string[];const r=await admin.from('meal_foods').select('*').in('id',ids).is('owner_id',null).abortSignal(signal);return mealForViewer({under18,foods:ids.flatMap(id=>{const row=r.data?.find(r=>r.id===id);return row?[toFood(row)]:[];}),own:[] as Food[],error:false,cached:true},under18);}
 signal.throwIfAborted();
 // Three search calls and at most two 20-ID detail calls. Reserve the whole maximum once.
 const claim=await admin.rpc('claim_meal_usda_search',{_requests:5}).abortSignal(signal);
 if(!claim.data)return {under18,foods:[] as Food[],own:[] as Food[],error:false,cached:false,incomplete:true,limited:true};
 try{
  signal.throwIfAborted();
  const providerSignal=AbortSignal.any([signal,AbortSignal.timeout(4000)]);
  const responses=await Promise.allSettled([['Foundation','SR Legacy'],['Survey (FNDDS)'],['Branded']].map(dataType=>fetchUsda('foods/search',{query:q,requireAllWords:true,pageSize:dataType[0]==='Branded'?6:dataType[0]==='Foundation'?200:50,dataType},providerSignal)));
  let incomplete=responses.some(r=>r.status==='rejected');
  const candidates=[...new Map(responses.flatMap(r=>r.status==='fulfilled'?(r.value['foods']??[]) as Record<string,unknown>[]:[]).map(r=>[r['fdcId'],r])).values()];
  const counts=candidates.length?await admin.from('meal_food_add_counts').select('food_id,adds').in('food_id',candidates.map(r=>`usda:${r['fdcId']}`)).abortSignal(signal):{data:[]};
  const adds=new Map((counts.data??[]).map(r=>[r.food_id,Number(r.adds)]));
  const raw=capPerTier(rankUsdaRows(candidates.map(r=>({...r,add_count:adds.get(`usda:${r['fdcId']}`)??0})),q)).slice(0,25);
  signal.throwIfAborted();
  const cachedFoods=raw.length?await admin.from('meal_foods').select('*').in('id',raw.map(r=>`usda:${r['fdcId']}`)).is('owner_id',null).abortSignal(signal):{data:[]};
  const byId=new Map((cachedFoods.data??[]).map(r=>[r.id,toFood(r)]));
  const missing=raw.filter(r=>!byId.has(`usda:${r['fdcId']}`));
  const batches=[];for(let i=0;i<missing.length;i+=20)batches.push(missing.slice(i,i+20));
  const responsesDetail=await Promise.allSettled(batches.map(batch=>fetchUsda('foods',{fdcIds:batch.map(r=>r['fdcId']),format:'full',nutrients:[203,204,205,208,957,958]},providerSignal)));
  incomplete ||= responsesDetail.some(r=>r.status==='rejected');
  const details=responsesDetail.flatMap(r=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value as Record<string,unknown>[]:[]);
  const available=raw.filter(r=>byId.has(`usda:${r['fdcId']}`)||details.some(d=>d['fdcId']===r['fdcId']));
  const foods=distinctFoodNames(available.map(r=>{const row={...r,...details.find(d=>d['fdcId']===r['fdcId'])};const food=normalizeUsdaFood(row);const cached=byId.get(food.id);return{row,food:cached?{...cached,name:food.name}:food};}));
  signal.throwIfAborted();
  if(foods.length){const saved=await admin.from('meal_foods').upsert(foods.map(f=>({id:f.id,owner_id:null,name:f.name,portions:f.portions,nutrition:f.nutrition}))).abortSignal(signal);if(saved.error)throw new Error('Could not cache foods');}
  if(!incomplete)await admin.from('meal_food_searches').upsert({query:key,food_ids:foods.map(f=>f.id)}).abortSignal(signal);
  return mealForViewer({under18,foods,own:[] as Food[],error:false,cached:false,incomplete},under18);
 }catch(e){if(signal.aborted)throw e;console.error('[meals] USDA search unavailable',e instanceof Error?e.message:'Request failed');return {under18,foods:[] as Food[],own:[] as Food[],error:false,cached:false,incomplete:true};}
}