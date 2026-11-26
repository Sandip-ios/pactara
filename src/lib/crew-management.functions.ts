import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAvatarThumbs } from "@/lib/media-urls";
import { MAX_GROUP_MEMBERS } from "@/lib/invite-resolver";
import { crewSettingsInput, crewMemberActionInput, requireCrewOwner } from "./crew-management";

export const getCrewManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: crewSettingsInput.shape.groupId.parse(input.groupId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: group, error } = await supabase.from("groups").select("id,name,about,owner_id,discoverable").is("ended_at", null).eq("id", data.groupId).maybeSingle();
    if (error || !group) throw new Error("This crew is no longer available");
    const { data: rows, error: memberError } = await supabase.from("group_members").select("user_id,joined_at, groups!inner(ended_at)").is("groups.ended_at", null).eq("group_id", group.id).order("joined_at").order("user_id");
    if (memberError || !rows?.some((row) => row.user_id === userId)) throw new Error("You are not in this crew");
    const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,name,avatar_url,avatar_color").in("id", rows.map((row) => row.user_id));
    if (profileError) throw new Error("Could not load crew members");
    const urls = await signAvatarThumbs(supabase, (profiles ?? []).map((p) => p.avatar_url));
    return { ...group, viewerId: userId, memberLimit: MAX_GROUP_MEMBERS, members: rows.map((row) => {
      const p = profiles?.find((profile) => profile.id === row.user_id);
      return { id: row.user_id, name: p?.name ?? "Member", joinedAt: row.joined_at, avatarColor: p?.avatar_color ?? "", avatarUrl: p?.avatar_url ? urls.get(p.avatar_url) ?? null : null };
    }) };
  });

export const saveCrewSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => crewSettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: group } = await context.supabase.from("groups").select("owner_id").is("ended_at", null).eq("id", data.groupId).maybeSingle();
    if (!group) throw new Error("This crew is no longer available");
    requireCrewOwner(group.owner_id, context.userId);
    const { data: updated, error } = await context.supabase.from("groups").update({ name: data.name, about: data.about || null, ...(data.discoverable === undefined ? {} : { discoverable: data.discoverable }) }).eq("id", data.groupId).eq("owner_id", context.userId).select("id").maybeSingle();
    if (error || !updated) throw new Error("Could not save crew settings");
    return { ok: true };
  });

export const manageCrewMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => crewMemberActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("manage_redesign_crew", { _group_id: data.groupId, _member_id: data.memberId, _action: data.action });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const leaveOwnedCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: crewSettingsInput.shape.groupId.parse(input.groupId) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("manage_redesign_crew", { _group_id: data.groupId, _member_id: context.userId, _action: "leave" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const endCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: crewSettingsInput.shape.groupId.parse(input.groupId) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("end_crew", { _group_id: data.groupId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });