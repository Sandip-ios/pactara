import { filterOptedIn,pushToUsers } from "./notify.server";
import { activityOpenUrl } from "./activity-deeplink";
export async function sendCrewJoinPush(kind:"requested"|"approved",actorId:string,recipientId:string,groupId:string,requestId:string){
  try{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const [{data:actor},{data:crew}]=await Promise.all([
      supabaseAdmin.from("profiles").select("name").eq("id",actorId).maybeSingle(),
      supabaseAdmin.from("groups").select("name").eq("id",groupId).is("ended_at",null).maybeSingle(),
    ]);
    if(!crew)return;
    const name=actor?.name.trim().split(/\s+/)[0] || "Someone";
    const body=kind==="requested"?`${name} asked to join ${crew.name}`:`You're in ${crew.name}. ${name} approved your request.`;
    const users=await filterOptedIn([recipientId],"group_activity_enabled");
    await pushToUsers(users,{title:"Pactara",body,url:kind==="requested"?`/crews/${groupId}/requests`:`/crews/${groupId}`,newUrl:activityOpenUrl(kind==="requested"?{kind:"crew_request",groupId,requestId}:{kind:"crew_approved",groupId}),actorUserId:actorId,crewIds:[groupId]});
  }catch(error){console.warn("[crew-join] push delivery failed",error);}
}