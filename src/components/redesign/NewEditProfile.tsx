import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAvatarPicker } from '@/components/profile/use-avatar-picker';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { checkProfileUsername, saveRedesignProfile } from '@/lib/redesign-profile.functions';
import { newProfileChanged, newProfileEditSchema, USERNAME_ERROR, usernameSchema } from '@/lib/redesign-profile';
import { NewConfirm } from './NewConfirm';
import { NewProfileAvatar } from './NewOwnProfile';
import { ownNewProfileOptions } from './profile-query';

export function NewEditProfile() {
  const { data: profile } = useSuspenseQuery(ownNewProfileOptions);
  const scroll = useOpenAtTop();
  useHideBottomTabs(true, false);
  const avatar = useAvatarPicker(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const check = useServerFn(checkProfileUsername);
  const save = useServerFn(saveRedesignProfile);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkedUsername, setCheckedUsername] = useState(profile.username ?? '');
  const [available, setAvailable] = useState(Boolean(profile.username));
  const [checkError, setCheckError] = useState<string | null>(null);
  const normalized = username.trim().toLowerCase();
  const formatValid = usernameSchema.safeParse(normalized).success;
  const changed = newProfileChanged(profile, { name, username, bio }, avatar.changed);
  const valid = newProfileEditSchema.safeParse({ name, username, bio }).success;
  const checking = formatValid && checkedUsername !== normalized;
  useEffect(() => {
    if (!formatValid) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      check({ data: normalized }).then(result => { if (alive) { setAvailable(result.available); setCheckedUsername(normalized); setCheckError(null); } }).catch(() => { if (alive) { setAvailable(false); setCheckedUsername(normalized); setCheckError('Could not check username. Try again.'); } });
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [normalized, formatValid, check]);
  const error = username && !formatValid ? USERNAME_ERROR : checking ? null : checkError ?? (formatValid && !available ? 'That username is taken' : null);
  const leave = () => void navigate({ to: '/profile' });
  const submit = async () => {
    if (!changed || !valid || checking || !available || busy || avatar.uploading) return;
    setBusy(true);
    try {
      await save({ data: { name, username, bio } });
      await avatar.savePending();
      await Promise.all(['new-own-profile', 'app-prefs', 'member-profile', 'profile-overview', 'account-settings', 'my-groups', 'my-group-status', 'home-crew', 'follow-profile'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      leave();
    } catch (e) { const message = e instanceof Error ? e.message : 'Could not save profile'; if (message === 'That username is taken') { setAvailable(false); setCheckError(message); } else toast.error(message); }
    finally { setBusy(false); }
  };
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-edit-page fixed inset-0 overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]">
    <input ref={avatar.input} type="file" accept="image/*" className="hidden" onChange={avatar.onChange} />
    <header className="new-profile-edit-header pt-new-top"><div><Button variant="ghost" className="new-profile-cancel" disabled={busy || avatar.uploading} onClick={() => changed ? setDiscard(true) : leave()}>Cancel</Button><h1>Edit profile</h1><Button variant="ghost" className="new-profile-save" disabled={!changed || !valid || checking || !available || busy || avatar.uploading} onClick={() => void submit()}>Save</Button></div></header>
    <section className="new-profile-photo-section"><NewProfileAvatar url={avatar.preview ?? profile.avatarUrl} size={96} /><Button variant="ghost" className="new-profile-photo-button" onClick={avatar.pick} disabled={busy || avatar.uploading}><Camera size={15} />Change photo</Button></section>
    <section className="new-profile-fields">
      <div><label htmlFor="new-profile-name">NAME</label><input id="new-profile-name" value={name} maxLength={50} required disabled={busy} onChange={event => setName(event.target.value)} />{name.length > 0 && !name.trim() && <p className="new-profile-field-error">Name can't be empty</p>}</div>
      <div><label htmlFor="new-profile-username">USERNAME</label><div className="new-profile-username-input"><span aria-hidden>@</span><input id="new-profile-username" value={username} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'new-profile-username-error' : undefined} onChange={event => setUsername(event.target.value.toLowerCase())} /></div>{error && <p id="new-profile-username-error" role="alert" className="new-profile-field-error">{error}</p>}</div>
      <div><label htmlFor="new-profile-bio">BIO</label><textarea id="new-profile-bio" value={bio} maxLength={150} rows={3} disabled={busy} onChange={event => setBio(event.target.value)} /><div className="new-profile-bio-hint"><span>{profile.isPrivate ? 'Your crews and followers can see this' : 'Anyone can see this on your profile'}</span><span>{bio.length} / 150</span></div></div>
    </section>
    <p className="new-profile-edit-note">Your goal in each crew is set inside that crew. Email, password and notifications are in Settings.</p>
    <NewConfirm open={discard} onOpenChange={setDiscard} title="Discard changes?" subtitle="" action="Discard" cancelLabel="Keep editing" busy={false} error={null} onConfirm={leave} />
  </div>;
}