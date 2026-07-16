import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Clock, Percent, ChevronDown, Snowflake } from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import { Flame, CalendarDays, Target, Zap, SlidersHorizontal, LogOut, ChevronRight, Camera, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileOverview, setAvatarPath } from "@/lib/profile.functions";
import { getStreakFreezeInfo, applyStreakFreeze } from "@/lib/streak-freezes.functions";
import { listMyGroups } from "@/lib/groups.functions";
import { getMyBadges } from "@/lib/badges.functions";
import { BADGE_META, BADGE_MILESTONES } from "@/lib/badges";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { getCustomerInfo, isSubscriptionActive } from "@/lib/revenuecat";
import { isNative } from "@/lib/native";


const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";
const GREEN = "#22C55E";
const GREEN_SOFT = "#DCFCE7";
const RED_SOFT = "#FEE2E2";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveAvatarPath = useServerFn(setAvatarPath);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);

  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });
  const groups = groupsData?.groups ?? [];

  useEffect(() => {
    if (groups.length === 0) return;
    const exists = selectedGroupId && groups.some((g) => g.id === selectedGroupId);
    if (!exists) {
      setSelectedGroupId(groups[0].id as string);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", selectedGroupId);
    }
  }, [selectedGroupId]);

  const { data } = useQuery({
    queryKey: ["profile-overview", selectedGroupId],
    queryFn: () => getProfileOverview({ data: { groupId: selectedGroupId } }),
  });

  const { data: badges } = useQuery({
    queryKey: ["my-badges", selectedGroupId],
    queryFn: () => getMyBadges({ data: { groupId: selectedGroupId } }),
  });

  const activeGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null;


  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

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

  const name = data?.name || "";
  const firstName = name.split(" ")[0] || "You";
  const initial = (firstName || "U").slice(0, 1).toUpperCase();
  const goal = data?.groupName || "—";
  const avatarUrl = data?.avatarUrl ?? null;

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
      <header className="bg-white px-6 pt-5 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>
      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0];
              return k === "profile-overview" || k === "my-groups" || k === "my-group-status";
            },
          })
        }
      >


      {/* Identity card */}
      <section className="bg-white px-6 py-5 flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={openPicker}
            aria-label="Change photo"
            className="h-20 w-20 rounded-full flex items-center justify-center text-white text-[32px] font-bold overflow-hidden"
            style={{ background: data?.avatarColor || PURPLE }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
          <button
            type="button"
            onClick={openPicker}
            aria-label="Change photo"
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center shadow-sm disabled:opacity-60"
          >
            <Camera size={14} className="text-neutral-600" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-bold truncate">{firstName}</div>
          <div className="text-[14px] text-neutral-500 truncate">{goal}</div>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="px-3 py-2 rounded-full text-[13px] font-semibold disabled:opacity-60"
          style={{ background: PURPLE_SOFT, color: PURPLE }}
        >
          {uploading ? "Uploading…" : "Edit photo"}
        </button>
      </section>


      {/* Activity */}
      <section className="px-5 pt-5">
        {groups.length > 1 && (
          <div className="relative mb-3">
            <button
              type="button"
              onClick={() => setGroupPickerOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 bg-white rounded-2xl px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                {activeGroup?.emoji && (
                  <span className="text-[18px] leading-none">{activeGroup.emoji}</span>
                )}
                <span className="text-[15px] font-semibold truncate">
                  {activeGroup?.name ?? "Select group"}
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`text-neutral-400 transition-transform ${groupPickerOpen ? "rotate-180" : ""}`}
              />
            </button>
            {groupPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setGroupPickerOpen(false)}
                />
                <div className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                  {groups.map((g) => {
                    const active = g.id === selectedGroupId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(g.id as string);
                          setGroupPickerOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-neutral-50"
                        style={active ? { background: PURPLE_SOFT } : undefined}
                      >
                        {g.emoji && <span className="text-[18px] leading-none">{g.emoji}</span>}
                        <span
                          className="text-[15px] font-semibold truncate flex-1"
                          style={active ? { color: PURPLE } : undefined}
                        >
                          {g.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}


        <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3 px-1">
          ACTIVITY
        </div>


        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Flame size={18} style={{ color: PURPLE }} />} bg={PURPLE_SOFT} label="Day streak" value={stat(data?.currentStreak ?? 0)} />
          <StatCard icon={<CalendarDays size={18} style={{ color: PURPLE }} />} bg={PURPLE_SOFT} label="Total check-ins" value={stat(data?.totalCheckIns ?? 0)} />
          <StatCard icon={<Target size={18} style={{ color: "#16A34A" }} />} bg={GREEN_SOFT} label="Best streak" value={stat(data?.bestStreak ?? 0)} />
        </div>

        {/* Streak freezes */}
        <StreakFreezeCard
          available={data?.streakFreezesAvailable ?? 0}
          onUse={() => setFreezeOpen(true)}
        />


        {/* Past 7 days */}
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

          <div className="mt-5 pt-4 border-t border-neutral-100">
            <BadgesGrid earned={badges ?? []} />
          </div>
        </div>

        {/* Deeper insights */}
        <div className="mt-3 rounded-2xl bg-white p-5 space-y-4">
          <div className="text-[16px] font-bold">Insights</div>

          <InsightRow
            icon={<Percent size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            label="Check-in rate"
            value={`${data?.checkInRatePct ?? 0}%`}
            sub={`${data?.uniqueDaysCheckedIn ?? 0} of ${Math.max(data?.daysSinceJoin ?? 0, (data?.uniqueDaysCheckedIn ?? 0) + (data?.missedCount ?? 0))} days`}
          />
          <WeekDeltaRow thisWeek={data?.thisWeek ?? 0} lastWeek={data?.lastWeek ?? 0} />

        </div>
      </section>


      {/* Settings */}
      <section className="px-5 pt-6">
        <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3 px-1">
          SETTINGS
        </div>

        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<Zap size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Plan"
            subtitle="Free trial · 7 days free, then $12.99/mo"
            onClick={() => navigate({ to: "/plan" })}
          />
          <div className="h-px bg-neutral-100 ml-[68px]" />
          <Row
            icon={<SlidersHorizontal size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Account settings"
            subtitle="Name, email, password, privacy"
            onClick={() => navigate({ to: "/account-settings" })}
          />

          <div className="h-px bg-neutral-100 ml-[68px]" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-4 text-left"
          >
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: RED_SOFT }}
            >
              <LogOut size={18} className="text-red-500" />
            </span>
            <span className="flex-1 text-[16px] font-semibold text-red-500">Sign out</span>
          </button>
        </div>
      </section>

      </PullToRefresh>
      {historyOpen && (
        <HistorySheet
          days={data?.past90 ?? []}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {freezeOpen && (
        <StreakFreezeSheet
          groupId={selectedGroupId}
          onClose={() => setFreezeOpen(false)}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
            queryClient.invalidateQueries({ queryKey: ["streak-freeze-info"] });
          }}
        />
      )}
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
  // Group by month
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
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
          {[...groups.entries()].reverse().map(([month, items]) => (
            <div key={month} className="mb-6">
              <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3">
                {month.toUpperCase()}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {items.map((d) => {
                  const dt = new Date(d.date + "T00:00:00Z");
                  const day = dt.getUTCDate();
                  return (
                    <div
                      key={d.date}
                      className="aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold"
                      style={{
                        background: d.checked ? PURPLE : "#F0EDE8",
                        color: d.checked ? "white" : "#A3A3A3",
                      }}
                      title={d.date}
                    >
                      {day}
                    </div>
                  );
                })}
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

function StatCard({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 flex flex-col items-center text-center">
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center mb-2"
        style={{ background: bg }}
      >
        {icon}
      </span>
      <div className={`text-[22px] font-bold leading-tight ${value === "—" ? "text-neutral-300" : ""}`}>
        {value}
      </div>
      <div className="text-[12px] text-neutral-500 mt-1 leading-tight">{label}</div>
    </div>
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
          const dayLabel = labels[dt.getUTCDay()];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-full"
                style={{
                  height: d.checked ? "56px" : "6px",
                  background: d.checked ? PURPLE : "#E5E5E5",
                }}
              />
              <div className="text-[11px] text-neutral-500">{dayLabel}</div>
            </div>
          );
        })}
      </div>
      {!anyChecked && (
        <div className="text-center text-[13px] text-neutral-400 mt-3">
          Check in once and this fills in.
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 text-left">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold text-neutral-900">{title}</span>
        <span className="block text-[13px] text-neutral-500 truncate">{subtitle}</span>
      </span>
      <ChevronRight size={20} className="text-neutral-300 shrink-0" />
    </button>
  );
}

function InsightRow({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
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
    lastWeek === 0 && thisWeek === 0
      ? "No check-ins yet"
      : `${sign} vs last week (${lastWeek})`;
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        <Icon size={18} style={{ color }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-neutral-900 leading-tight">
          This week
        </div>
        <div className="text-[12px] text-neutral-500 leading-tight mt-0.5">{sub}</div>
      </div>
      <div className="text-[18px] font-bold text-neutral-900">{thisWeek}</div>
    </div>
  );
}

const ICE = "#38BDF8";
const ICE_SOFT = "#E0F2FE";

function StreakFreezeCard({
  available,
  onUse,
}: {
  available: number;
  onUse: () => void;
}) {
  const canUse = available > 0;
  return (
    <div className="mt-3 rounded-2xl bg-white p-5 flex items-center gap-3">
      <span
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: ICE_SOFT }}
      >
        <Snowflake size={20} style={{ color: ICE }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-neutral-900 leading-tight">
          Streak freezes
        </div>
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
      const message = err instanceof Error ? err.message : "Something went wrong";
      alert(message);
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

  const emptyMessage =
    reason === "no_missed_day"
      ? "Nothing to freeze — yesterday is already covered."
      : reason === "streak_lost"
        ? "Too late for a freeze. Your streak already broke — start a new one today."
        : reason === "too_new"
          ? "You just joined. Freezes protect a streak once you have one."
          : reason === "no_group" || reason === "not_member"
            ? "Join a group to use a streak freeze."
            : "No freeze needed right now.";

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
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2">
            <Snowflake size={20} style={{ color: ICE }} />
            <div className="text-[20px] font-bold">Use a streak freeze</div>
          </div>
          <div className="text-[13px] text-neutral-500 mt-1">
            {available} freeze{available === 1 ? "" : "s"} available. A freeze only
            protects yesterday, and only if your streak is still alive today.
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {isLoading ? (
            <div className="text-center text-[13px] text-neutral-400 py-8">Loading…</div>
          ) : eligibleDate ? (
            <div className="rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
              <span
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: ICE_SOFT }}
              >
                <Snowflake size={20} style={{ color: ICE }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-neutral-900 truncate">
                  {eligibleLabel}
                </div>
                <div className="text-[12px] text-neutral-500">
                  Missed yesterday — freeze it to keep your streak.
                </div>
              </div>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={available <= 0 || mutation.isPending}
                className="px-3 py-2 rounded-full text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ICE_SOFT, color: ICE }}
              >
                {mutation.isPending ? "Applying…" : "Freeze"}
              </button>
            </div>
          ) : (
            <div className="text-center text-[13px] text-neutral-400 py-8">
              {emptyMessage}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full font-semibold text-white"
            style={{ background: PURPLE }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgesGrid({ earned }: { earned: { streakDays: number; earnedAt: string }[] }) {
  const earnedMap = new Map(earned.map((e) => [e.streakDays, e.earnedAt]));
  const earnedCount = earned.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-semibold tracking-wider text-neutral-400">
          BADGES
        </div>
        <div className="text-[12px] font-semibold text-neutral-400">
          {earnedCount} / {BADGE_MILESTONES.length}
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
                style={{
                  filter: isEarned ? "none" : "grayscale(1)",
                  opacity: isEarned ? 1 : 0.35,
                }}
              />
              <div
                className="mt-1 text-[13px] font-bold leading-tight"
                style={{ color: isEarned ? "#0B1220" : "#9CA3AF" }}
              >
                {m} {m === 1 ? "day" : "days"}
              </div>
              <div className="text-[11px] leading-tight mt-0.5" style={{ color: "#9CA3AF" }}>
                {isEarned && earnedAt
                  ? new Date(earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



