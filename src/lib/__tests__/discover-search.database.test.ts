import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const base='http://127.0.0.1:8001';
const key=()=>{const v=process.env['SUPABASE_SERVICE_ROLE_KEY'];if(!v)throw Error('Draft credentials unavailable');return v;};
async function request<T>(path:string,method='GET',body?:unknown,bearer=key()):Promise<T>{const r=await fetch(base+path,{method,headers:{apikey:key(),Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok)throw Error(`Draft request failed ${r.status}`);const text=await r.text();return (text?JSON.parse(text):null) as T;}
const users:string[]=[];let token='';let viewer='';const prefix=`Qa${randomUUID().slice(0,8)}`;const ids:Record<string,string>={};
async function user(label:string,fields:Record<string,unknown>={}){const email=`${randomUUID()}@example.com`;const password=randomUUID();const u=await request<{id:string}>('/auth/v1/admin/users','POST',{email,password,email_confirm:true});users.push(u.id);await request(`/rest/v1/profiles?id=eq.${u.id}`,'PATCH',{name:`${prefix} ${label}`,app_version:'new',new_version_enabled:true,is_private:false,birthday:'1990-01-01',...fields});return {id:u.id,email,password};}
async function search(q=prefix){return request<{id:string;isPrivate:boolean}[]>('/rest/v1/rpc/search_discover_people','POST',{query_text:q},token);}
describe.skipIf(!process.env['PGHOST']||!process.env['SUPABASE_SERVICE_ROLE_KEY'])('Discover search server privacy',()=>{
 beforeAll(async()=>{const me=await user('Viewer');viewer=me.id;token=(await request<{access_token:string}>('/auth/v1/token?grant_type=password','POST',{email:me.email,password:me.password})).access_token;for(const [label,fields] of Object.entries({public:{},private:{is_private:true},out:{},incoming:{},teen:{birthday:'2015-01-01'},classic:{app_version:'classic',new_version_enabled:false},accent:{name:`${prefix} José`}})){ids[label]=(await user(label,fields)).id;}await request('/rest/v1/user_blocks','POST',[{blocker_id:viewer,blocked_id:ids['out']},{blocker_id:ids['incoming'],blocked_id:viewer}]);});
 afterAll(async()=>{for(const id of users)await request(`/auth/v1/admin/users/${id}`,'DELETE');});
 it('public new-version people appear',async()=>expect((await search()).some(p=>p.id===ids['public'])).toBe(true));
 it('private people appear with their lock state',async()=>expect((await search()).find(p=>p.id===ids['private'])?.isPrivate).toBe(true));
 it('people the caller blocked are excluded on the server',async()=>expect((await search()).some(p=>p.id===ids['out'])).toBe(false));
 it('people who blocked the caller are excluded on the server',async()=>expect((await search()).some(p=>p.id===ids['incoming'])).toBe(false));
 it('under-18 people never appear for adults',async()=>expect((await search()).some(p=>p.id===ids['teen'])).toBe(false));
 it('classic people stay outside new-version search',async()=>expect((await search()).some(p=>p.id===ids['classic'])).toBe(false));
 it('server matching ignores accents and case',async()=>expect((await search(`${prefix.toUpperCase()} JOSE`)).map(p=>p.id)).toEqual([ids['accent']]));
 it('the caller appears as self',async()=>expect((await search()).some(p=>p.id===viewer)).toBe(true));
});
