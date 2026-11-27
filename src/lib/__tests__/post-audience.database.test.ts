import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const base = 'http://127.0.0.1:8001';
type Account = { id: string; token: string };
const accounts: Account[] = [];
const crews: string[] = [];
function key() { const k = process.env['SUPABASE_SERVICE_ROLE_KEY']; if (!k) throw new Error('Draft credentials missing'); return k; }
async function request<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method, headers: { apikey: key(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  if (!response.ok) { const error = JSON.parse(text) as { message?: string; msg?: string }; throw new Error(error.message ?? error.msg ?? 'Draft request failed'); }
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = 'GET', body?: unknown) => request<T>(path, key(), method, body);
function pair() { const [author, viewer] = accounts; if (!author || !viewer) throw new Error('Missing test accounts'); return { author, viewer }; }
const rows = (table: string, filter: string, token = key()) => request<Record<string, unknown>[]>(`/rest/v1/${table}?${filter}`, token);
const rpc = <T>(a: Account, fn: string, args: object) => request<T>(`/rest/v1/rpc/${fn}`, a.token, 'POST', args);
async function post(audience: string, crewIds = crews, items: object[] = []) {
  const { author } = pair();
  return rpc<string>(author, 'create_library_post_v2', { _caption: 'Temporary audience test', _audience: audience, _group_ids: crewIds, _items: items, _workout: null, _workout_session_id: null, _workout_id: null, _credit_user_id: null, _comments_on: true, _tags: [], _skip_discover: false });
}

describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('Library audience database enforcement', () => {
  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const email = `${randomUUID()}@example.com`; const password = randomUUID();
      const user = await admin<{id:string}>('/auth/v1/admin/users', 'POST', {email,password,email_confirm:true});
      accounts.push({id:user.id,token:''});
      const session = await request<{access_token:string}>('/auth/v1/token?grant_type=password',key(),'POST',{email,password});
      const a = accounts[i]; if (a) a.token=session.access_token;
    }
    const {author,viewer}=pair();
    for (let i=0;i<2;i++) {
      const result = await admin<{id:string}[]>('/rest/v1/groups','POST',{name:`Temporary post audience crew ${i}`,owner_id:author.id});
      const g=result[0]?.id; if (!g) throw new Error('Crew creation failed'); crews.push(g);
      await admin('/rest/v1/group_members?on_conflict=group_id,user_id','POST',{group_id:g,user_id:author.id}).catch(async () => { expect(await rows('group_members',`group_id=eq.${g}&user_id=eq.${author.id}`)).toHaveLength(1); });
      if (i===0) await admin('/rest/v1/group_members','POST',{group_id:g,user_id:viewer.id});
    }
  });
  beforeEach(async () => {
    const {author}=pair();
    await admin(`/rest/v1/social_posts?user_id=eq.${author.id}`,'DELETE');
    await admin(`/rest/v1/follows?following_id=eq.${author.id}`,'DELETE');
    await admin(`/rest/v1/profiles?id=eq.${author.id}`,'PATCH',{birthday:null,is_private:false,app_version:'new',new_version_enabled:true});
  });
  afterAll(async () => {
    for (const g of crews) await admin(`/rest/v1/groups?id=eq.${g}`,'DELETE');
    for (const a of accounts) {
      await admin(`/rest/v1/subscriptions?user_id=eq.${a.id}`,'DELETE');
      await admin(`/auth/v1/admin/users/${a.id}`,'DELETE');
      expect(await rows('profiles',`id=eq.${a.id}`)).toEqual([]);
      expect(await rows('social_posts',`user_id=eq.${a.id}`)).toEqual([]);
    }
  });
  it('Everyone always adds every active crew even when caller passes a subset',async()=>{
    const id=await post('everyone',crews.slice(0,1));
    expect((await rows('social_post_crews',`post_id=eq.${id}`)).map(r=>r['group_id']).sort()).toEqual([...crews].sort());
  });
  it('Crews subset refuses an empty audience and hides excluded crews',async()=>{
    await expect(post('crews',[])).rejects.toThrow('Pick at least one crew');
    const id=await post('crews',crews.slice(1)); const {viewer}=pair();
    expect(await rows('social_posts',`id=eq.${id}`,viewer.token)).toEqual([]);
  });
  it('Only me ignores crew links, suppresses comments and is unreadable to others',async()=>{
    const id=await post('only_me'); const {author,viewer}=pair();
    expect(await rows('social_post_crews',`post_id=eq.${id}`)).toEqual([]);
    expect(await rows('social_posts',`id=eq.${id}`,viewer.token)).toEqual([]);
    expect((await rows('social_posts',`id=eq.${id}`,author.token))[0]?.['comments_on']).toBe(false);
    await expect(request('/rest/v1/social_post_cheers',viewer.token,'POST',{post_id:id,user_id:viewer.id})).rejects.toThrow();
    await expect(request('/rest/v1/social_post_comments',viewer.token,'POST',{post_id:id,user_id:viewer.id,body:'Hidden'})).rejects.toThrow();
  });
  it('Private Everyone allows approved followers but not strangers outside crews',async()=>{
    const {author,viewer}=pair();
    await admin(`/rest/v1/profiles?id=eq.${author.id}`,'PATCH',{is_private:true});
    const id=await post('everyone');
    await admin(`/rest/v1/group_members?user_id=eq.${viewer.id}`,'DELETE');
    try {
      expect(await rows('social_posts',`id=eq.${id}`,viewer.token)).toEqual([]);
      await admin('/rest/v1/follows','POST',{follower_id:viewer.id,following_id:author.id,status:'accepted',accepted_at:new Date().toISOString()});
      expect(await rows('social_posts',`id=eq.${id}`,viewer.token)).toHaveLength(1);
    } finally { const g=crews[0]; if(g) await admin('/rest/v1/group_members','POST',{group_id:g,user_id:viewer.id}); }
  });
  it('Teen can post privately without a crew, never Everyone',async()=>{
    const {author}=pair();
    await admin(`/rest/v1/profiles?id=eq.${author.id}`,'PATCH',{birthday:new Date(Date.now()-16*365.25*86400_000).toISOString().slice(0,10)});
    await expect(post('everyone')).rejects.toThrow('Under-18');
    expect(await post('only_me',[])).toBeTypeOf('string');
  });
  it('Audience edits atomically clear crew links and deny nonauthors',async()=>{
    const {author,viewer}=pair(); const id=await post('everyone');
    await expect(rpc(viewer,'set_social_post_audience',{_post_id:id,_audience:'only_me',_group_ids:[]})).rejects.toThrow('Post not found');
    await rpc(author,'set_social_post_audience',{_post_id:id,_audience:'only_me',_group_ids:[]});
    expect(await rows('social_post_crews',`post_id=eq.${id}`)).toEqual([]);
    expect(await rows('social_posts',`id=eq.${id}`,viewer.token)).toEqual([]);
    await expect(request(`/rest/v1/social_posts?id=eq.${id}`,author.token,'PATCH',{audience:'everyone'})).rejects.toThrow();
  });
  it('Only the author can pin a library post',async()=>{
    const {author,viewer}=pair(); const id=await post('only_me',[]);
    await expect(rpc(viewer,'set_social_post_pin',{_post_id:id,_pinned:true})).rejects.toThrow('Post not found');
    expect((await rows('social_posts',`id=eq.${id}`))[0]?.['pinned_at']).toBeNull();
    await rpc(author,'set_social_post_pin',{_post_id:id,_pinned:true});
    expect((await rows('social_posts',`id=eq.${id}`))[0]?.['pinned_at']).toBeTypeOf('string');
    await rpc(author,'set_social_post_pin',{_post_id:id,_pinned:false});
    expect((await rows('social_posts',`id=eq.${id}`))[0]?.['pinned_at']).toBeNull();
  });
  it('Posts never create check-ins or change the daily count',async()=>{
    const {author}=pair();
    const before=await rows('check_ins',`user_id=eq.${author.id}`); const days=await rows('daily_posts',`user_id=eq.${author.id}`);
    await post('everyone'); await post('only_me');
    expect(await rows('check_ins',`user_id=eq.${author.id}`)).toEqual(before);
    expect(await rows('daily_posts',`user_id=eq.${author.id}`)).toEqual(days);
  });
  it('Remembers the audience after its post is deleted',async()=>{
    const {author}=pair(); const id=await post('crews',crews.slice(1));
    await admin(`/rest/v1/social_posts?id=eq.${id}`,'DELETE');
    expect(await rpc(author,'get_my_post_audience',{})).toEqual({kind:'crews',crewIds:crews.slice(1)});
  });
  it('Changing a long video to Crews is refused, and 10 minutes total is enforced',async()=>{
    const {author}=pair(); const item=(position:number,len:number)=>({kind:'video',path:`${author.id}/temporary-${position}.mp4`,duration_s:len,trim_start:0,trim_end:len});
    const id=await post('everyone',crews,[item(0,200)]);
    await expect(rpc(author,'set_social_post_audience',{_post_id:id,_audience:'crews',_group_ids:crews})).rejects.toThrow('Crew-only');
    await expect(post('everyone',crews,[item(1,301),item(2,300)])).rejects.toThrow('10:00 total');
  });
});
