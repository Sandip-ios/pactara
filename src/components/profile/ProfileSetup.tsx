import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { profileSetup } from '@/lib/profile-view';

export function ProfileSetup({ crewName, joined, photo, goal, checkIns, onPhoto, onGoal, onCheckIn, onJoin }: { crewName: string; joined: boolean; photo: boolean; goal: boolean; checkIns: number; onPhoto: () => void; onGoal: () => void; onCheckIn: () => void; onJoin: () => void }) {
  const setup = profileSetup({ joined, photo, goal, checkIns });
  if (!setup.visible) return null;
  const titles = ['Join a crew', 'Add a photo', 'Set your goal', 'Do your first check-in'];
  const subtitles = [joined ? `You're in ${crewName}` : '', "So your crew knows it's you", 'One line your crew sees on your profile', '5 seconds of proof starts your streak'];
  const actions = [onJoin, onPhoto, onGoal, onCheckIn];
  return <section aria-label="Finish setting up" className="profile-card profile-setup">
    <div className="flex items-baseline justify-between"><div className="profile-setup-title">Finish setting up</div><div className="profile-setup-count">{setup.done} of 4</div></div>
    <progress className="profile-progress" aria-label="Setup progress" max={4} value={setup.done} />
    {titles.map((title, i) => {
      const done = setup.rows[i];
      const content = <><span className={`profile-setup-check ${done ? 'done' : ''}`}>{done && <Check size={15} />}</span><span className={`profile-setup-copy ${done ? 'done' : ''}`}><strong>{title}</strong><small>{subtitles[i]}</small></span></>;
      return done ? <div key={title} className="profile-setup-row">{content}</div> : i === 3 ? <div key={title} className="profile-setup-row">{content}<Button variant="ghost" className="profile-control profile-primary profile-setup-start" onClick={onCheckIn}>Check in</Button></div> : <Button key={title} variant="ghost" className="profile-control profile-setup-row" onClick={actions[i]}>{content}</Button>;
    })}
  </section>;
}