import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  Grid3x3,
  Award,
  BarChart3,
  Play,
  MessageCircle,
  SlidersHorizontal,
  Snowflake,
  TrendingUp,
  TrendingDown,
  Minus,
  Percent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMemberProfile } from "@/lib/member-profile.functions";
import { setAvatarPath } from "@/lib/profile.functions";
import { getStreakFreezeInfo, applyStreakFreeze } from "@/lib/streak-freezes.functions";
import { BADGE_META, BADGE_MILESTONES } from "@/lib/badges";
import { MediaLightbox } from "@/components/MediaLightbox";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import GroupSwitcherSheet from "@/components/GroupSwitcherSheet";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";
const GREEN_SOFT = "#DCFCE7";
const RED_SOFT = "#FEE2E2";
const ICE = "#38BDF8";
const ICE_SOFT = "#E0F2FE";

type Tab = "posts" | "badges" | "stats";

export function ProfileView({ userId = null }: { userId?: string | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwn = userId === null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);
  const saveAvatarPath = useServerFn(setAvatarPath);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });

  const { data } = useQuery({
    queryKey: ["member-profile", userId, selectedGroupId],
    queryFn: () => getMemberProfile({ data: { userId, groupId: selectedGroupId } }),
  });

  useEffect(() => {
    if (isOwn && data?.groupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", data.groupId);
    }
  }, [isOwn, data?.groupId]);

  const groups = data?.sharedGroups ?? [];
  const activeGroup = groups.find((g) => g.id === data?.groupId) ?? null;

  const name = data?.name || "";
  const firstName = name.split(" ")[0] || (isOwn ? "You" : "Member");
  const initial = (firstName || "U").slice(0, 1).toUpperCase();

  const goalLine = data?.personalGoal?.trim() || null;

  const openPicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw userErr ?? new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userRes.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await saveAvatarPath({ data: { path } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["member-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["my-group-status"] }),
        queryClient.invalidateQueries({ queryKey: ["my-groups"] }),
      ]);
    } catch (err) {
      console.error("Avatar upload failed", err);
      alert("Couldn't update your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const stat = (n: number) => (n > 0 ? String(n) : "—");

  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <header className="bg-white px-4 pt-safe-5 pb-4 grid grid-cols-[40px_1fr_40px] items-center">
        {isOwn ? (
          <div className="w-10" />
        ) : (
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.history.back();
              } else {
                navigate({ to: "/groups" });
              }
            }}
            aria-label="Back"
            className="h-9 w-9 rounded-full flex items-center justify-center justify-self-start"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {groups.length > 1 && activeGroup ? (
          <div className="justify-self-center">
            <button
              type="button"
              onClick={() => setGroupPickerOpen(true)}
              className="flex items-center gap-1.5 max-w-[220px] active:opacity-70"
            >
              {activeGroup.emoji && (
                <span className="text-[16px] leading-none">{activeGroup.emoji}</span>
              )}
              <span className="text-[17px] font-bold truncate">{activeGroup.name}</span>
              <ChevronDown size={16} className="text-neutral-400 shrink-0" />
            </button>
            <GroupSwitcherSheet
              open={groupPickerOpen}
              onClose={() => setGroupPickerOpen(false)}
              groups={groups}
              selectedGroupId={data?.groupId ?? null}
              onSelect={(id) => setSelectedGroupId(id)}
            />
          </div>
        ) : (
          <div className="text-[17px] font-bold truncate text-center justify-self-center">
            {activeGroup?.name ?? (isOwn ? "Profile" : firstName)}
          </div>
        )}
        <div />
      </header>

      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "member-profile",
          })
        }
      >
        {/* Identity */}
        <section className="bg-white px-6 pb-5 pt-4">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={isOwn ? openPicker : undefined}
                aria-label={isOwn ? "Change photo" : firstName}
                className="h-20 w-20 rounded-full flex items-center justify-center text-white text-[32px] font-bold overflow-hidden"
                style={{ background: data?.avatarColor || PURPLE }}
              >
                {data?.avatarUrl ? (
                  <img src={data.avatarUrl} alt={firstName} className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </button>
              {isOwn && (
                <button
                  type="button"
                  onClick={openPicker}
                  aria-label="Change photo"
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center shadow-sm disabled:opacity-60"
                >
                  <Camera size={14} className="text-neutral-600" />
                </button>
              )}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <HeadStat value={stat(data?.totalCheckIns ?? 0)} label="check-ins" />
              <HeadStat value={stat(data?.currentStreak ?? 0)} label="streak" />
              <HeadStat value={`${data?.onTimeRatePct ?? 0}%`} label="on time" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[18px] font-bold truncate">{name || firstName}</div>
            {goalLine && (
              <div className="text-[13px] text-neutral-500 truncate mt-0.5">{goalLine}</div>
            )}
          </div>

          <div className="mt-4">
            {isOwn ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/account-settings" })}
                className="w-full rounded-full py-2.5 text-[14px] font-semibold flex items-center justify-center gap-2"
                style={{ background: PURPLE_SOFT, color: PURPLE }}
              >
                <SlidersHorizontal size={16} />
                Settings
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  data?.groupId &&
                  navigate({ to: "/chat/$groupId", params: { groupId: data.groupId } })
                }
                className="w-full rounded-full py-2.5 text-white text-[14px] font-semibold flex items-center justify-center gap-2"
                style={{ background: PURPLE }}
              >
                <MessageCircle size={16} />
                Message
              </button>
            )}
          </div>

        </section>

        {/* Tabs */}
        <div className="bg-white flex border-t border-neutral-100 sticky top-0 z-10">
          <TabButton active={tab === "posts"} onClick={() => setTab("posts")} label="Posts">
            <Grid3x3 size={20} />
          </TabButton>
          <TabButton active={tab === "badges"} onClick={() => setTab("badges")} label="Badges">
            <Award size={20} />
          </TabButton>
          <TabButton active={tab === "stats"} onClick={() => setTab("stats")} label="Stats">
            <BarChart3 size={20} />
          </TabButton>
        </div>

        {tab === "posts" && (
          <section className="bg-white">
            {(data?.media ?? []).length === 0 ? (
              <div className="py-16 text-center text-[14px] text-neutral-400">
                No check-ins yet
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-[2px]">
                {(data?.media ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLightbox({ src: m.url, kind: m.kind })}
                    className="relative aspect-square overflow-hidden bg-neutral-100"
                    aria-label={m.kind === "video" ? "View video" : "View photo"}
                  >
                    {m.kind === "video" ? (
                      <video
                        src={`${m.url}#t=0.1`}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    )}
                    {m.kind === "video" && (
                      <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
                        <Play size={14} fill="white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "badges" && (
          <section className="px-5 pt-5">
            <div className="rounded-2xl bg-white p-5">
              <BadgesGrid earned={data?.badges ?? []} />
            </div>
          </section>
        )}

        {tab === "stats" && (
          <section className="px-5 pt-5">
            {isOwn && (
              <StreakFreezeCard
                available={data?.streakFreezesAvailable ?? 0}
                onUse={() => setFreezeOpen(true)}
              />
            )}

            <div className="mt-3 rounded-2xl bg-white p-5">
              <div className="text-[16px] font-bold">Past 7 days</div>
              <Past7Days days={data?.past7 ?? []} />
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="mt-4 w-full text-center text-[13px] font-semibold py-2 rounded-full"
                style={{ background: PURPLE_SOFT, color: PURPLE }}
              >
                View past 3 months
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-5 space-y-4">
              <div className="text-[16px] font-bold">Insights</div>
              <InsightRow
                label="Check-in rate"
                value={`${data?.checkInRatePct ?? 0}%`}
                sub={`${data?.uniqueDaysCheckedIn ?? 0} of ${Math.max(
                  data?.daysSinceJoin ?? 0,
                  (data?.uniqueDaysCheckedIn ?? 0) + (data?.missedCount ?? 0),
                )} days`}
              />
              <WeekDeltaRow thisWeek={data?.thisWeek ?? 0} lastWeek={data?.lastWeek ?? 0} />
              <InsightRow
                label="Best streak"
                value={stat(data?.bestStreak ?? 0)}
                sub="Longest run in this group"
              />
            </div>
          </section>
        )}
      </PullToRefresh>

      {lightbox && (
        <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
      {historyOpen && (
        <HistorySheet days={data?.past90 ?? []} onClose={() => setHistoryOpen(false)} />
      )}
      {freezeOpen && (
        <StreakFreezeSheet
          groupId={data?.groupId ?? null}
          onClose={() => setFreezeOpen(false)}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ["member-profile"] });
            setFreezeOpen(false);
          }}
        />
      )}
    </div>
  );
}

function HeadStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-1">
      <div className="text-[19px] font-bold leading-tight">{value}</div>
      <div className="text-[12px] text-neutral-500 leading-tight">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2"
      style={{
        borderColor: active ? PURPLE : "transparent",
        color: active ? PURPLE : "#A3A3A3",
      }}
    >
      {children}
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  );
}

