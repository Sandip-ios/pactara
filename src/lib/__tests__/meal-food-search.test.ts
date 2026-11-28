import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { remoteMealFoods } from '../meal-food-search.server';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function adminMock(claimed=true,cachedFoods:Record<string,unknown>[]=[]){
 const writes=vi.fn();
 const rpc=vi.fn(()=>builder({data:claimed,error:null}));
 function builder(result:unknown){const b:Record<string,unknown>={then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};for(const method of ['select','eq','in','is','abortSignal','maybeSingle','upsert'])b[method]=()=>b;return b;}
 const from=vi.fn((table:string)=>{const b=builder({data:table==='meal_food_searches'?null:table==='meal_foods'?cachedFoods:[],error:null});b['upsert']=(value:unknown)=>{writes({table,value});return b;};return b;});
 return {admin:{from,rpc} as unknown as SupabaseClient,rpc,writes};
}
describe('USDA search execution',()=>{
 it('background warming uses its dedicated reservation without consuming the user-only budget path',async()=>{
  const {admin,rpc}=adminMock();const warmClaim=vi.fn(async()=>false);const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect(await remoteMealFoods(admin,'rice',false,new AbortController().signal,warmClaim)).toMatchObject({limited:true,incomplete:true});
  expect(warmClaim).toHaveBeenCalledTimes(1);expect(rpc).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
 });
 it('claims once for five calls, uses 200/50/6 searches, and fetches only 25 ranked details concurrently',async()=>{
  const {admin,rpc}=adminMock();vi.stubEnv('USDA_API_KEY','test-only');
  const sizes:number[]=[];let detailedIds=0;let active=0,max=0,searches=0,details=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;
   const data=JSON.parse(String(init.body));
   if(url.endsWith('foods/search')){
    searches++;sizes.push(data.pageSize);const types=data.dataType as string[];
    const rows=types.flatMap((type,t)=>Array.from({length:type==='Branded'?6:12},(_,i)=>({fdcId:(type==='Foundation'?0:type==='SR Legacy'?100:type==='Branded'?300:200)+i,description:`Food, variant ${t}-${i}`,dataType:type})));
    return new Response(JSON.stringify({foods:rows}));
   }
   details++;detailedIds+=data.fdcIds.length;return new Response(JSON.stringify(data.fdcIds.map((fdcId:number)=>({fdcId,foodPortions:[{amount:1,gramWeight:100,modifier:'cup'}]}))));
  }));
  const result=await remoteMealFoods(admin,'food',false,new AbortController().signal);
  expect(rpc.mock.calls).toEqual([['claim_meal_usda_search',{_requests:5}]]);
  expect(sizes).toEqual([200,50,6]);expect(searches).toBe(3);expect(details).toBe(2);expect(max).toBe(3);expect(detailedIds).toBe(25);
  expect(result.error).toBe(false);expect(result.foods.length).toBe(24);
 });
 it('refreshes cached vague portions rather than retaining the obsolete unit label',async()=>{
  const {admin}=adminMock(true,[{id:'usda:1',name:'Rice, cooked',owner_id:null,portions:[{unit:'serving',grams:158}],nutrition:{calories:130,protein:3,carbs:28,fat:0}}]);vi.stubEnv('USDA_API_KEY','test-only');let details=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   if(url.endsWith('foods/search'))return new Response(JSON.stringify({foods:[{fdcId:1,description:'Rice, cooked',dataType:'Survey (FNDDS)'}]}));
   details++;return new Response(JSON.stringify([{fdcId:1,foodPortions:[{modifier:'10043',portionDescription:'1 cup, cooked',gramWeight:158}]}]));
  }));
  const result=await remoteMealFoods(admin,'rice',false,new AbortController().signal);
  expect(details).toBe(1);expect(result.foods[0]?.portions[0]).toEqual({unit:'cup',grams:158});
 });
 it('a refused limiter does not call USDA and returns a non-error fallback for local results',async()=>{
  const {admin,rpc}=adminMock(false);const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  const result=await remoteMealFoods(admin,'eggs',false,new AbortController().signal);
  expect(rpc).toHaveBeenCalledTimes(1);expect(fetchMock).not.toHaveBeenCalled();expect(result.foods).toEqual([]);expect(result.error).toBe(false);expect(result).toMatchObject({incomplete:true,limited:true});
 });
 it('an aborted stale request does not reserve budget or start USDA calls',async()=>{
  const {admin,rpc}=adminMock();const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);const controller=new AbortController();controller.abort();
  await expect(remoteMealFoods(admin,'rice',false,controller.signal)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
 });
});
describe('bounded partial USDA search',()=>{
 it('keeps finished tiers when one search fails and does not cache a partial result list',async()=>{
  const {admin,writes}=adminMock();vi.stubEnv('USDA_API_KEY','test-only');
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   const body=JSON.parse(String(init.body));
   if(url.endsWith('foods/search')){
    if(body.dataType[0]==='Branded')throw new DOMException('Timed out','TimeoutError');
    return new Response(JSON.stringify({foods:[{fdcId:1,description:'Rice, white, cooked',dataType:'SR Legacy'}]}));
   }
   return new Response(JSON.stringify([{fdcId:1,foodPortions:[{amount:1,gramWeight:158,modifier:'cup'}]}]));
  }));
  const result=await remoteMealFoods(admin,'rice',false,new AbortController().signal);
  expect(result).toMatchObject({incomplete:true,error:false});expect(result.foods.map(f=>f.name)).toEqual(['White rice, cooked']);expect(writes.mock.calls.flat().filter(r=>r.table==='meal_food_searches')).toEqual([]);
 });
 it('stops a hung provider by four seconds and returns a retryable partial result',async()=>{
  vi.useFakeTimers();vi.stubEnv('USDA_API_KEY','test-only');const {admin}=adminMock();
  vi.stubGlobal('fetch',vi.fn((_url:string,init:RequestInit)=>new Promise((_resolve,reject)=>{
   init.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true});
  })));
  const result=remoteMealFoods(admin,'pasta',false,new AbortController().signal);
  await vi.advanceTimersByTimeAsync(4000);
  expect(await result).toMatchObject({incomplete:true,error:false,foods:[]});
 });
});
