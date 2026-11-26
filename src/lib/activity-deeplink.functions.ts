import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activityOpenUrl, crewPostUrl, type ActivityDeepLinkKind } from "./activity-deeplink";
import { localDateIn } from "./streak-rules";

const kinds = [
  "comment", "reply", "comment_like", "reaction", "checkin", "nudge", "reminder",
  "crew_request", "crew_approved", "pact_signed", "pact_restart", "pact_complete",
  "join", "milestone", "follow", "follow_request", "follow_accepted", "message",
] as const;

const input = z.object({
  kind: z.enum(kinds),
  groupId: z.string().uuid().nullish(),
  postId: z.string().uuid().nullish(),
  commentId: z.string().uuid().nullish(),
  actorId: z.string().uuid().nullish(),
  requestId: z.string().uuid().nullish(),
});

export type ResolvedActivityDestination = { href: string | null; checkInGroupId: string | null };

/**
 * Resolves both Activity rows and their new-version push links. A null href
 * means the post/person/request/crew is gone or no longer visible to the caller.
 */
export const resolveActivityDeepLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data, context }): Promise<ResolvedActivityDestination> => {
    const { supabase, userId } = context;
    const none = { href: null, checkInGroupId: null };
    try {
      const blockedPairs = async (actorId?: string | null) => {
        if (!actorId || actorId === userId) return false;
        const { blockedPairs: load } = await import("./safety.server");
        return (await load(supabase, userId)).has(actorId);
      };
      const activeCrew = async (groupId: string) => {
        const { data: membership, error } = await supabase.from("group_members")
          .select("group_id, groups!inner(id)").eq("group_id", groupId).eq("user_id", userId)
          .is("groups.ended_at", null).maybeSingle();
        return !error && Boolean(membership);
      };
      const profileHref = async (actorId: string | null | undefined) => {
        if (!actorId) return null;
        if (actorId === userId) return "/profile";
        if (await blockedPairs(actorId)) return null;
        const { data: profile, error } = await supabase.rpc("get_profile", { target: actorId });
        const person = profile as { relationship?: string } | null;
        return !error && person && person.relationship !== "blocked" ? `/u/${actorId}` : null;
      };
      const crewHref = (groupId: string) => `/crews/${groupId}`;

      if (["comment", "reply", "comment_like", "reaction", "checkin"].includes(data.kind)) {
        if (!data.groupId || !data.postId) return none;
        const { data: post, error } = await supabase.from("daily_posts")
          .select("id, group_id, user_id, groups!inner(id)").eq("id", data.postId)
          .eq("group_id", data.groupId).is("groups.ended_at", null).maybeSingle();
        if (error || !post || await blockedPairs(post.user_id)) return none;
        const wantsComment = ["comment", "reply", "comment_like"].includes(data.kind);
        if (wantsComment) {
          if (!data.commentId) return none;
          const { data: comment, error: commentError } = await supabase.from("post_comments")
            .select("id, post_id, user_id").eq("id", data.commentId).eq("post_id", data.postId).maybeSingle();
          if (commentError || !comment || await blockedPairs(comment.user_id)) return none;
        }
        return { href: crewPostUrl({ groupId: data.groupId, postId: data.postId, commentId: wantsComment ? data.commentId : null }), checkInGroupId: null };
      }

      if (data.kind === "nudge" || data.kind === "reminder") {
        if (!data.groupId || !(await activeCrew(data.groupId)) || (data.kind === "nudge" && await blockedPairs(data.actorId))) return none;
        // Reminders always resume check-in; only nudges use the already-done crew fallback.
        if (data.kind === "reminder") return { href: null, checkInGroupId: data.groupId };
        const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
        const today = localDateIn((profile?.timezone as string | null) ?? "UTC");
        const { data: checkIn, error } = await supabase.from("check_ins").select("id")
          .eq("group_id", data.groupId).eq("user_id", userId).eq("checkin_date", today).limit(1).maybeSingle();
        if (error) return none;
        return checkIn
          ? { href: crewHref(data.groupId), checkInGroupId: null }
          : { href: null, checkInGroupId: data.groupId };
      }

      if (data.kind === "crew_request") {
        if (!data.groupId || !data.requestId || !(await activeCrew(data.groupId))) return none;
        const { data: request, error } = await supabase.from("crew_join_requests")
          .select("id, group_id, status, created_at").eq("id", data.requestId).eq("group_id", data.groupId).maybeSingle();
        const fresh = request && Date.parse(request.created_at) > Date.now() - 14 * 86400000;
        return !error && request?.status === "pending" && fresh
          ? { href: `/crews/${data.groupId}/requests`, checkInGroupId: null }
          : none;
      }

      if (data.kind === "crew_approved") {
        if (!data.groupId || !(await activeCrew(data.groupId)) || await blockedPairs(data.actorId)) return none;
        if (data.requestId) {
          const { data: request, error } = await supabase.from("crew_join_requests").select("id")
            .eq("id", data.requestId).eq("group_id", data.groupId).eq("requester_id", userId).eq("status", "approved").maybeSingle();
          if (error || !request) return none;
        }
        return { href: crewHref(data.groupId), checkInGroupId: null };
      }

      if (["pact_signed", "pact_restart", "pact_complete", "join"].includes(data.kind)) {
        return data.groupId && await activeCrew(data.groupId) ? { href: crewHref(data.groupId), checkInGroupId: null } : none;
      }
      if (data.kind === "message") {
        if (!data.groupId || !(await activeCrew(data.groupId)) || await blockedPairs(data.actorId)) return none;
        return { href: `/chat/${data.groupId}`, checkInGroupId: null };
      }
      if (data.kind === "follow_request") {
        if (!data.actorId || await blockedPairs(data.actorId)) return none;
        const { data: request, error } = await supabase.from("follows").select("follower_id")
          .eq("follower_id", data.actorId).eq("following_id", userId).eq("status", "requested").maybeSingle();
        return !error && request ? { href: "/follow-requests", checkInGroupId: null } : none;
      }
      if (["milestone", "follow", "follow_accepted"].includes(data.kind)) {
        return { href: await profileHref(data.actorId), checkInGroupId: null };
      }
      return none;
    } catch {
      return none;
    }
  });

/** Kept here for push senders to build the exact same indirect destination. */
export { activityOpenUrl };
