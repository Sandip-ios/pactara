import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRedesignProgress } from '@/lib/redesign-profile.functions';
import { badgeTiles, freezeHint, medalColor, monthGrid, monthLabel, nextBadge, nextBadgeLine, shiftMonth } from '@/lib/progress-view';
import { BADGE_META } from '@/lib/badges';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';

export const profileProgressOptions = () => queryOptions({ queryKey: ['redesign-progress'], queryFn: () => getRedesignProgress() });

function Ring({ size, value, max, color = '#7C3AED', track = '#EFEAE4', stroke = 6, children }: { size: number; value: number; max: number; color?: string; track?: string; stroke?: number; children: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = max > 0 ? Math.min(1, value / max) : 0;
  return <div className="new-progress-ring" style={{ width: size, height: size }}>
    <svg width={size} height={size} aria-hidden><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />{pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}</svg>
    <span>{children}</span>
  </div>;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function NewProfileProgress() {
  const { data } = useSuspenseQuery(profileProgressOptions());
  const current = data.today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const scroll = useOpenAtTop();
  useHideBottomTabs(true, false);
  const cells = monthGrid(month, data.today, new Set(data.workoutDays), new Set(data.restDays));
  const tiles = badgeTiles(data.streak, data.badges);
  const earnedCount = tiles.filter(t => t.kind === 'earned').length;
  const next = nextBadge(data.streak, new Set(data.badges.map(b => b.days)));
  const hint = freezeHint(data.freezes);
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page new-progress-page fixed inset-0 overflow-y-auto pb-6">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" asChild className="new-profile-menu-button"><Link to="/profile" aria-label="Back"><ChevronLeft size={22} /></Link></Button><h1>Your progress</h1><span className="new-profile-header-spacer" /></div></header>
    <div className="new-progress-stats">
      <div><b style={{ color: '#C2410C' }}>{data.streak}</b><span>day streak</span></div>
      <div><b>{data.workouts}</b><span>workouts</span></div>
      <div><b style={{ color: '#15803D' }}>{data.prsThisMonth}</b><span>PRs this month</span></div>
    </div>
    <div className="new-progress-label new-progress-month-row"><span>{monthLabel(month, data.today)}</span><span className="new-progress-month-nav">
      <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
      <button type="button" aria-label="Next month" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
    </span></div>
    <section className="new-progress-card new-progress-month">
      <div className="new-progress-grid">{cells.map((cell, i) => cell ? <span key={cell.date} className={`is-${cell.state}`} aria-label={`${cell.date} ${cell.state}`} /> : <span key={`pad-${i}`} className="is-pad" />)}</div>
      <div className="new-progress-legend"><span><i className="is-workout" />Workout</span><span><i className="is-rest" />Rest day</span></div>
    </section>
    <div className="new-progress-label">Badges</div>
    {next !== null && <section className="new-progress-card new-progress-next">
      <Ring size={84} value={data.streak} max={next}><b className="new-progress-ring-num">{next}</b></Ring>
      <div className="new-progress-next-body">
        <div className="new-progress-next-kicker">NEXT BADGE</div>
        <div className="new-progress-next-name">{BADGE_META[next]?.title ?? `${next} days`}</div>
        <p>{nextBadgeLine(next, data.streak)}</p>
        <div className="new-progress-bar"><span style={{ width: `${Math.min(100, (data.streak / next) * 100)}%` }} /></div>
        {hint && <p className="new-progress-hint"><Snowflake size={14} color="#0369A1" aria-hidden />{hint}</p>}
      </div>
    </section>}
    <section className="new-progress-card new-progress-badges">
      <div className="new-progress-badges-head"><h2>Streak badges</h2><span>{earnedCount} of {tiles.length}</span></div>
      <div className="new-progress-badge-grid">{tiles.map(t => t.kind === 'earned'
        ? <div key={t.days} className="new-progress-tile is-earned"><span className="new-progress-medal" style={{ background: medalColor(t.days) }}>{t.days}</span><b>{t.name}</b><small>{shortDate(t.earnedAt)}</small></div>
        : t.kind === 'next'
          ? <div key={t.days} className="new-progress-tile is-next"><Ring size={56} value={t.streak} max={t.days} stroke={5}><b className="new-progress-tile-num">{t.days}</b></Ring><b>{t.name}</b><small>{t.streak} of {t.days}</small></div>
          : <div key={t.days} className="new-progress-tile is-locked"><Ring size={56} value={0} max={t.days} track="#E7E5E4" stroke={5}><b className="new-progress-tile-num">{t.days}</b></Ring><b>{t.days} days</b><small>{t.days}-day streak</small></div>)}</div>
    </section>
    <p className="new-progress-footer">People who can see your profile see your badge count.</p>
  </div>;
}
