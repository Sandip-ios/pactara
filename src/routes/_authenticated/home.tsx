import { stabilizeSignedUrls } from "@/lib/stable-urls";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { parseFeedDeepLink } from "@/lib/feed-deeplink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Image as ImageIcon, Send, Zap, Bell, X } from "lucide-react";
import GroupSwitcherSheet from "@/components/GroupSwitcherSheet";

import { toast } from "sonner";
import { getMyGroupStatus, getPendingCheckIns, listMyGroups } from "@/lib/groups.functions";
import { getHomeCrew } from "@/lib/home-crew.functions";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { postThought, type FeedItem, type TimelineNode } from "@/lib/daily-posts.functions";
import { getRestDayInfo } from "@/lib/rest-days.functions";
import { CrewBar, CrewBarSkeleton } from "@/components/home/CrewBar";
import { TodayCard, TodayCardSkeleton, type TodayState } from "@/components/home/TodayCard";
import { CrewToday, CrewTodaySkeleton } from "@/components/home/CrewToday";
import { ShareInviteDrawer, inviteLinkFor } from "@/components/groups/GroupOverflowMenu";

import { OnboardingSheet } from "@/components/OnboardingSheet";
import { GettingStarted } from "@/components/GettingStarted";
import { FeedList } from "@/components/feed/FeedList";
import { useGroupFeed } from "@/components/feed/use-group-feed";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BadgeUnlockedModal } from "@/components/BadgeUnlockedModal";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { supabase } from "@/integrations/supabase/client";
import { loadCheckInDraft, clearCheckInDraft, type CheckInDraft } from "@/lib/checkin-draft-store";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { PartnerBanner } from "@/components/PartnerBanner";
import { relationForGroup } from "@/lib/group-display";
import { isNewMember as isNewAccount } from "@/lib/new-member";
import { getPartnerState } from "@/lib/partners.functions";
import { useServerFn as usePartnerServerFn } from "@tanstack/react-start";
import { useQuery as usePartnerQuery } from "@tanstack/react-query";

