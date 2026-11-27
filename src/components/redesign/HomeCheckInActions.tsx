import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {Button} from '@/components/ui/button';
import {getHomeCheckInSocial,homeCheckInAction} from '@/lib/home-checkin.functions';
import {firstVisibleComment} from '@/lib/first-comment';
import {FeedCardActions} from './FeedCardActions';
import {NewSheet} from './NewSheet';
import {newToast} from './new-toast';
export function HomeCheckInActions({id,isMine}:{id:string;isMine:boolean}){
 const qc=useQueryClient();const get=useServerFn(getHomeCheckInSocial);const action=useServerFn(homeCheckInAction);const key=['home-checkin-social',id];
 const data=useQuery({queryKey:key,queryFn:()=>get({data:{id}}),staleTime:30_000});const [open,setOpen]=useState(false);const [body,setBody]=useState('');const [busy,setBusy]=useState(false);
 const run=async(type:'cheer'|'comment'|'save'|'unsave')=>{if(busy)return;setBusy(true);try{await action({data:{id,action:type,...(type==='comment'?{body}:{})}});if(type==='comment')setBody('');await qc.invalidateQueries({queryKey:key});void qc.invalidateQueries({queryKey:['saved-posts']});void qc.invalidateQueries({queryKey:['group-feed']});}catch{newToast("Couldn't update. Try again.");}finally{setBusy(false);}};
 const comments=data.data?.comments??[];
 return <><FeedCardActions cheer={isMine?undefined:()=>void run('cheer')} cheered={data.data?.cheered??false} cheers={data.data?.cheers??0} comments={comments.length} openComments={()=>setOpen(true)} preview={firstVisibleComment(comments)} save={{saved:data.data?.saved??false,toggle:()=>void run(data.data?.saved?'unsave':'save')}}/>
 <NewSheet open={open} onOpenChange={setOpen} title="Comments"><div className="text-[var(--new-ink)]"><ul className="max-h-[40vh] overflow-y-auto">{comments.map(c=><li key={c.id} className="py-2 text-[15px]"><strong>{c.name}</strong> {c.body}</li>)}</ul>{!comments.length&&<p className="py-2 text-[14px] text-[var(--new-muted)]">No comments yet.</p>}<form className="mt-3 flex items-center gap-2" onSubmit={e=>{e.preventDefault();void run('comment');}}><input aria-label="Add a comment" placeholder="Add a comment" value={body} onChange={e=>setBody(e.target.value)} maxLength={1000} className="h-11 min-w-0 flex-1 rounded-full bg-[var(--new-control)] px-4 text-[16px] outline-none"/><Button variant="ghost" type="submit" disabled={!body.trim()||busy} className="h-11 text-[15px] font-bold text-[var(--new-purple)]">Post</Button></form></div></NewSheet></>;
}
