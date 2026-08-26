import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Image as ImageIcon, Send, Zap, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { getMyGroupStatus, getPendingCheckIns, listMyGroups, getGroupMemberStreaks } from "@/lib/groups.functions";
import { getGroupFeed, getTodayRitualStatus, postThought, type FeedItem, type TimelineNode } from "@/lib/daily-posts.functions";
import { TodaySnapshot, type SnapshotState } from "@/components/TodaySnapshot";

import { OnboardingSheet } from "@/components/OnboardingSheet";
import { WelcomeSheet } from "@/components/WelcomeSheet";
import { GettingStarted } from "@/components/GettingStarted";
import { TimelineCard } from "@/components/TimelineCard";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BadgeUnlockedModal } from "@/components/BadgeUnlockedModal";
import { supabase } from "@/integrations/supabase/client";

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
const TIMELINE_DAY_START_HOUR = 0;

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}





function timelineDateFor(iso: string) {
  const d = new Date(iso);
  d.setHours(d.getHours() - TIMELINE_DAY_START_HOUR);
  return formatLocalDate(d);
}

function nodeTimelineDate(item: FeedItem, node: TimelineNode) {
  if (node.kind === "pending" || node.kind === "ritual_missed" || node.kind === "check_in_missed") {
    return item.localDate;
  }
  return timelineDateFor(node.at);
}

