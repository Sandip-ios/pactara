import type { SupabaseClient } from "@supabase/supabase-js";
import type { EveningPushDeps } from "@/lib/evening-push-plan";

/** Database side of sendEveningPush: claim/finish rows in evening_push_sends. */
export function eveningPushDeps(
  admin: SupabaseClient,
  push: EveningPushDeps["push"],
): EveningPushDeps {
  return {
    claim: async (userId, localDate, hour) => {
      const { data, error } = await admin.rpc("claim_evening_push", {
        _user_id: userId,
        _local_date: localDate,
        _hour: hour,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
    finish: async (userId, localDate, status, groupIds) => {
      const { error } = await admin
        .from("evening_push_sends")
        .update({ status, group_ids: groupIds, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("local_date", localDate);
      if (error) console.warn("[evening-push] couldn't record send", error.message);
    },
    push,
  };
}
