import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Bell, ChevronLeft, Flame, Lock, Users } from 'lucide-react';
import { newToastApi as toast } from "./new-toast";
import { Button } from '@/components/ui/button';
import { getPrivacySettings, setProfilePrivacy } from '@/lib/follows.functions';
import { switchPublicBody } from '@/lib/redesign-profile';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { NewConfirm } from './NewConfirm';

export const privacySettingsOptions = queryOptions({ queryKey: ['privacy-settings'], queryFn: () => getPrivacySettings(), staleTime: 10_000 });

export function NewProfilePrivacy() {
  const { data } = useSuspenseQuery(privacySettingsOptions);
  const qc = useQueryClient(); const save = useServerFn(setProfilePrivacy);
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const [error, setError] = useState<string | null>(null);
  const scroll = useOpenAtTop(); useHideBottomTabs(true, false);
  const apply = async (next: boolean) => {
    if (busy) return; setBusy(true); setError(null);
    try {
      const result = await save({ data: { private: next } });
      await Promise.all(['privacy-settings', 'new-own-profile', 'app-prefs', 'follow-profile', 'social-list', 'social-request-pages', 'new-activity', 'new-activity-unread'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      setConfirm(false);
      if (result.isPrivate !== next) toast.info('Accounts under 18 stay private.');
      else toast.success(next ? 'Your account is private' : 'Your account is public');
    } catch (e) { const m = e instanceof Error ? e.message : 'Could not change privacy'; setError(m); toast.error(m); }
    finally { setBusy(false); }
  };
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-privacy-page fixed inset-0 overflow-y-auto overscroll-none pb-10">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" asChild className="new-profile-menu-button"><Link to="/profile" aria-label="Back"><ChevronLeft size={22} /></Link></Button><h1>Account privacy</h1><span className="new-profile-header-spacer" /></div></header>
    <section className="new-privacy-card">
      <span className="new-privacy-copy"><strong>Private account</strong><small>Only people you approve can follow you</small></span>
      {data.isTeen
        ? <span className="new-privacy-lock" aria-label="Private account: on"><Lock size={13} aria-hidden />On</span>
        : <Button variant="ghost" role="switch" aria-checked={data.isPrivate} aria-label="Private account" disabled={busy} className={`new-privacy-switch ${data.isPrivate ? 'on' : ''}`} onClick={() => { if (data.isPrivate) { setError(null); setConfirm(true); } else void apply(true); }}><span /></Button>}
    </section>
    <section className="new-privacy-info">
      <h2>When your account is private</h2>
      <p><Users size={18} aria-hidden />Only your followers see your profile and progress.</p>
      <p><Bell size={18} aria-hidden />New people send a follow request. You approve or decline it in Activity.</p>
      <p><Flame size={18} aria-hidden className="flame" />Your crews still see your check-ins, private or not.</p>
    </section>
    <p className="new-privacy-footer">{data.isTeen ? 'Accounts stay private until you turn 18. Then you can switch to public here.' : 'Switching back to public lets anyone see your profile again. People with pending requests follow you automatically.'}</p>
    <NewConfirm open={confirm} onOpenChange={setConfirm} tone="primary" title="Switch to public?" subtitle={switchPublicBody(data.pending)} action="Switch to public" busy={busy} error={error} onConfirm={() => void apply(false)} />
  </div>;
}
