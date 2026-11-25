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
} from "lucide-react";
import { getMemberProfile } from "@/lib/member-profile.functions";
import { ProfileBadges, ProfileStatsTab } from "./ProfileTabs";
import { MediaLightbox } from "@/components/MediaLightbox";
import { PullToRefresh } from "@/components/PullToRefresh";
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
  const openLifts = async () => {
    // Reach the existing Workouts lifts area without changing that screen.
    const scrollToLifts = () => {
      if (router.state.location.pathname !== '/workouts') return false;
      const heading = Array.from(document.querySelectorAll('h2')).find(el => el.textContent === 'Your lifts');
      if (!heading) return false;
      heading.scrollIntoView({ block: 'start' });
      return true;
    };
    const observer = new MutationObserver(() => {
      if (scrollToLifts()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
    try {
      await navigate({ to: '/workouts' });
      window.requestAnimationFrame(() => { if (scrollToLifts()) observer.disconnect(); });
    } catch { observer.disconnect(); }
  };
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

        {(tab === "badges" || tab === "stats") && data?.blocked && <div className="py-16 text-center text-[14px] text-neutral-400">No check-ins yet</div>}
        {tab === "badges" && data && !data.blocked && <ProfileBadges earned={data.badges} streak={data.currentStreak} own={isOwn} firstName={firstName} freezes={data.streakFreezesAvailable} />}
        {tab === "stats" && data?.stats && !data.blocked && <ProfileStatsTab stats={data.stats} own={isOwn} firstName={firstName} crewName={crewName} freezes={data.streakFreezesAvailable} switchable={groups.length > 1} onSwitch={() => setGroupPickerOpen(true)} onLifts={() => void openLifts()} />}
      </PullToRefresh>

      {lightbox && (
        <MediaLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
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
