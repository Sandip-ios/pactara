import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { launchScreenUp } from "@/lib/launch-screen";
import { anyOverlayOnScreen, getLayoutOverlayState } from "@/lib/app-overlays";
import {
  WHATS_NEW_ITEMS,
  WHATS_NEW_VERSION,
  shouldShowWhatsNew,
  whatsNewLocalKey,
  type WhatsNewState,
} from "@/lib/whats-new";

const PURPLE = "#7C3AED";
const INK = "#141218";
/** Per account: a cached state from another account signed in on this tab must never decide. */
const whatsNewKey = (userId: string) => ["whats-new-state", userId] as const;

function useSignedInUserId(): string {
  return useRouteContext({ from: "/_authenticated" }).user.id;
}

function readLocalSeen(userId: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(whatsNewLocalKey(userId));
  } catch {
    return null;
  }
}

async function loadWhatsNewState(): Promise<WhatsNewState & { userId: string | null }> {
  const { data: s } = await supabase.auth.getSession();
  const userId = s.session?.user.id ?? null;
  if (!userId) return { userId, accountCreatedAt: null, seenOnProfile: null, seenLocally: null };
  const { data } = await supabase.from("profiles").select("created_at, whats_new_seen").eq("id", userId).maybeSingle();
  return {
    userId,
    accountCreatedAt: data?.created_at ?? null,
    seenOnProfile: data?.whats_new_seen ?? null,
    seenLocally: readLocalSeen(userId),
  };
}

/** Save "seen" on the profile (works across devices); local storage keeps it if that write fails. */
async function markWhatsNewSeen(): Promise<void> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return;
    try {
      localStorage.setItem(whatsNewLocalKey(userId), WHATS_NEW_VERSION);
    } catch {
      /* ignore */
    }
    await supabase.from("profiles").update({ whats_new_seen: WHATS_NEW_VERSION }).eq("id", userId);
  } catch {
    /* the local copy covers this device */
  }
}

/**
 * Home: open the sheet once for eligible members, after the launch screen has
 * lifted and only when nothing else (sheet, dialog, paywall) is up. If
 * something is, skip until the next Home visit.
 */
export function useWhatsNewOnHome(homeBlocked: boolean) {
  const userId = useSignedInUserId();
  const { data: loaded } = useQuery({ queryKey: whatsNewKey(userId), queryFn: loadWhatsNewState, staleTime: 5 * 60_000 });
  const data = loaded && loaded.userId === userId ? loaded : undefined;
  const [open, setOpen] = useState(false);
  const decided = useRef(false);
  const blockedRef = useRef(homeBlocked);
  blockedRef.current = homeBlocked;
  const eligible = data ? shouldShowWhatsNew(data) : false;

  useEffect(() => {
    if (decided.current || !eligible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = (settled: boolean) => {
      if (cancelled) return;
      // Wait for the launch screen and the layout's paywall check.
      if (launchScreenUp() || getLayoutOverlayState().pending) {
        timer = setTimeout(() => tick(false), 250);
        return;
      }
      // Give one-time things that open right after Home appears a moment first.
      if (!settled) {
        timer = setTimeout(() => tick(true), 900);
        return;
      }
      decided.current = true;
      if (blockedRef.current || getLayoutOverlayState().blocking || anyOverlayOnScreen()) return;
      setOpen(true);
    };
    tick(false);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [eligible]);

  return { open, onOpenChange: setOpen };
}

export function WhatsNewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const userId = useSignedInUserId();
  const handleChange = (next: boolean) => {
    onOpenChange(next);
    if (next) return;
    queryClient.setQueryData(whatsNewKey(userId), (prev: WhatsNewState | undefined) =>
      prev ? { ...prev, seenOnProfile: WHATS_NEW_VERSION, seenLocally: WHATS_NEW_VERSION } : prev,
    );
    void markWhatsNewSeen();
  };

  return (
    <Drawer open={open} onOpenChange={handleChange}>
      <DrawerContent
        className="max-h-[92dvh] min-h-[78dvh] rounded-t-[24px] border-0 bg-white p-0"
        style={{ fontFamily: "Inter, system-ui, sans-serif", color: INK }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-5">
          <div className="text-[12px] font-extrabold tracking-[1px]" style={{ color: PURPLE }}>
            NOVEMBER UPDATE
          </div>
          <DrawerTitle className="mt-1 text-[30px] font-black leading-[1.1] tracking-[-0.5px]" style={{ color: INK }}>
            What's new in Pactara
          </DrawerTitle>
          <DrawerDescription className="sr-only">The latest changes to Pactara.</DrawerDescription>
          <ul className="mt-6 flex flex-col gap-5">
            {WHATS_NEW_ITEMS.map((it) => (
              <li key={it.title} className="flex items-start gap-[14px]">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[22px]"
                  style={{ background: it.tint }}
                  aria-hidden
                >
                  {it.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-snug">{it.title}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-neutral-500">{it.line}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 pt-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          <p className="text-center text-[13px] text-neutral-500">You can see this again in Profile</p>
          <button
            type="button"
            onClick={() => handleChange(false)}
            className="mt-3 h-[52px] w-full rounded-full text-[16px] font-bold text-white"
            style={{ background: PURPLE }}
          >
            Got it
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
