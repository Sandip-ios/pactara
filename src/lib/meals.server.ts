import type { SupabaseClient } from '@supabase/supabase-js';
import { isUnder18 } from './redesign-profile';
import { mealForViewer, mealCopyCredit, buildSnapshot, type Meal, type Food, type MealInput, type MealFood, type MealSnapshot, type Nutrition } from './meals';
type Context={supabase:SupabaseClient;userId:string};
export async function mealAccess(context:Context) {
 const {data:prefs,error}=await context.supabase.rpc('get_my_app_prefs'); if(error) throw new Error('Could not load your settings');
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 const {data:newVersion,error:versionError}=await admin.rpc('is_new_version_user',{_user_id:context.userId});
 if(versionError||!newVersion) throw new Error('Not available');
 const pref=Array.isArray(prefs)?prefs[0]:prefs;
 if(!pref) throw new Error('Could not load your settings');
 const under18=isUnder18((pref as Record<string,unknown>|null)?.['birthday'] as string|null);
 return {admin,under18};
}
export async function visibleMealOwner(context:Context,target:string) {
 if(target===context.userId) return true;
 const {data,error}=await context.supabase.rpc('get_profile',{target});
 if(error||!data) return false;const p=data as {relationship?:string;is_private?:boolean};return p.relationship!=='blocked' && (!p.is_private||p.relationship==='following');
}
export function normalizeMealSnapshot(snapshot:MealSnapshot):MealSnapshot {
 const foods=Array.isArray(snapshot.foods)?snapshot.foods:(snapshot.items??[]).map((f,i)=>({key:`legacy-${i}`,foodId:`legacy-${i}`,name:f.name,amount:1,unit:f.amount,grams:0,note:'',nutrition:{calories:null,protein:null,carbs:null,fat:null}}));
 return {...snapshot,type:snapshot.type??null,foods,items:snapshot.items??foods.map(f=>({name:f.name,amount:`${f.amount} ${f.unit}`}))};
}
export async function loadMeals(context:Context,target:string|null,q='',type:string|null=null,discover=false):Promise<{under18:boolean;meals:Meal[]}> {
 const {admin,under18}=await mealAccess(context);const owner=target??context.userId;
 if(!discover && !await visibleMealOwner(context,owner)) return {under18,meals:[]};
 let query=admin.from('meals').select('*').order('created_at',{ascending:false}).limit(300);
 if(!discover) query=query.eq('user_id',owner);
 if(q) query=query.ilike('name',`%${q.replace(/[%_]/g,'')}%`);
 const {data:rows,error}=await query;if(error) throw new Error('Could not load meals');
 const ids=(rows??[]).map(r=>r.id); const owners=[...new Set((rows??[]).map(r=>r.user_id))];
 const [{data:copies},{data:names},allowed]=await Promise.all([ids.length?admin.from('meals').select('id,user_id,source_meal_id').in('source_meal_id',ids):Promise.resolve({data:[]}),owners.length?admin.from('profiles').select('id,name').in('id',owners):Promise.resolve({data:[]}),Promise.all(owners.map(async id=>{ if(!discover) return [id,true] as const; const {data:visible,error:err}=await admin.rpc('discover_author_visible',{_owner:id,_viewer:context.userId}); return [id,!err&&!!visible] as const; }))]);
 const permitted=new Map(allowed);const author=new Map((names??[]).map(p=>[p.id,p.name?.trim()||'Member']));
 let meals=(rows??[]).filter(r=>permitted.get(r.user_id)).map(r=>({id:r.id,name:r.name,userId:r.user_id,author:author.get(r.user_id)||'Member',fromName:r.source_name,sourceMealId:r.source_meal_id,myCopyId:(copies??[]).find(c=>c.source_meal_id===r.id&&c.user_id===context.userId)?.id??null,added:(copies??[]).filter(c=>c.source_meal_id===r.id).length,snapshot:normalizeMealSnapshot(r.snapshot as unknown as MealSnapshot)}));
 if(type) meals=meals.filter(m=>m.snapshot.type===type);
 if(discover) meals.sort((a,b)=>b.added-a.added);
 return {under18,meals:mealForViewer(meals,under18)};
}
export async function saveMealServer(context:Context,input:MealInput) {
 const {admin,under18}=await mealAccess(context);
 const {data:old}=input.id?await admin.from('meals').select('*').eq('id',input.id).eq('user_id',context.userId).maybeSingle():{data:null};
 if(input.id&&!old) throw new Error('Meal unavailable');
 const ids=[...new Set(input.foods.map(f=>f.foodId))];const {data:rows,error}=await admin.from('meal_foods').select('*').in('id',ids);if(error) throw new Error('Could not save');
 const previous=old?normalizeMealSnapshot(old.snapshot as unknown as MealSnapshot):null;
 const foods:MealFood[]=input.foods.map(item=>{const row=(rows??[]).find(f=>f.id===item.foodId);const past=previous?.foods.find(f=>f.foodId===item.foodId);
 if(!row && past?.foodId.startsWith('legacy-')) return {...past,key:item.key,amount:item.amount,unit:item.unit,note:item.note};
 if(!row || row.owner_id&&row.owner_id!==context.userId&&!past) throw new Error('Food unavailable');
 const portion=(row.portions as unknown as Food['portions']).find(p=>p.unit===item.unit);if(!portion||!Number.isFinite(portion.grams)||portion.grams<=0) throw new Error('Invalid portion');
 return {key:item.key,foodId:row.id,name:row.name,amount:item.amount,unit:item.unit,grams:item.amount*portion.grams,note:item.note,portions:row.portions as unknown as Food['portions'],nutrition:row.nutrition as unknown as Nutrition}; });
 const snapshot=buildSnapshot(input.name,input.type,foods,under18?previous?.override??null:input.override);
 const fromName=previous?mealCopyCredit(previous,snapshot,old?.source_name??null):null;
 const payload={name:input.name,snapshot:JSON.parse(JSON.stringify(snapshot)),source_name:fromName,updated_at:new Date().toISOString()};
 const result=old?await admin.from('meals').update(payload).eq('id',old.id).eq('user_id',context.userId).select('id').single():await admin.from('meals').insert({...payload,user_id:context.userId}).select('id').single();
 if(result.error||!result.data) throw new Error("Couldn't save the meal. Try again.");
 await admin.from('meal_food_recent').upsert(ids.filter(id=>!id.startsWith('legacy-')).map(food_id=>({user_id:context.userId,food_id,used_at:new Date().toISOString()})));
 return {id:result.data.id};
}
export async function attachmentSnapshot(context:Context,kind:'post'|'checkin',id:string):Promise<MealSnapshot|null> {
 const {admin,under18}=await mealAccess(context);let allowed=false;
 if(kind==='post') { const {data}=await context.supabase.from('social_posts').select('id').eq('id',id).maybeSingle();allowed=!!data; }
 else {const {data}=await context.supabase.from('check_ins').select('id').eq('id',id).maybeSingle();allowed=!!data; if(!allowed){const {data:shared}=await context.supabase.rpc('can_view_new_shared_checkin',{_id:id});allowed=!!shared;} }
 if(!allowed) return null;
 const {data}=await admin.from('meal_attachments').select('snapshot').eq('kind',kind).eq('content_id',id).maybeSingle();
 return data?mealForViewer(normalizeMealSnapshot(data.snapshot as unknown as MealSnapshot),under18):null;
}
