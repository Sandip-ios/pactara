import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ChevronLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setProfilePrivacy } from '@/lib/follows.functions';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { ownNewProfileOptions } from './profile-query';

/** Working interim destination; the full privacy design lands in step 5. */
export function NewProfilePrivacy() {
  const { data: profile } = useSuspenseQuery(ownNewProfileOptions);
  const qc = useQueryClient();
  const save = useServerFn(setProfilePrivacy);
  const [busy, setBusy] = useState(false);
  const scroll = useOpenAtTop();
  useHideBottomTabs(true, false);
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto pb-10">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" asChild className="new-profile-menu-button"><Link to="/profile" aria-label="Back"><ChevronLeft size={22} /></Link></Button><h1>Account privacy</h1><span className="new-profile-header-spacer" /></div></header>
    <section className="new-profile-privacy-row"><Lock size={22} /><span><strong>Private account</strong><small>{profile.isPrivate ? 'Private' : 'Public'}</small></span><Button variant="ghost" role="switch" aria-checked={profile.isPrivate} aria-label="Private account" disabled={busy} className={`new-profile-privacy-switch ${profile.isPrivate ? 'on' : ''}`} onClick={async () => {
      setBusy(true);
      try {
        const requested = !profile.isPrivate;
        const result = await save({ data: { private: requested } });
        await Promise.all(['new-own-profile', 'app-prefs', 'follow-profile'].map(key => qc.invalidateQueries({ queryKey: [key] })));
        if (result.isPrivate !== requested) toast.info('Accounts under 18 stay private.');
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not change privacy'); }
      finally { setBusy(false); }
    }}><span /></Button></section>
  </div>;
}