function Past7Days({ days }: { days: { date: string; checked: boolean }[] }) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const anyChecked = days.some((d) => d.checked);
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-2 h-20">
        {days.map((d, i) => {
          const dt = new Date(d.date + "T00:00:00Z");
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-full"
                style={{
                  height: d.checked ? "56px" : "6px",
                  background: d.checked ? PURPLE : "#E5E5E5",
                }}
              />
              <div className="text-[11px] text-neutral-500">{labels[dt.getUTCDay()]}</div>
            </div>
          );
        })}
      </div>
      {!anyChecked && (
        <div className="text-center text-[13px] text-neutral-400 mt-3">No check-ins this week.</div>
      )}
    </div>
  );
}

function InsightRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: PURPLE_SOFT }}
      >
        <Percent size={18} style={{ color: PURPLE }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-neutral-900 leading-tight">{label}</div>
        <div className="text-[12px] text-neutral-500 leading-tight mt-0.5">{sub}</div>
      </div>
      <div className="text-[18px] font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function WeekDeltaRow({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  const delta = thisWeek - lastWeek;
  const up = delta > 0;
  const down = delta < 0;
  const color = up ? "#16A34A" : down ? "#DC2626" : "#A3A3A3";
  const bg = up ? GREEN_SOFT : down ? RED_SOFT : "#F5F5F5";
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const sign = delta > 0 ? `+${delta}` : String(delta);
  const sub =
    lastWeek === 0 && thisWeek === 0 ? "No check-ins yet" : `${sign} vs last week (${lastWeek})`;
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        <Icon size={18} style={{ color }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-neutral-900 leading-tight">This week</div>
        <div className="text-[12px] text-neutral-500 leading-tight mt-0.5">{sub}</div>
      </div>
      <div className="text-[18px] font-bold text-neutral-900">{thisWeek}</div>
    </div>
  );
}