async function uploadThoughtPhoto(file: File): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const groupId = membership?.group_id;
    if (!groupId) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const path = `${groupId}/${userId}-thought-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) {
      console.error("thought photo upload failed", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("thought photo upload error", e);
    return null;
  }
}

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home · Pactara" },
      { name: "description", content: "Your daily check-ins, streaks, and accountability group on Pactara." },
      { property: "og:title", content: "Home · Pactara" },
      { property: "og:description", content: "Your daily check-ins, streaks, and accountability group on Pactara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function HomePage() {
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  // Deep link from a notification: /home?group=<id>&post=<id>[&comments=1]
  // Read reactively so a tap while already on the feed still switches groups.
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [search, setSearch] = useState<{ post?: string; comments?: boolean }>({});
  const [deepLinkGroup, setDeepLinkGroup] = useState<{ id: string } | null>(null);
  useEffect(() => {
    const link = parseFeedDeepLink(searchStr || window.location.search);
    if (!link.post && !link.group) return;
    if (link.post) setSearch({ post: link.post, comments: link.comments });
    void (async () => {
      let groupId = link.group;
      // Older notifications only carried the post — look up its group.
      if (!groupId && link.post) {
        const { data } = await supabase
          .from("daily_posts")
          .select("group_id")
          .eq("id", link.post)
          .maybeSingle();
        groupId = (data?.group_id as string | undefined) ?? undefined;
      }
      if (groupId) setDeepLinkGroup({ id: groupId });
    })();
    // Consume the link so the same notification can be tapped again later.
    void navigate({ to: "/home", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

  // Scroll the linked post into view once the feed has rendered it.
  useEffect(() => {
    if (!search.post) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const el = document.getElementById(`post-${search.post}`);
      if (el) {
        window.clearInterval(timer);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-purple-300", "rounded-2xl");
        window.setTimeout(
          () => el.classList.remove("ring-2", "ring-purple-300", "rounded-2xl"),
          2000,
        );
      } else if (tries > 40) {
        window.clearInterval(timer);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [search.post]);
  const { data: status } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
  });
  const { data: notifCount } = useQuery({
    queryKey: ["unread-notification-count"],
    queryFn: () => getUnreadNotificationCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const notifUnread = notifCount?.total ?? 0;
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const myGroups = groupsData?.groups ?? [];
  const fetchPartnerState = usePartnerServerFn(getPartnerState);
  const { data: partnerState } = usePartnerQuery({ queryKey: ["partner-state"], queryFn: () => fetchPartnerState(), staleTime: 30_000 });
  // Label reflects the accountability relationship, not the group's stored name.
  const relationFor = (groupId: string | null | undefined) => relationForGroup(groupId, partnerState);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });

  // A notification for another group switches the feed to that group.
  useEffect(() => {
    if (!deepLinkGroup) return;
    if (myGroups.some((g) => g.id === deepLinkGroup.id)) {
      setSelectedGroupId(deepLinkGroup.id);
      setDeepLinkGroup(null);
    }
  }, [deepLinkGroup, myGroups]);

  // Default to first group when none selected or selection no longer valid.
  useEffect(() => {
    if (myGroups.length === 0) return;
    if (deepLinkGroup && myGroups.some((g) => g.id === deepLinkGroup.id)) return;
    const exists = selectedGroupId && myGroups.some((g) => g.id === selectedGroupId);
    if (!exists) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups, selectedGroupId, deepLinkGroup]);

  useEffect(() => {
    if (selectedGroupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", selectedGroupId);
    }
  }, [selectedGroupId]);

  const { data: pendingData } = useQuery({
    queryKey: ["pending-checkins", selectedGroupId],
    queryFn: () => getPendingCheckIns({ data: { groupId: selectedGroupId } }),
  });
  const groupFeed = useGroupFeed(selectedGroupId, { refetchOnWindowFocus: true });
  const feedData = groupFeed.feed;
  const { data: crew, isPending: crewLoading } = useQuery({
    queryKey: ["home-crew", selectedGroupId],
    queryFn: () => getHomeCrew({ data: { groupId: selectedGroupId } }).then(stabilizeSignedUrls),
    enabled: Boolean(selectedGroupId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const { data: restInfo } = useQuery({
    queryKey: ["rest-day-info"],
    queryFn: () => getRestDayInfo(),
    staleTime: 30_000,
  });



  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingBadges, setPendingBadges] = useState<number[] | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [checkInDraft, setCheckInDraft] = useState<CheckInDraft | null>(null);

  // Surface a saved check-in draft (from a failed share on weak connectivity)
  // so the member can resume it once they're back online.
  useEffect(() => {
    let cancelled = false;
    void loadCheckInDraft().then((draft) => {
      if (!cancelled && draft) setCheckInDraft(draft);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("checkin-celebrate") === "1") {
      sessionStorage.removeItem("checkin-celebrate");
      setShowConfetti(true);
    }
  }, []);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const raw = sessionStorage.getItem("pending-badge-announce");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setPendingBadges(parsed.filter((n) => typeof n === "number"));
      }
    } catch {
      // ignore malformed value
    }
    sessionStorage.removeItem("pending-badge-announce");
  }, []);

  // One-time preview of the milestone celebration on the next app open.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (sessionStorage.getItem("show-welcome") === "1") return;
    if (localStorage.getItem("badge-celebration-preview-shown") === "1") return;
    localStorage.setItem("badge-celebration-preview-shown", "1");
    const t = setTimeout(() => setPendingBadges((p) => p ?? [7]), 600);
    return () => clearTimeout(t);
  }, []);

  // One-time "How Pactara works" popover pointing at the header button.
  // Only new members (account created within the last 21 days) see it; long-time
  // users get permanently marked as seen so it never appears for them.
  const [showHowItWorksTip, setShowHowItWorksTip] = useState(false);
  // Same 21-day rule as the tooltip: only new members see the header pill;
  // everyone can open the guide from Account settings.
  const isNewMember = isNewAccount(status?.accountCreatedAt);
  const dismissHowItWorksTip = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("how-pactara-works-tip-seen", "1");
    }
    setShowHowItWorksTip(false);
  };
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("how-pactara-works-tip-seen") === "1") return;
    // The full guide is about to open for a new signup; don't show its tooltip over it.
    if (sessionStorage.getItem("show-welcome") === "1") return;
    if (!status) return;
    if (!isNewAccount(status.accountCreatedAt)) {
      localStorage.setItem("how-pactara-works-tip-seen", "1");
      return;
    }
    const t = setTimeout(() => {
      if (localStorage.getItem("how-pactara-works-tip-seen") !== "1") setShowHowItWorksTip(true);
    }, 900);
    return () => clearTimeout(t);
  }, [status]);

  const queryClient = useQueryClient();
  const postThoughtFn = useServerFn(postThought);
  const thoughtMutation = useMutation({
    mutationFn: postThoughtFn,
    onSuccess: () => {
      setComposerOpen(false);
      setComposerText("");
      setImagePreview(null);
      setImageFile(null);
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
    },
  });


  const submitThought = async () => {
    const text = composerText.trim();
    if (!text && !imageFile) return;
    let photoPath: string | null = null;
    if (imageFile) {
      setUploading(true);
      photoPath = await uploadThoughtPhoto(imageFile);
      setUploading(false);
      if (!photoPath) return;
    }
    thoughtMutation.mutate({ data: { text: text || undefined, photoUrl: photoPath || undefined } });
  };

  // iOS ghost-tap guard: when the keyboard collapses or the page shifts
  // mid-tap, the click event can dispatch at stale coordinates and land on
  // this button, opening the photo picker unexpectedly. Only honor a click
  // when a touch actually started on the button recently, or on devices that
  // never send touch events (desktop).
  const addPhotoTouchAt = useRef(0);
  const pickImage = () => {
    const touched = addPhotoTouchAt.current;
    if (touched !== 0 && Date.now() - touched > 1500) return;
    setComposerOpen(true);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setImageFile(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (composerOpen) composerRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    if (status && typeof sessionStorage !== "undefined" && sessionStorage.getItem("show-welcome") === "1") {
      sessionStorage.removeItem("show-welcome");
      dismissHowItWorksTip();
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  }, [status]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
  };

  const initials = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const firstName = status?.firstName || "there";

  return (
    <div data-scroll-root className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-24" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header
        className="bg-white px-4 pb-3 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span><span>actara</span>
        </div>
        <div className="flex items-center gap-1">
          {isNewMember && (
            <button
              type="button"
              onClick={() => {
                dismissHowItWorksTip();
                setShowOnboarding(true);
              }}
              className="flex h-11 items-center"
            >
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold"
                style={{ background: "#EDE6FE", color: PURPLE }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                How Pactara works
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate({ to: "/notifications" })}
            aria-label={notifUnread > 0 ? `Notifications, ${notifUnread} unread` : "Notifications"}
            className="relative flex h-11 w-11 items-center justify-center"
          >
            <span
              className="relative flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "#EDE6FE", color: PURPLE }}
            >
              <Bell size={18} />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold leading-none flex items-center justify-center">
                  {notifUnread > 99 ? "99+" : notifUnread}
                </span>
              )}
            </span>
          </button>
        </div>

      </header>
      <PartnerBanner />

      {/* One-time popover pointing at the "How Pactara works" button.
          Portaled to document.body so it stays fixed on screen instead of
          drifting with the page's scroll container on iOS. */}
      {showHowItWorksTip &&
        createPortal(
          <div
            className="fixed inset-x-0 z-40 flex justify-end pr-4"
            style={{ top: "calc(env(safe-area-inset-top) + 58px)" }}
          >
            <div className="relative">
              {/* Caret pointing up at the header button */}
              <div className="absolute -top-[7px] right-[145px] h-3.5 w-3.5 rotate-45 rounded-[3px] bg-[#1B1A21]" />
              <div className="relative block max-w-[248px] rounded-2xl bg-[#1B1A21] px-4 py-3 pr-9 text-left shadow-xl">
                <button
                  type="button"
                  onClick={dismissHowItWorksTip}
                  aria-label="Dismiss"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 active:opacity-70"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
                <div className="text-[13px] font-bold leading-tight text-white">
                  New here?
                </div>
                <div className="mt-1 text-[12px] leading-snug text-white/65">
                  Start here to get the most out of Pactara.
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return (
                k === "group-feed" ||
                k === "pending-checkins" ||
                k === "home-crew" ||
                k === "rest-day-info" ||
                k === "workout-state" ||
                k === "my-groups" ||
                k === "my-group-status" ||
                k === "unread-chat-counts"
              );
            },
          })
        }
      >

      {(() => {
        const activeGroup = myGroups.find((g) => g.id === selectedGroupId) ?? myGroups[0];
        // No group yet: keep the plain check-in card, as before.
        if (groupsData && myGroups.length === 0) {
          return (
            <TodayCard
              state="check-in"
              groupId={null}
              streak={0}
              inCount={0}
              dueCount={1}
              solo
              week={null}
              myCheckIn={null}
            />
          );
        }
        if (!groupsData || !activeGroup || crewLoading || !crew) {
          return (
            <>
              <CrewBarSkeleton />
              <TodayCardSkeleton />
              <CrewTodaySkeleton />
            </>
          );
        }
        const rel = relationFor(activeGroup.id);
        const label = rel?.name ?? activeGroup.name ?? "Group";
        const icon = rel?.emoji ?? activeGroup.emoji;
        const solo = crew.memberCount <= 1;
        const me = crew.members.find((m) => m.isYou);
        const todayState: TodayState =
          me?.status === "done" ? "done" : me?.status === "rest" ? "rest" : "check-in";
        const weekInfo = restInfo?.groups.find((g) => g.groupId === crew.groupId) ?? null;
        return (
          <>
            <CrewBar
              label={label}
              icon={icon}
              canSwitch={myGroups.length > 1}
              onOpenSwitcher={() => setSwitcherOpen(true)}
              dayNumber={crew.dayNumber}
              durationDays={crew.durationDays}
              streak={solo ? crew.myStreak : crew.groupStreak}
              solo={solo}
              weeklyTarget={crew.weeklyTarget}
            />
            {myGroups.length > 1 && (
              <GroupSwitcherSheet
                open={switcherOpen}
                onClose={() => setSwitcherOpen(false)}
                groups={myGroups}
                selectedGroupId={selectedGroupId}
                onSelect={(id) => setSelectedGroupId(id)}
              />
            )}
            <TodayCard
              state={todayState}
              groupId={crew.groupId}
              streak={crew.myStreak}
              inCount={crew.inCount}
              dueCount={crew.dueCount}
              solo={solo}
              week={weekInfo ? { workouts: weekInfo.workouts, target: weekInfo.target, restLeft: weekInfo.restLeft } : null}
              myCheckIn={crew.myCheckIn}
            />
            <CrewToday
              groupId={crew.groupId}
              members={crew.members}
              solo={solo}
              onInvite={() => setInviteOpen(true)}
            />
            {inviteOpen && (
              <ShareInviteDrawer
                open
                onOpenChange={(o) => {
                  if (!o) setInviteOpen(false);
                }}
                groupName={label}
                inviteLink={inviteLinkFor(crew.groupId)}
                shareText="Accept your invite to my Pactara group!"
                copied={inviteCopied}
                onCopy={() => {
                  navigator.clipboard.writeText(inviteLinkFor(crew.groupId)).catch(() => {});
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 1800);
                }}
              />
            )}
          </>
        );
      })()}

      {checkInDraft && (
        <div className="mx-4 mt-3 rounded-2xl bg-white ring-1 ring-neutral-200 p-4 flex items-center gap-3">
          <div
            className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-[20px]"
            style={{ background: "#EDE6FE" }}
          >
            {checkInDraft.isVideo ? "🎬" : "📸"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-neutral-900">Draft check-in</div>
            <div className="text-[13px] text-neutral-500 truncate">
              {checkInDraft.note
                ? checkInDraft.note
                : checkInDraft.isVideo
                  ? "Your video is saved — share it when you're back online."
                  : "Your photo is saved — share it when you're back online."}
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/check-in/notes" })}
            className="shrink-0 rounded-full px-4 py-2 text-white text-[14px] font-semibold"
            style={{ background: PURPLE }}
          >
            Resume
          </button>
          <button
            onClick={() => {
              void clearCheckInDraft();
              setCheckInDraft(null);
            }}
            aria-label="Discard draft"
            className="shrink-0 h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {!composerOpen ? (
        <div className="mx-4 mt-3 p-3 flex items-center gap-[10px]">
          <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold overflow-hidden" style={{ background: PURPLE }}>
            {status?.avatarUrl ? <img src={status.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex-1 text-left rounded-full pr-4 py-3 text-[15px] text-neutral-500"
          >
            What's on your mind, {firstName}?
          </button>
          <button
            onClick={pickImage}
            onTouchStart={() => { addPhotoTouchAt.current = Date.now(); }}
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            aria-label="Add photo"
          >
            <ImageIcon size={20} className="text-green-600" />
          </button>
        </div>

      ) : (
        <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex gap-3 p-4">
            <div className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-white font-bold overflow-hidden" style={{ background: PURPLE }}>
              {status?.avatarUrl ? <img src={status.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <textarea
              ref={composerRef}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={`What's on your mind, ${firstName}?`}
              className="flex-1 resize-none outline-none text-[16px] placeholder:text-neutral-400 min-h-[96px] bg-transparent"
            />
          </div>
          {imagePreview && (
            <div className="px-4 pb-3">
              <div className="relative inline-block">
                <img src={imagePreview} alt="Selected" className="max-h-48 rounded-lg" />
                <button
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full h-6 w-6 text-xs"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div className="border-t border-neutral-100 px-3 py-2 flex items-center justify-between">
            <button
              onClick={pickImage}
              onTouchStart={() => { addPhotoTouchAt.current = Date.now(); }}
              className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"
              aria-label="Add photo"
            >
              <ImageIcon size={20} className="text-green-600" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setComposerOpen(false); setComposerText(""); setImagePreview(null); setImageFile(null); }}
                className="px-4 py-2 rounded-full bg-neutral-100 text-[14px] font-semibold text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={submitThought}
                disabled={(!composerText.trim() && !imageFile) || thoughtMutation.isPending || uploading}
                className="px-4 py-2 rounded-full text-white text-[14px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: (composerText.trim() || imageFile) ? PURPLE : "#D4D4D4" }}
              >
                <Send size={16} />
                {uploading ? "Uploading…" : thoughtMutation.isPending ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <FeedList
        items={feedData?.items}
        meta={feedData?.meta}
        loading={groupFeed.isPending}
        refreshFailed={groupFeed.refreshFailed}
        onRetry={() => void groupFeed.refetch()}
        hasMore={groupFeed.hasMore}
        loadingMore={groupFeed.loadingMore}
        loadMoreFailed={groupFeed.loadMoreFailed}
        onLoadMore={groupFeed.loadMore}
        groupId={selectedGroupId}
        todayCounts={crew && crew.groupId === feedData?.items[0]?.groupId ? { inCount: crew.inCount, dueCount: crew.dueCount } : null}
        deepLinkPost={search.post}
        deepLinkComments={Boolean(search.comments)}
        onInvite={crew ? () => setInviteOpen(true) : undefined}
        solo={
          relationFor(crew?.groupId ?? selectedGroupId)?.kind === "solo" ||
          Boolean(crew && crew.groupId === (selectedGroupId ?? crew.groupId) && crew.memberCount <= 1)
        }
      />

      {/* Getting started checklist hidden for now */}
      {false && <GettingStarted iCheckedIn={pendingData?.iCheckedIn ?? false} />}

      </PullToRefresh>
      {showOnboarding && <OnboardingSheet firstName={firstName} onClose={dismissOnboarding} initialStep={onboardingStep} />}
      {pendingBadges && pendingBadges.length > 0 && (
        <BadgeUnlockedModal badges={pendingBadges} onClose={() => setPendingBadges(null)} />
      )}
      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
    </div>
  );
}


