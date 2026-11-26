import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { crewIdInput, requestIdInput, decisionInput, joinGoalInput, effectiveRequestStatus, type RequestStatus } from "./crew-join";
import { MAX_GROUP_MEMBERS } from "./invite-resolver";

export const getFindCrews = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { discoveryCrews } = await import("./crew-join.server");
  return { crews: await discoveryCrews(supabaseAdmin, context.userId, "find") };
});
export const getCrewPreview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(input => crewIdInput.parse(input)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { discoveryCrews } = await import("./crew-join.server");
  const crews = await discoveryCrews(supabaseAdmin, context.userId, "preview", data.groupId);
  return { crew: crews[0] ?? null };
});
export const getCrewJoinOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: rows, error } = await context.supabase.from("crew_join_requests").select("group_id,requester_id,status,created_at").eq("status", "pending").gt("created_at", new Date(Date.now()-14*86400000).toISOString());
  if (error) throw new Error("Couldn't load requests");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { discoveryCrews } = await import("./crew-join.server");
  const { data: owned } = await context.supabase.from("groups").select("id").eq("owner_id",context.userId).is("ended_at",null);
  const counts: Record<string,number> = {};
  for (const g of owned ?? []) counts[g.id] = (rows ?? []).filter(r => r.group_id === g.id).length;
  return { pending: await discoveryCrews(supabaseAdmin, context.userId, "pending"), counts };
});
export const getCrewJoinRequests = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(input => crewIdInput.parse(input)).handler(async ({ data, context }) => {
  const { data: group } = await context.supabase.from("groups").select("id,name,owner_id").eq("id",data.groupId).is("ended_at",null).maybeSingle();
  if (!group || group.owner_id !== context.userId) throw new Error("Only the person who runs this crew can see requests");
  const [{ data: rows, error }, { count }] = await Promise.all([
    context.supabase.from("crew_join_requests").select("id,requester_id,created_at,status").eq("group_id",group.id).eq("status","pending").gt("created_at",new Date(Date.now()-14*86400000).toISOString()).order("created_at"),
    context.supabase.from("group_members").select("id",{count:"exact",head:true}).eq("group_id",group.id),
  ]);
  if (error) throw new Error("Couldn't load requests");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requesterProfiles } = await import("./crew-join.server");
  const profiles = await requesterProfiles(supabaseAdmin,(rows ?? []).map(r => r.requester_id));
  return { groupId:group.id, name:group.name, memberCount:count ?? 0, limit:MAX_GROUP_MEMBERS, requests:(rows ?? []).map(r => ({ id:r.id, name:profiles.get(r.requester_id)?.name ?? "Member", avatarUrl:profiles.get(r.requester_id)?.avatarUrl ?? null, streak:profiles.get(r.requester_id)?.streak ?? 0, createdAt:r.created_at })) };
});
export const requestCrewJoin = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator(input => crewIdInput.parse(input)).handler(async({data,context})=>{
  const {data:result,error}=await context.supabase.rpc("request_crew_join",{_group_id:data.groupId});
  if(error)throw new Error(error.message);
  const row=result as {id:string;changed:boolean;owner_id:string};
  if(row.changed){
    const { sendCrewJoinPush }=await import("./crew-join-push.server");
    await sendCrewJoinPush("requested",context.userId,row.owner_id,data.groupId,row.id);
  }
  return {requestId:row.id};
});
export const decideCrewJoinRequest = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>decisionInput.parse(input)).handler(async({data,context})=>{
  const {data:result,error}=await context.supabase.rpc("decide_crew_join_request",{_request_id:data.requestId,_decision:data.decision});
  if(error)throw new Error(error.message);
  const row=result as {status:RequestStatus;changed:boolean;group_id?:string;requester_id?:string};
  if(row.status==="expired")throw new Error("This request has expired");
  if(row.changed && row.status==="approved" && row.group_id && row.requester_id){
    const {sendCrewJoinPush}=await import("./crew-join-push.server");
    await sendCrewJoinPush("approved",context.userId,row.requester_id,row.group_id,data.requestId);
  }
  return {status:row.status};
});
export const cancelCrewJoinRequest = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>requestIdInput.parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc("cancel_crew_join_request",{_request_id:data.requestId});
  if(error)throw new Error(error.message);
  return {ok:true};
});
export const getCrewJoinGoal = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator(input=>crewIdInput.parse(input)).handler(async({data,context})=>{
  const {data:rows,error}=await context.supabase.from("crew_join_requests").select("id,status,created_at").eq("group_id",data.groupId).eq("requester_id",context.userId).eq("status","approved").is("goal_prompt_seen_at",null).limit(1);
  if(error)throw new Error("Couldn't load your crew goal");
  return {show:Boolean(rows?.some(r=>effectiveRequestStatus(r.status as RequestStatus,r.created_at)==="approved"))};
});
export const completeCrewJoinGoal = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>joinGoalInput.parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc("complete_crew_join_goal",{_group_id:data.groupId,_goal:data.goal ?? ""});
  if(error)throw new Error(error.message);
  return {ok:true};
});
// True when this member was approved into the crew through a join request. The
// new version's own goal sheet covers those crews, so the classic goal screen
// must not take over the screen for them.
export const wasApprovedIntoCrew = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator(input=>crewIdInput.parse(input)).handler(async({data,context})=>{
  const {data:rows}=await context.supabase.from("crew_join_requests").select("id").eq("group_id",data.groupId).eq("requester_id",context.userId).eq("status","approved").limit(1);
  return {approved:Boolean(rows?.length)};
});