function BadgesGrid({ earned }: { earned: { streakDays: number; earnedAt: string }[] }) {
  const earnedMap = new Map(earned.map((e) => [e.streakDays, e.earnedAt]));
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-semibold tracking-wider text-neutral-400">BADGES</div>
        <div className="text-[12px] font-semibold text-neutral-400">
          {earned.length} / {BADGE_MILESTONES.length}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BADGE_MILESTONES.map((m) => {
          const meta = BADGE_META[m];
          const isEarned = earnedMap.has(m);
          const earnedAt = earnedMap.get(m);
          return (
            <div
              key={m}
              className="flex flex-col items-center text-center rounded-2xl py-3 px-1"
              style={{ background: isEarned ? "#FAF7F2" : "transparent" }}
            >
              <img
                src={meta.image}
                alt={`${m} day badge`}
                width={64}
                height={64}
                loading="lazy"
                className="h-16 w-16"
                style={{ filter: isEarned ? "none" : "grayscale(1)", opacity: isEarned ? 1 : 0.35 }}
              />
              <div
                className="mt-1 text-[13px] font-bold leading-tight"
                style={{ color: isEarned ? "#0B1220" : "#9CA3AF" }}
              >
                {m} {m === 1 ? "day" : "days"}
              </div>
              <div className="text-[11px] leading-tight mt-0.5" style={{ color: "#9CA3AF" }}>
                {isEarned && earnedAt
                  ? new Date(earnedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistorySheet({
  days,
  onClose,
}: {
  days: { date: string; checked: boolean }[];
  onClose: () => void;
}) {
  useHideBottomTabs();
  const checkedCount = days.filter((d) => d.checked).length;
  const groups = new Map<string, { date: string; checked: boolean }[]>();
  for (const d of days) {
    const dt = new Date(d.date + "T00:00:00Z");
    const key = dt.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl max-h-[85dvh] flex flex-col"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-neutral-200" />
        </div>
        <div className="px-6 pb-2">
          <div className="text-[20px] font-bold">Past 3 months</div>
          <div className="text-[13px] text-neutral-500 mt-1">
            {checkedCount} of {days.length} days checked in
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {[...groups.entries()].reverse().map(([month, items]) => (
            <div key={month} className="mb-6">
              <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3">
                {month.toUpperCase()}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {items.map((d) => (
                  <div
                    key={d.date}
                    className="aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold"
                    style={{
                      background: d.checked ? PURPLE : "#F0EDE8",
                      color: d.checked ? "white" : "#A3A3A3",
                    }}
                    title={d.date}
                  >
                    {new Date(d.date + "T00:00:00Z").getUTCDate()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full font-semibold text-white"
            style={{ background: PURPLE }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StreakFreezeCard({ available, onUse }: { available: number; onUse: () => void }) {
  const canUse = available > 0;
  return (
    <div className="rounded-2xl bg-white p-5 flex items-center gap-3">
      <span
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: ICE_SOFT }}
      >
        <Snowflake size={20} style={{ color: ICE }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-neutral-900 leading-tight">Streak freezes</div>
        <div className="text-[12px] text-neutral-500 mt-0.5 leading-snug">
          {canUse
            ? `${available} left. Apply one to a missed day to keep your streak alive.`
            : "You've used them all. New freezes coming soon."}
        </div>
      </div>
      <button
        type="button"
        onClick={onUse}
        disabled={!canUse}
        className="px-3 py-2 rounded-full text-[13px] font-semibold disabled:opacity-40"
        style={{ background: ICE_SOFT, color: ICE }}
      >
        Use
      </button>
    </div>
  );
}

function StreakFreezeSheet({
  groupId,
  onClose,
  onApplied,
}: {
  groupId: string | null;
  onClose: () => void;
  onApplied: () => void;
}) {
  useHideBottomTabs();
  const apply = useServerFn(applyStreakFreeze);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["streak-freeze-info", groupId],
    queryFn: () => getStreakFreezeInfo({ data: { groupId } }),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!data?.groupId) throw new Error("No group selected");
      return apply({ data: { groupId: data.groupId } });
    },
    onSuccess: async () => {
      await refetch();
      onApplied();
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const available = data?.available ?? 0;
  const eligibleDate = data?.eligibleDate ?? null;
  const reason = data?.reason ?? null;
  const eligibleLabel = eligibleDate
    ? new Date(eligibleDate + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl p-6"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="flex justify-center mb-4">
          <div className="h-1.5 w-10 rounded-full bg-neutral-200" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: ICE_SOFT }}
          >
            <Snowflake size={20} style={{ color: ICE }} />
          </span>
          <div>
            <div className="text-[18px] font-bold">Use a streak freeze</div>
            <div className="text-[13px] text-neutral-500">{available} available</div>
          </div>
        </div>
        <div className="text-[14px] text-neutral-600 mb-5">
          {isLoading
            ? "Checking your recent days…"
            : eligibleLabel
              ? `Apply a freeze to ${eligibleLabel} to keep your streak alive.`
              : (reason ?? "No missed day to cover right now.")}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-neutral-200 text-neutral-800 py-3 font-semibold text-[15px]"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!eligibleDate || available <= 0 || mutation.isPending}
            className="flex-1 rounded-full text-white py-3 font-semibold text-[15px] disabled:opacity-40"
            style={{ background: PURPLE }}
          >
            {mutation.isPending ? "Applying…" : "Use freeze"}
          </button>
        </div>
      </div>
    </div>
  );
}
