import { supabase } from "@/integrations/supabase/client";
import { getCustomerInfo, isSubscriptionActive } from "@/lib/revenuecat";
import { isNative } from "@/lib/native";

/**
 * Active subscription or store trial: the entitlement persisted by the
 * RevenueCat webhook, falling back to the device's live RevenueCat
 * entitlement (covers the moments right after a purchase, before the webhook lands).
 */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("is_active, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (sub?.is_active) {
    const expiresAt = sub.expires_at ? new Date(sub.expires_at).getTime() : null;
    if (expiresAt === null || expiresAt > Date.now()) return true;
  }
  if (isNative()) {
    try {
      return isSubscriptionActive(await getCustomerInfo());
    } catch (err) {
      console.error("[membership] RevenueCat subscription check failed", err);
    }
  }
  return false;
}
