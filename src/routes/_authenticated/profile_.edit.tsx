import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeedAvatar } from '@/components/feed/FeedMedia';
import { getMemberProfile } from '@/lib/member-profile.functions';
import { saveEditedProfile } from '@/lib/profile-edit.functions';
import { profileEditSchema } from '@/lib/profile-view';
import { useAvatarPicker } from '@/components/profile/use-avatar-picker';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import '@/components/profile/profile.css';

const profileQuery = (groupId: string | null) => queryOptions({ queryKey: ['member-profile', null, groupId], queryFn: () => getMemberProfile({ data: { groupId } }) });
export const Route = createFileRoute('/_authenticated/profile_/edit')({
  validateSearch: (input: Record<string, unknown>): { group?: string } => typeof input['group'] === 'string' ? { group: input['group'] } : {},
  loaderDeps: ({ search }) => ({ group: search.group ?? null }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(profileQuery(deps.group)),
  head: () => ({ meta: [{ title: 'Edit profile · Pactara' }, { name: 'description', content: 'Update your Pactara name, photo and crew goal.' }, { property: 'og:title', content: 'Edit profile · Pactara' }, { property: 'og:description', content: 'Update your Pactara name, photo and crew goal.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: EditProfile,
});
function EditProfile() {
  const scroll = useOpenAtTop();
  useHideBottomTabs();
  const { group } = Route.useSearch();
  const { data } = useSuspenseQuery(profileQuery(group ?? null));
  const [name, setName] = useState(data.name);
  const [goal, setGoal] = useState(data.personalGoal ?? '');
  const [busy, setBusy] = useState(false);
  const avatar = useAvatarPicker(true);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveEditedProfile);
  const back = () => navigate({ to: '/profile' });
  const valid = profileEditSchema.safeParse({ name, goal, groupId: data.crewActive ? data.groupId : null }).success;
  const changed = name.trim() !== data.name || goal.trim() !== (data.personalGoal ?? '') || avatar.changed;
  return <div ref={scroll} className="profile-page fixed inset-0 overflow-y-auto pb-12" data-scroll-root>
    <input ref={avatar.input} type="file" accept="image/*" className="hidden" onChange={avatar.onChange} />
    <header className="profile-header profile-edit-header"><Button variant="ghost" className="profile-control profile-edit-cancel" disabled={busy} onClick={() => void back()}>Cancel</Button><h1>Edit profile</h1><Button variant="ghost" className="profile-control profile-edit-save" disabled={!changed || !valid || busy || avatar.uploading} onClick={async () => {
      setBusy(true);
      try { await save({ data: { name, goal, groupId: data.crewActive ? data.groupId : null } }); await avatar.savePending(); await Promise.all(['member-profile', 'profile-overview', 'account-settings', 'member-goal', 'my-groups', 'home-crew'].map(key => qc.invalidateQueries({ queryKey: [key] }))); await back(); toast.success('Profile saved'); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save profile'); }
      finally { setBusy(false); }
    }}>Save</Button></header>
    <section className="profile-edit-photo"><FeedAvatar url={avatar.preview ?? data.avatarUrl} color={data.avatarColor} name={data.name} size={96} /><Button variant="ghost" className="profile-control profile-edit-photo-button" disabled={avatar.uploading} onClick={avatar.pick}><Camera size={16} />Change photo</Button></section>
    <section className="profile-card profile-edit-fields"><div className="profile-edit-field"><label htmlFor="profile-name">Name</label><input id="profile-name" value={name} maxLength={80} onChange={event => setName(event.target.value)} /><div className="profile-edit-hint">How you appear in your crew</div></div>
      {data.crewActive && data.groupName && <div className="profile-edit-field"><label htmlFor="profile-goal">Your goal in {data.groupName}</label><textarea id="profile-goal" rows={3} maxLength={120} value={goal} onChange={event => setGoal(event.target.value)} /><div className="profile-edit-hint flex justify-between"><span>Each crew can have its own goal</span><span>{goal.length} / 120</span></div></div>}
    </section><div className="profile-edit-footer">Email, password and notifications stay in Settings.</div>
  </div>;
}