import { stabilizeSignedUrls } from "@/lib/stable-urls";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Settings, Pencil, UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  Percent,
} from "lucide-react";
import { getMemberProfile } from "@/lib/member-profile.functions";
import { BADGE_META, BADGE_MILESTONES } from "@/lib/badges";
import { MediaLightbox } from "@/components/MediaLightbox";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import GroupSwitcherSheet from "@/components/GroupSwitcherSheet";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { ProfilePlans } from "@/components/plans/ProfilePlans";
import { Button } from '@/components/ui/button';
import { useAvatarPicker } from './use-avatar-picker';
import { ProfileWeek } from './ProfileWeek';
import { ProfileSetup } from './ProfileSetup';
import { ProfileNudge } from './ProfileNudge';
import { ProfileInvite } from './ProfileInvite';
import { memberSince } from '@/lib/profile-view';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import './profile.css';
import { SafetyActions, UnblockButton } from '@/components/safety/SafetyActions';

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const GREEN_SOFT = "#DCFCE7";
const RED_SOFT = "#FEE2E2";

type Tab = "posts" | "badges" | "stats";

export function ProfileView({ userId = null }: { userId?: string | null }) {
  const scroll = useOpenAtTop();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwn = userId === null;
  const avatar = useAvatarPicker();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClamped, setBioClamped] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; kind: "image" | "video" } | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("active-group-id");
  });

  const { data, isPending } = useQuery({
    queryKey: ["member-profile", userId, selectedGroupId],
    queryFn: () => getMemberProfile({ data: { userId, groupId: selectedGroupId } }).then(stabilizeSignedUrls),
  });

  useEffect(() => {
    if (isOwn && data?.groupId && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", data.groupId);
    }
  }, [isOwn, data?.groupId]);

  const groups = data?.sharedGroups ?? [];
  const activeGroup = groups.find((g) => g.id === data?.groupId) ?? null;
  const { data: partnerState } = usePartnerState();
  const displayGroups = groups.map((group) => {
    const relation = relationForGroup(group.id, partnerState);
    return { ...group, name: relation?.name ?? group.name, emoji: relation?.emoji ?? group.emoji };
  });
  const activeDisplay = displayGroups.find((g) => g.id === activeGroup?.id) ?? null;

  const name = data?.name || "";
  const firstName = name.split(" ")[0] || (isOwn ? "You" : "Member");
  const initial = (firstName || "U").slice(0, 1).toUpperCase();

  const goalLine = data?.personalGoal?.trim() || null;

  // Detect when the bio is cut off so the "See more" link only shows then.
  useEffect(() => {
    setBioExpanded(false);
  }, [goalLine]);

  useEffect(() => {
    if (!goalLine || bioExpanded) return;
    const el = bioRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      setBioClamped(el.scrollHeight > el.clientHeight + 1);
    });
    return () => window.cancelAnimationFrame(id);
  }, [goalLine, bioExpanded, data?.avatarUrl, name]);

  const openPicker = avatar.pick;
  const editProfile = () => navigate({ to: '/profile/edit', search: { group: data?.groupName ? data.groupId : undefined } });
  const checkIn = () => navigate({ to: '/check-in' });
  const crewName = activeDisplay?.name ?? data?.groupName ?? 'your crew';
  const stat = (n: number) => String(n);

  return (
    <div
      ref={scroll} className="profile-page fixed inset-0 w-full overflow-y-auto overscroll-none pb-28" data-scroll-root
    >
      <input
        ref={avatar.input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={avatar.onChange}
      />

      <header className="profile-header">
        {isOwn ? <span /> : <Button variant="ghost" className="profile-control profile-round" aria-label="Back" onClick={() => { if (router.history.canGoBack()) router.history.back(); else void navigate({ to: '/home' }); }}><ChevronLeft size={22} /></Button>}
        <h1>{isOwn ? 'Profile' : firstName}</h1>
        {isOwn ? <Button variant="ghost" className="profile-control profile-round" aria-label="Settings" onClick={() => void navigate({ to: '/account-settings' })}><Settings size={20} /></Button> : data ? <SafetyActions target={{ userId: data.userId, name, avatarUrl: data.avatarUrl, avatarColor: data.avatarColor, groupId: data.groupId, type: 'user', targetId: null, crewNames: displayGroups.map(g => g.name) }} /> : <span />}
      </header>
      <GroupSwitcherSheet open={groupPickerOpen} onClose={() => setGroupPickerOpen(false)} groups={displayGroups} selectedGroupId={data?.groupId ?? null} onSelect={setSelectedGroupId} />
      {data?.groupName && <ProfileInvite groupId={data.groupId} groupName={crewName} open={inviteOpen} onOpenChange={setInviteOpen} />}

      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "member-profile",
          })
        }
      >
        <section className="profile-identity">
          <div className="profile-avatar-row">
            <div className="relative shrink-0">
              {isOwn && !data?.avatarUrl && !isPending ? <Button variant="ghost" className="profile-control profile-add-photo" aria-label="Add a photo" disabled={avatar.uploading} onClick={openPicker}><Camera size={22} />Add photo</Button> : <Button variant="ghost" className="profile-control profile-avatar" aria-label={data?.avatarUrl ? 'View photo' : firstName} onClick={() => { if (data?.avatarUrl) setLightbox({ src: data.avatarUrl, kind: 'image' }); }} style={{ background: data?.avatarColor || PURPLE }}>
                {isPending ? null : data?.avatarUrl ? <img src={data.avatarUrl} alt={firstName} /> : initial}
              </Button>}
              {isOwn && data?.avatarUrl && <Button variant="ghost" className="profile-control profile-camera" aria-label="Change photo" disabled={avatar.uploading} onClick={openPicker}><Camera size={14} /></Button>}
            </div>
            <div className="profile-stats"><HeadStat value={stat(data?.totalCheckIns ?? 0)} label="check-ins" /><HeadStat value={stat(data?.currentStreak ?? 0)} label="streak" /><HeadStat value={isOwn && data?.totalCheckIns === 0 ? String(data.weeklyTarget ?? 0) : weeksOnGoalValue(data?.weeksOnGoal)} label={isOwn && data?.totalCheckIns === 0 ? 'weekly goal' : 'weeks on goal'} /></div>
          </div>
          <div className="flex flex-col gap-[3px]">
            <div className="profile-name">{name || firstName}</div>
            {goalLine && <><div ref={bioRef} className={`profile-goal ${bioExpanded ? '' : 'line-clamp-2'}`}>{goalLine}</div>{(bioClamped || bioExpanded) && <Button variant="ghost" className="profile-control h-auto justify-start self-start p-0 text-[13px] font-semibold text-pactara-purple" onClick={() => setBioExpanded(v => !v)}>{bioExpanded ? 'See less' : 'See more'}</Button>}</>}
            <div className="profile-since">{memberSince(data?.createdAt)}</div>
          </div>
          {isOwn ? <div className="profile-actions"><Button variant="ghost" className="profile-control profile-action" onClick={() => void editProfile()}><Pencil size={18} />Edit profile</Button>{data?.groupName && <Button variant="ghost" className="profile-control profile-action" onClick={() => setInviteOpen(true)}><UserPlus size={18} />Invite to crew</Button>}</div> : data?.blockedByMe ? <div className="flex items-center justify-between gap-3 text-[14px] font-semibold"><span>You blocked {firstName}</span><UnblockButton userId={data.userId} name={name} /></div> : data && <div className="profile-actions"><Button variant="ghost" className="profile-control profile-action profile-primary" onClick={() => void navigate({ to: '/chat/$groupId', params: { groupId: data.groupId } })}><MessageCircle size={18} />Message</Button><ProfileNudge key={`${data.groupId}-${data.userId}-${data.today}`} groupId={data.groupId} userId={data.userId} firstName={firstName} initial={data.nudgeState} /></div>}
        </section>
        {isOwn && data && <ProfileSetup crewName={crewName} joined={!!data.groupName} photo={!!data.avatarUrl} goal={!!goalLine} checkIns={data.totalCheckIns} onPhoto={openPicker} onGoal={() => void editProfile()} onCheckIn={() => void checkIn()} onJoin={() => void navigate({ to: '/home', search: { crews: '1' } })} />}
        {data?.groupName && <ProfileWeek isOwn={isOwn} groupId={data.groupId} crewName={crewName} switchable={groups.length > 1} onSwitch={() => setGroupPickerOpen(true)} today={data.today} days={data.weekDays} workouts={data.thisWeek} target={data.weeklyTarget ?? 0} streak={data.currentStreak} best={data.bestStreak} freezes={data.streakFreezesAvailable} />}
        {isOwn && <ProfilePlans />}
        <div role="tablist" className="profile-tabs">
          <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} label="Posts"><Grid3x3 size={18} /></TabButton>
          <TabButton active={tab === 'badges'} onClick={() => setTab('badges')} label="Badges"><Award size={18} /></TabButton>
          <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} label="Stats"><BarChart3 size={18} /></TabButton>
        </div>

        {tab === "posts" && (
          <section className="bg-white">
            {(data?.media ?? []).length === 0 ? (
              isOwn ? <div className="profile-empty"><strong>Your check-ins show up here</strong><p>Every 5-second proof you post builds this grid.</p></div> : <div className="py-16 text-center text-[14px] text-neutral-400">No check-ins yet</div>
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
                      <span className="profile-video-icon">
                        <Play size={16} />
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
                label="Weekly goal hit"
                value={weeksOnGoalValue(data?.weeksOnGoal)}
                sub={
                  (data?.weeksOnGoal?.completed ?? 0) === 0
                    ? "No full week finished yet"
                    : `Weeks with ${data?.weeklyTarget ?? 0}+ check-ins`
                }
              />
              <WeekDeltaRow thisWeek={data?.thisWeek ?? 0} lastWeek={data?.lastWeek ?? 0} />
              <InsightRow
                label="Best streak"
                value={stat(data?.bestStreak ?? 0)}
                sub="Longest run in this crew"
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
    </div>
  );
}

function weeksOnGoalValue(w: { hit: number; completed: number } | undefined) {
  return `${w?.hit ?? 0}/${w?.completed ?? 0}`;
}

function HeadStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="profile-head-stat"><strong>{value}</strong><span>{label}</span></div>
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
  return <Button variant="ghost" role="tab" aria-selected={active} onClick={onClick} aria-label={label} className="profile-control profile-tab">{children}<span>{label}</span></Button>;
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
    groups.get(key)?.push(d);
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
