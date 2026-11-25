import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { nudgeMember } from '@/lib/group-today.functions';
import { profileNudge } from '@/lib/profile-view';

export function ProfileNudge({ groupId, userId, firstName, initial }: { groupId: string; userId: string; firstName: string; initial: ReturnType<typeof profileNudge> }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const send = useServerFn(nudgeMember);
  const qc = useQueryClient();
  const current = initial === 'hidden' || initial === 'covered' || initial === 'nudged' ? initial : state;
  if (current === 'hidden') return null;
  return <Button variant="ghost" className="profile-control profile-action" disabled={busy || current !== 'allowed'} aria-label={current === 'covered' ? `${firstName} is covered today` : current === 'nudged' ? `You nudged ${firstName} today` : `Nudge ${firstName}`} onClick={async () => {
    setBusy(true);
    try {
      const result = await send({ data: { groupId, userId } });
      if (result.ok) { setState('nudged'); toast.success(result.message); }
      else { if (result.reason === 'covered') setState('covered'); else if (result.reason === 'already_nudged') setState('nudged'); else if (result.reason === 'not_allowed') setState('hidden'); toast.info(result.message); }
      await qc.invalidateQueries({ queryKey: ['member-profile'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't send that nudge"); }
    finally { setBusy(false); }
  }}>{current === 'allowed' ? <Bell size={18} /> : <Check size={18} />}{current === 'allowed' ? 'Nudge' : current === 'covered' ? 'Covered' : 'Nudged'}</Button>;
}