import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPostAttachmentSaved, togglePostAttachment } from '@/lib/post-attachment.functions';
import { MY_WORKOUTS_KEY } from '@/lib/exercise-library';
import { newToast } from '../new-toast';
export function PostAttachmentSave({ postId, kind }: { postId: string; kind: 'workout' | 'meal' }) {
  const qc = useQueryClient();
  const get = useServerFn(getPostAttachmentSaved);
  const toggle = useServerFn(togglePostAttachment);
  const key = ['post-attachment', kind, postId];
  const saved = useQuery({ queryKey: key, queryFn: () => get({data:{postId,kind}}), staleTime: 30_000 });
  const [busy,setBusy] = useState(false);
  const added = saved.data === true;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { const result = await toggle({data:{postId,kind,on:!added}}); qc.setQueryData(key,result.added); void qc.invalidateQueries({queryKey: kind === 'workout' ? MY_WORKOUTS_KEY : ['my-meals']}); }
    catch { newToast("Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  return <Button variant="ghost" disabled={busy || saved.isPending || saved.isError} onClick={e => { e.stopPropagation(); void run(); }} aria-pressed={added} className={`new-post-section-save ${kind} ${added ? 'added' : ''}`}>
    {added ? <Check size={16}/> : <Plus size={16}/>} {added ? 'Added' : `Add to my ${kind === 'workout' ? 'workouts' : 'meals'}`}
  </Button>;
}