function splitFeedIntoTimelineCards(items: FeedItem[]) {
  const grouped = new Map<string, FeedItem>();

  for (const item of items) {
    const nodes = item.nodes.length > 0 ? item.nodes : [{ kind: "pending", id: `empty-${item.id}` } as TimelineNode];
    for (const node of nodes) {
      const localDate = nodeTimelineDate(item, node);
      const key = `${item.userId}-${localDate}`;
      const nodeAt = "at" in node ? node.at : item.updatedAt;
      const existing = grouped.get(key);

      if (existing) {
        existing.nodes.push(node);
        if (existing.updatedAt < nodeAt) existing.updatedAt = nodeAt;
      } else {
        grouped.set(key, {
          ...item,
          id: item.id,
          localDate,
          updatedAt: nodeAt,
          nodes: [node],
        });
      }
    }
  }

  // Ensure any card that contains a morning ritual also shows a check-in state.
  // If grouping by the 4 AM timeline-day boundary leaves a ritual card without a
  // check_in / check_in_missed / pending node, append a pending placeholder.
  for (const card of grouped.values()) {
    const hasRitual = card.nodes.some((n) => n.kind === "ritual");
    if (!hasRitual) continue;
    const hasCheckInState = card.nodes.some(
      (n) => n.kind === "check_in" || n.kind === "check_in_missed" || n.kind === "pending",
    );
    if (!hasCheckInState) {
      card.nodes.push({ kind: "pending", id: `p-${card.id}` } as TimelineNode);
    }
  }

  // Sort each card's nodes: ritual (or ritual_missed) pinned to top, then chronological.
  for (const card of grouped.values()) {
    card.nodes.sort((a, b) => {
      const aRit = a.kind === "ritual" || a.kind === "ritual_missed" ? 0 : 1;
      const bRit = b.kind === "ritual" || b.kind === "ritual_missed" ? 0 : 1;
      if (aRit !== bRit) return aRit - bRit;
      const aAt = "at" in a ? a.at : "";
      const bAt = "at" in b ? b.at : "";
      if (!aAt && !bAt) return 0;
      if (!aAt) return 1;
      if (!bAt) return -1;
      return aAt < bAt ? 1 : aAt > bAt ? -1 : 0;
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.localDate !== b.localDate) return a.localDate < b.localDate ? 1 : -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { data: status } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
  });
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const myGroups = groupsData?.groups ?? [];

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });

  // Default to first group when none selected or selection no longer valid.
  useEffect(() => {
    if (myGroups.length === 0) return;
    const exists = selectedGroupId && myGroups.some((g) => g.id === selectedGroupId);
    if (!exists) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", selectedGroupId);
    }
  }, [selectedGroupId]);

  const { data: pendingData } = useQuery({
    queryKey: ["pending-checkins", selectedGroupId],
    queryFn: () => getPendingCheckIns({ data: { groupId: selectedGroupId } }),
  });
  const { data: feedData } = useQuery({
    queryKey: ["group-feed", selectedGroupId],
    queryFn: () => getGroupFeed({ data: { groupId: selectedGroupId } }),
    refetchOnWindowFocus: true,
  });
  const { data: streaksData } = useQuery({
    queryKey: ["group-member-streaks", selectedGroupId],
    queryFn: () => getGroupMemberStreaks({ data: { groupId: selectedGroupId } }),
    staleTime: 60_000,
  });
  const { data: ritualStatus } = useQuery({
    queryKey: ["today-ritual-status", selectedGroupId],
    queryFn: () => getTodayRitualStatus({ data: { groupId: selectedGroupId } }),
    refetchOnWindowFocus: true,
  });



  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingBadges, setPendingBadges] = useState<number[] | null>(null);

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

  const pickImage = () => {
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
      setShowWelcome(true);
    }
  }, [status, navigate]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
  };

  const initials = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const firstName = status?.firstName || "there";

  return (
    <div className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-24" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header
        className="bg-white pl-6 pr-6 pb-4 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span><span>actara</span>
        </div>
        <button
          onClick={() => setShowOnboarding(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold"
          style={{ background: "#EDE6FE", color: PURPLE }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          How Pactara works
        </button>
      </header>
      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return (
                k === "group-feed" ||
                k === "pending-checkins" ||
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
        const duration = (activeGroup as { durationDays?: number } | undefined)?.durationDays ?? 30;
        const startSource =
          (activeGroup as { startDate?: string | null } | undefined)?.startDate ??
          activeGroup?.createdAt;
        let dayNumber = 1;
        if (startSource) {
          const start = (activeGroup as { startDate?: string | null } | undefined)?.startDate
            ? new Date(`${(activeGroup as { startDate: string }).startDate}T00:00:00`)
            : new Date(activeGroup!.createdAt as string);
          const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const now = new Date();
          const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffDays = Math.floor((todayLocal.getTime() - startLocal.getTime()) / 86400000);
          dayNumber = Math.min(duration, Math.max(1, diffDays + 1));
        }
        const hasMultiple = myGroups.length > 1;
        return (
          <div className="px-6 pt-4 pb-3 border-b border-neutral-200 flex items-center justify-between text-[15px]">
            {hasMultiple ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 font-bold text-neutral-900 active:opacity-70">
                    {activeGroup?.emoji && <span>{activeGroup.emoji}</span>}
                    <span className="truncate max-w-[200px]">{activeGroup?.name ?? "Group"}</span>
                    <ChevronDown size={16} className="text-neutral-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[220px]">
                  {myGroups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onSelect={() => setSelectedGroupId(g.id)}
                      className="flex items-center gap-2"
                    >
                      {g.emoji && <span>{g.emoji}</span>}
                      <span className="truncate">{g.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                {activeGroup?.emoji && <span>{activeGroup.emoji}</span>}
                <span className="truncate max-w-[220px]">{activeGroup?.name ?? ""}</span>
              </div>
            )}
            <span className="text-neutral-400 text-[13px]">Day {dayNumber} of {duration}</span>
          </div>
        );
      })()}
      {(() => {
        const ritualDone = ritualStatus?.posted ?? false;
        const beforeNoon = ritualStatus?.beforeNoon ?? true;
        const checkedIn = pendingData?.iCheckedIn ?? false;

        const state: SnapshotState = checkedIn
          ? "done"
          : !ritualDone && beforeNoon
            ? "ritual"
            : "check-in";

        // Build a 7-day week (Sun→Sat) of completion for the current user.
        const now = new Date();
        const week: { label: string; done: boolean }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const done = (feedData?.items ?? []).some(
            (item) => item.isMe && item.localDate === key && item.nodes.some((n) => n.kind === "check_in" || n.kind === "ritual"),
          );
          week.push({ label: key, done });
        }

        const myStreak =
          streaksData?.members?.find((m) => m.isYou)?.streak ?? 0;
        const myLongest =
          streaksData?.members?.find((m) => m.isYou)?.longestStreak ?? 0;

        return (
          <TodaySnapshot
            state={state}
            week={week}
            streak={myStreak}
            longestStreak={myLongest}
          />
        );
      })()}


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
          <button onClick={pickImage} className="h-10 w-10 rounded-lg flex items-center justify-center" aria-label="Add photo">
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
            <button onClick={pickImage} className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center" aria-label="Add photo">
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

      {(streaksData?.members.length ?? 0) > 0 && (
        <div className="pt-3">
          <div className="flex gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(streaksData?.members ?? []).map((m) => {
              const initial = (m.name || "U").slice(0, 1).toUpperCase();
              return (
                <div key={m.userId} className="shrink-0 flex flex-col items-center pb-2">
                  <div className="relative">
                    <div
                      className="h-[128px] w-[80px] rounded-lg flex items-center justify-center text-white font-bold text-[22px] overflow-hidden"
                      style={{ background: m.avatarColor }}
                    >
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>

                    <div
                      className="absolute left-1/2 -translate-x-1/2 -bottom-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[14px] font-bold text-neutral-800 shadow-sm"
                    >
                      <span className="text-[14px] leading-none">🔥</span>
                      <span className="leading-none">{m.streak}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {(() => {
        const cards = splitFeedIntoTimelineCards(feedData?.items ?? []);
        // Hide cards that only contain a "check-in pending" placeholder — e.g. a
        // brand-new group where nobody has posted a ritual, thought, or check-in
        // yet. Showing those as empty cards is noise; surface the empty state
        // instead so members aren't greeted by pending placeholders.
        const visibleCards = cards.filter((c) =>
          c.nodes.some((n) => n.kind !== "pending"),
        );
        if (visibleCards.length === 0) {
          return (
            <div className="mx-4 mt-6 rounded-2xl bg-white p-8 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                <MessageSquare size={24} style={{ color: PURPLE }} />
              </div>
              <div className="text-[16px] font-bold">Your feed is empty</div>
              <div className="text-[13px] text-neutral-500 mt-1 max-w-[260px]">
                Share what's on your mind or check in to start your streak.
              </div>
            </div>
          );
        }
        return (
          <div className="pb-2">
            {visibleCards.map((item) => (
              <TimelineCard key={`${item.id}-${item.localDate}`} item={item} />
            ))}
          </div>
        );
      })()}

      {/* Getting started checklist hidden for now */}
      {false && <GettingStarted iCheckedIn={pendingData?.iCheckedIn ?? false} />}

      </PullToRefresh>
      {showOnboarding && <OnboardingSheet firstName={firstName} onClose={dismissOnboarding} />}
      {showWelcome && (
        <WelcomeSheet firstName={firstName} onClose={() => setShowWelcome(false)} />
      )}
      {pendingBadges && pendingBadges.length > 0 && (
        <BadgeUnlockedModal badges={pendingBadges} onClose={() => setPendingBadges(null)} />
      )}
    </div>
  );
}


