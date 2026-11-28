import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { mealInputSchema, mealForViewer, nutritionSchema, uniqueFoodResults, rankFoodResults, type Food, type MealSnapshot } from './meals';
import { mealAccess, loadMeals, visibleMealOwner, saveMealServer, attachmentSnapshot } from './meals.server';
const idSchema=z.object({id:z.string().uuid()});
export const getMeals=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({target:z.string().uuid().nullable().default(null),q:z.string().max(80).default(''),type:z.string().nullable().default(null),discover:z.boolean().default(false)}).parse(i)).handler(({context,data})=>loadMeals(context,data.target,data.q,data.type,data.discover));
export const getMeal=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>idSchema.parse(i)).handler(async({context,data})=>{const {admin}=await mealAccess(context);const {data:row}=await admin.from('meals').select('user_id').eq('id',data.id).maybeSingle();if(!row) return null;const result=await loadMeals(context,row.user_id);return result.meals.find(m=>m.id===data.id)??null;});
export const saveMeal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>mealInputSchema.parse(i)).handler(({context,data})=>saveMealServer(context,data));
export const removeMeal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>idSchema.parse(i)).handler(async({context,data})=>{const {admin}=await mealAccess(context);const {error}=await admin.from('meals').delete().eq('id',data.id).eq('user_id',context.userId);if(error) throw new Error('Could not remove meal');return {ok:true};});
export const copyMeal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>idSchema.parse(i)).handler(async({context,data})=>{
 const {admin}=await mealAccess(context);const {data:row}=await admin.from('meals').select('*').eq('id',data.id).maybeSingle();if(!row||row.user_id===context.userId||!await visibleMealOwner(context,row.user_id)) throw new Error('Meal unavailable');
 const {data:name}=await admin.from('profiles').select('name').eq('id',row.user_id).maybeSingle();
 const {data:existing}=await admin.from('meals').select('id').eq('source_meal_id',row.id).eq('user_id',context.userId).maybeSingle();if(existing) return {id:existing.id};
 const {data:copy,error}=await admin.from('meals').insert({user_id:context.userId,name:row.name,snapshot:row.snapshot,source_meal_id:row.id,source_user_id:row.user_id,source_name:(name?.name??'Member').trim()}).select('id').maybeSingle();
 if(error) {const {data:retry}=await admin.from('meals').select('id').eq('source_meal_id',row.id).eq('user_id',context.userId).maybeSingle();if(retry) return {id:retry.id};throw new Error('Could not add meal');}return {id:copy?.id??null};
});
export const getMealAttachment=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>idSchema.extend({kind:z.enum(['post','checkin'])}).parse(i)).handler(({context,data})=>attachmentSnapshot(context,data.kind,data.id));
export const copyMealAttachment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>idSchema.extend({kind:z.enum(['post','checkin'])}).parse(i)).handler(async({context,data})=>{
 const visible=await attachmentSnapshot(context,data.kind,data.id);if(!visible) throw new Error('Meal unavailable');const {admin}=await mealAccess(context);const {data:row}=await admin.from('meal_attachments').select('*').eq('kind',data.kind).eq('content_id',data.id).single();if(!row||row.owner_id===context.userId) throw new Error('Meal unavailable');
 const snap=row.snapshot as unknown as MealSnapshot;const source=snap.mealId??data.id;
 const {data:existing}=await admin.from('meals').select('id').eq('source_meal_id',source).eq('user_id',context.userId).maybeSingle();if(existing)return {id:existing.id};
 const {data:profile}=await admin.from('profiles').select('name').eq('id',row.owner_id).maybeSingle();const {data:copy,error}=await admin.from('meals').insert({user_id:context.userId,name:snap.title,snapshot:row.snapshot,source_meal_id:source,source_user_id:row.owner_id,source_name:(profile?.name??'Member').trim(),...(data.kind==='post'?{source_post_id:data.id}:{})}).select('id').single();if(error) throw new Error('Could not add meal');return {id:copy.id};
});
export const searchMealFoods=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({q:z.string().trim().max(80)}).parse(i)).handler(async({context,data})=>{
 const {admin,under18}=await mealAccess(context);
 const {data:own}=await admin.from('meal_foods').select('*').eq('owner_id',context.userId).ilike('name',`%${data.q.replace(/[%_]/g,'')}%`).limit(30);
 const toFood=(r:Record<string,unknown>):Food=>({id:String(r['id']),name:String(r['name']),portions:r['portions'] as Food['portions'],nutrition:r['nutrition'] as Food['nutrition'],yours:!!r['owner_id']});
 let foods:Food[]=[];let error=false;
 if(!data.q){const {data:recent}=await admin.from('meal_food_recent').select('food_id').eq('user_id',context.userId).order('used_at',{ascending:false}).limit(6);const ids=(recent??[]).map(r=>r.food_id);const {data:rows}=ids.length?await admin.from('meal_foods').select('*').in('id',ids):{data:[]};foods=(rows??[]).filter(r=>!r.owner_id||r.owner_id===context.userId).map(r=>toFood(r as unknown as Record<string,unknown>));}
 else {
 // Versioned search cache refreshes older branded-only results and preserves ranked IDs.
 const key=`v8:${data.q.toLowerCase()}`;const {data:cache}=await admin.from('meal_food_searches').select('food_ids').eq('query',key).maybeSingle();
 if(cache){const {data:rows}=await admin.from('meal_foods').select('*').in('id',cache.food_ids).is('owner_id',null);foods=cache.food_ids.flatMap(id=>{const row=rows?.find(r=>r.id===id);return row?[toFood(row as unknown as Record<string,unknown>)]:[];});}
 else {try {
 const {fetchUsda,normalizeUsdaFood,rankUsdaRows,distinctFoodNames}=await import('./usda-foods.server');
 const responses=[];
 for(const dataType of [['Foundation','SR Legacy'],['Survey (FNDDS)'],['Branded']]) {
  const {data:claimed}=await admin.rpc('claim_meal_usda_request');if(!claimed)throw new Error('Search busy');
  responses.push(await fetchUsda('foods/search',{query:data.q,requireAllWords:true,pageSize:dataType[0]==='Branded'?6:200,dataType}));
 }
 const raw=rankUsdaRows([...new Map(responses.flatMap(r=>(r['foods']??[]) as Record<string,unknown>[]).map(r=>[r['fdcId'],r])).values()],data.q).filter((r,i,all)=>r['dataType']==='Branded'||all.slice(0,i).filter(x=>x['dataType']===r['dataType']).length<12);
 if(raw.length){
  const details:Record<string,unknown>[]=[];
  for(let i=0;i<raw.length;i+=20){
   const {data:detailClaim}=await admin.rpc('claim_meal_usda_request');if(!detailClaim)throw new Error('Search busy');
   const response=await fetchUsda('foods',{fdcIds:raw.slice(i,i+20).map(r=>r['fdcId']),format:'full',nutrients:[203,204,205,208,957,958]});
   if(Array.isArray(response))details.push(...response as Record<string,unknown>[]);
  }
  foods=uniqueFoodResults(distinctFoodNames(raw.map(r=>{const row={...r,...details.find(d=>d['fdcId']===r['fdcId'])};return {row,food:normalizeUsdaFood(row)};})));
  const {error:saveError}=await admin.from('meal_foods').upsert(foods.map(f=>({id:f.id,owner_id:null,name:f.name,portions:JSON.parse(JSON.stringify(f.portions)),nutrition:JSON.parse(JSON.stringify(f.nutrition))})));
  if(saveError)throw new Error('Could not cache');
 }
 await admin.from('meal_food_searches').upsert({query:key,food_ids:foods.map(f=>f.id)});
 }catch(e){console.error('[meals] Food search unavailable:', e instanceof Error ? e.message : 'Request failed');error=true;}}
 }
 const ranked=uniqueFoodResults(foods);const {data:counts}=ranked.length?await admin.from('meal_food_add_counts').select('food_id,adds').in('food_id',ranked.map(f=>f.id)):{data:[]};
 return mealForViewer({under18,foods:rankFoodResults(ranked,Object.fromEntries((counts??[]).map(c=>[c.food_id,c.adds]))),own:(own??[]).map(r=>toFood(r as unknown as Record<string,unknown>)),error},under18);
});
export const createOwnFood=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({name:z.string().trim().min(1).max(200),amount:z.number().positive().max(100000),unit:z.enum(['g','oz','cup','tbsp','tsp','piece','scoop']),nutrition:nutritionSchema}).parse(i)).handler(async({context,data})=>{
 const {admin,under18}=await mealAccess(context);const gramsPerUnit=data.unit==='oz'?28.349523125:data.unit==='g'?1:1;
 // Volume and piece customs retain the member's declared serving, not an invented density.
 const nutrition=Object.fromEntries(Object.entries(data.nutrition).map(([k,v])=>[k,under18||v===null?null:v*100/(data.amount*gramsPerUnit)]));
 const food:Food={id:`own:${crypto.randomUUID()}`,name:data.name,portions:[{unit:data.unit,grams:gramsPerUnit}],nutrition:nutrition as Food['nutrition'],yours:true};
 const {error}=await admin.from('meal_foods').insert({id:food.id,owner_id:context.userId,name:food.name,portions:JSON.parse(JSON.stringify(food.portions)),nutrition:JSON.parse(JSON.stringify(food.nutrition))});if(error)throw new Error('Could not save food');return mealForViewer(food,under18);
});
