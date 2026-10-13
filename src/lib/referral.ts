import { isNative } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";

const ORIGIN = "https://pactara.lovable.app";
const KEY = "referral-install-id";
const ASKED = "referral-install-asked";

/** Fresh native install with no account: ask once whether a creator link brought us here. */
export async function claimReferralInstall() {
  if (!isNative()) return;
  try {
    if (localStorage.getItem(ASKED)) return;
    localStorage.setItem(ASKED, "1");
    const res = await fetch(`${ORIGIN}/api/public/referral/install`, { method: "POST" });
    const json = (await res.json()) as { installId?: string | null };
    if (json.installId) localStorage.setItem(KEY, json.installId);
  } catch {
    // best effort
  }
}

/** After sign-in, attach the referred install to the new account. */
export async function linkReferralInstall() {
  try {
    const installId = localStorage.getItem(KEY);
    if (!installId) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch(`${ORIGIN}/api/public/referral/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ installId }),
    });
    const json = (await res.json().catch(() => ({}))) as { done?: boolean };
    if (json.done) localStorage.removeItem(KEY);
  } catch {
    // retry next sign-in
  }
}
