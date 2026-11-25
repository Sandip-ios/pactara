import { CalendarDays, ChevronDown, ChevronRight, Dumbbell, Snowflake, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { freezeHint, profileBadges, type ProfileStats } from '@/lib/profile-tabs';
import './profile-tabs.css';

export function ProfileBadges({ earned, streak, own, firstName, freezes }: { earned: { streakDays: number; earnedAt: string }[]; streak: number; own: boolean; firstName: string; freezes: number }) {
  const view = profileBadges(earned, streak, own, firstName);
  return <>
    {view.next && <section className="profile-card profile-next-badge">
      <div className="profile-next-row"><img className="profile-badge-art locked" src={view.next.image} alt={view.next.title} width={84} height={84} /><div className="profile-next-copy"><div className="profile-next-label">{view.next.label}</div><div className="profile-next-title">{view.next.title}</div><div className="profile-next-text">{view.next.text}</div></div></div>
      <progress className="profile-progress profile-badge-progress" aria-label={view.next.ariaLabel} value={view.next.progress} max={view.next.milestone} />
      {own && freezes > 0 && <div className="profile-badge-freeze"><Snowflake size={15} />{freezeHint(freezes)}</div>}
    </section>}
    <section className="profile-card profile-tab-card"><div className="profile-tab-heading"><h2>Streak badges</h2><span className="profile-earned-count">{view.earned} of 9</span></div><div className="profile-badge-grid">
      {view.cells.map(cell => <div key={cell.milestone} className={`profile-badge-cell ${cell.state}`}><img className={`profile-badge-art ${cell.state === 'earned' ? '' : 'locked'}`} src={cell.image} alt={cell.title} width={60} height={60} loading="lazy" /><span className="profile-badge-title">{cell.title}</span><span className="profile-badge-caption">{cell.caption}</span></div>)}
    </div></section>
  </>;
}
export function ProfileStatsTab({ stats, own, firstName, crewName, freezes, switchable, onSwitch, onLifts }: { stats: ProfileStats; own: boolean; firstName: string; crewName: string; freezes: number; switchable: boolean; onSwitch: () => void; onLifts: () => void }) {
  return <>
    <div className="profile-stats-crew"><span>Counting check-ins in</span>{switchable ? <Button variant="ghost" className="profile-control profile-crew-chip" onClick={onSwitch}><span className="truncate">{crewName}</span><ChevronDown size={14} /></Button> : <span className="profile-crew-chip profile-static-crew">{crewName}</span>}</div>
    <section className="profile-card profile-tab-card"><h2>{own ? 'Since you joined' : `Since ${firstName} joined ${crewName}`}</h2><div className="profile-stat-tiles">
      <StatTile value={String(stats.totalCheckIns)} label="check-ins" /><StatTile value={`${stats.best.count} days`} label="best streak" tone="fire" /><StatTile value={`${stats.goal.hit} of ${stats.goal.completed}`} label="weeks on goal" />{own ? <StatTile value={String(freezes)} label="freezes left" tone="ice" /> : <StatTile value={`${stats.thisWeek} of ${stats.target}`} label="this week" />}
    </div></section>
    <section className="profile-card profile-tab-card"><div className="profile-tab-heading"><h2>{stats.title}</h2><span>{stats.checked} of {stats.days} days</span></div>
      <div className="profile-showing-grid"><div className="profile-grid-labels">{['M', '', 'W', '', 'F', '', 'S'].map((label, i) => <span key={i}>{label}</span>)}</div>{stats.columns.map(column => <div className="profile-grid-week" key={column.monday}>{column.days.map(day => <span key={day.date} className={`profile-grid-cell ${day.state}`} title={`${day.date}: ${day.state}`} aria-label={`${day.date}: ${day.state}`} />)}</div>)}</div>
      <div className="profile-grid-months">{stats.months.map(month => <span key={month.index}>{month.label}</span>)}</div>
      <div className="profile-grid-legend"><span><i className="checked" />Checked in</span><span><i className="rest" />Rest day</span><span><i className="missed" />Missed</span></div>
    </section>
    <section className="profile-card profile-tab-card"><div className="profile-tab-heading"><h2>Workouts per week</h2><span>Goal: {stats.target}</span></div><div className="profile-week-bars">
      <div aria-hidden="true" className="profile-goal-line" style={{ bottom: `${18 + stats.target / 7 * 100}px` }} />
      {stats.bars.map(bar => <div key={bar.monday} className={`profile-week-bar ${bar.current ? 'current' : ''}`}><span className="profile-bar-count">{bar.count}</span><div className="profile-bar-fill" style={{ height: `${bar.height}px` }} /><span className="profile-bar-label">{bar.label}</span></div>)}
    </div></section>
    <section className="profile-card profile-insights"><h2>Insights</h2>
      <StatsInsight icon={<TrendingUp size={20} />} tone="green" label="This week" text={`${stats.thisWeek} so far, ${stats.lastWeek} all of last week`} value={String(stats.thisWeek)} />
      <StatsInsight icon={<CalendarDays size={20} />} tone="purple" label="Weekly goal" text={stats.goalText} value={`${stats.goal.hit}/${stats.goal.completed}`} />
      <StatsInsight icon={<Trophy size={20} />} tone="fire" label="Best streak" text={stats.best.text} value={String(stats.best.count)} />
    </section>
    {own ? <Button variant="ghost" className="profile-control profile-lifts" onClick={onLifts}><span className="profile-plan-icon"><Dumbbell size={20} /></span><span className="profile-lifts-copy"><strong>Your lifts and personal bests</strong><small>Weight lifted per week, PRs</small></span><ChevronRight size={20} className="profile-plan-chevron" /></Button> : <p className="profile-stats-privacy">Freezes stay private. Crewmates see check-ins, streaks and badges.</p>}
  </>;
}
function StatTile({ value, label, tone = 'soft' }: { value: string; label: string; tone?: string }) {
  return <div className={`profile-stat-tile ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
function StatsInsight({ icon, tone, label, text, value }: { icon: React.ReactNode; tone: string; label: string; text: string; value: string }) {
  return <div className="profile-stats-insight"><span className={`profile-insight-icon ${tone}`}>{icon}</span><span className="profile-insight-copy"><strong>{label}</strong><small>{text}</small></span><b>{value}</b></div>;
}
