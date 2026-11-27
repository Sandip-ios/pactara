import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Ban, Flag, MoreHorizontal } from 'lucide-react';
import { Drawer as DrawerPrimitive } from 'vaul';
import * as Alert from '@radix-ui/react-alert-dialog';
import { useVersionToast } from '@/components/redesign/new-toast';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { FeedAvatar } from '@/components/feed/FeedMedia';
import { getMemberProfile } from '@/lib/member-profile.functions';
import { getSafetyState, safetyQueryKey, sendContentReport, setHiddenPost, setUserBlock } from '@/lib/safety.functions';
import { reportReasons, type SafetyReport } from '@/lib/safety-rules';
import './safety.css';

export type SafetyTarget = {
  userId: string; name: string; avatarUrl: string | null; avatarColor: string;
  groupId: string; type: 'user' | 'post' | 'comment'; targetId: string | null;
  update?: boolean; crewNames?: string[];
};

export function useSafetyState() {
  return useQuery({ queryKey: safetyQueryKey, queryFn: () => getSafetyState(), staleTime: 30_000 });
}

export function SafetyActions({ target, initialOpen = false, onClose }: { target: SafetyTarget; initialOpen?: boolean; onClose?: () => void }) {
  const toast = useVersionToast();
  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState<SafetyReport['reason']>('inappropriate_media');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingBlock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const reportFn = useServerFn(sendContentReport);
  const blockFn = useServerFn(setUserBlock);
  const hideFn = useServerFn(setHiddenPost);
  const firstName = target.name.trim().split(/\s+/)[0] || 'Member';
  const profile = useQuery({ queryKey: ['safety-shared-crews', target.userId, target.groupId], queryFn: () => getMemberProfile({ data: { userId: target.userId, groupId: target.groupId } }), enabled: confirm && !target.crewNames });
  const crewNames = target.crewNames ?? profile.data?.sharedGroups.map(g => g.name) ?? [];
  const crewLine = crewNames.length === 1 ? `You'll both stay in ${crewNames[0]}.` : "You'll both stay in your crews.";
  const title = mode === 'report' ? target.type === 'user' ? `Report ${firstName}` : `Report this ${target.type}` : target.type === 'user' ? `Options for ${firstName}` : `${firstName}'s ${target.type === 'comment' ? 'comment' : target.update ? 'update' : 'check-in'}`;
  const refresh = () => qc.invalidateQueries();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const finishMenu = () => {
    if (!pendingBlock.current && !open) onClose?.();
  };
  const chooseBlock = () => {
    pendingBlock.current = true; setOpen(false);
    timer.current = setTimeout(() => { if (pendingBlock.current) setConfirm(true); }, 350);
  };
  const changeOpen = (value: boolean) => { if (busy) return; setOpen(value); };
  const report = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await reportFn({ data: { reportedUserId: target.userId, targetType: target.type, targetId: target.targetId, groupId: target.groupId, reason, details, alsoBlock } });
      setOpen(false);
      toast.success(alsoBlock ? `Report sent. ${firstName} is blocked.` : 'Report sent. Thanks for telling us.');
      await refresh();
      onClose?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not send report'); }
    finally { setBusy(false); }
  };
  const block = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await blockFn({ data: { userId: target.userId, blocked: true } });
      setConfirm(false); toast.success(`${firstName} is blocked`);
      await refresh(); onClose?.();
      if (router.history.canGoBack()) router.history.back(); else await navigate({ to: '/home' });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not block member'); }
    finally { setBusy(false); }
  };
  const hide = async () => {
    if (!target.targetId || busy) return;
    setBusy(true);
    try {
      const postId = target.targetId;
      await hideFn({ data: { postId, hidden: true } });
      setOpen(false);
      toast.success('Post hidden', { action: { label: 'Undo', onClick: () => { void hideFn({ data: { postId, hidden: false } }).then(refresh).catch(() => toast.error('Could not restore post')); } } });
      await refresh(); onClose?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not hide post'); }
    finally { setBusy(false); }
  };
  return <>
    {!initialOpen && <Button variant="ghost" className={`safety-button ${target.type === 'user' ? 'safety-options-button' : 'safety-post-trigger'}`} aria-label={target.type === 'user' ? `More options for ${firstName}` : 'Check-in options'} aria-haspopup="dialog" onClick={() => { setMode('menu'); setOpen(true); }}><MoreHorizontal /></Button>}
    <Drawer open={open} onOpenChange={changeOpen} shouldScaleBackground={false} repositionInputs={false} onAnimationEnd={value => { if (!value) finishMenu(); }}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="safety-overlay" />
        <DrawerPrimitive.Content className={`safety-sheet ${mode === 'report' ? 'safety-report' : target.type === 'user' ? '' : 'safety-menu-sheet'}`} aria-label={title}>
          <div className="safety-handle" />
          {mode === 'report' ? <>
            <DrawerTitle className="safety-report-title">{title}</DrawerTitle>
            <DrawerDescription className="safety-report-description">What's going on? {firstName} won't know who reported {target.type === 'user' ? 'them' : 'it'}.</DrawerDescription>
            <fieldset className="safety-reasons" disabled={busy}><legend className="sr-only">Reason</legend>{reportReasons.map(([value, label]) => <label key={value} className="safety-reason"><input className="safety-check" type="radio" name={`reason-${target.targetId ?? target.userId}`} value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset>
            <textarea className="safety-details" aria-label="Add details (optional)" rows={2} placeholder="Add details (optional)" maxLength={500} value={details} onChange={e => setDetails(e.target.value)} disabled={busy} />
            <label className="safety-also-block"><input className="safety-check" type="checkbox" checked={alsoBlock} onChange={e => setAlsoBlock(e.target.checked)} disabled={busy} />Also block {firstName}</label>
            <Button variant="ghost" className="safety-button safety-send" disabled={busy} onClick={() => void report()}>Send report</Button>
          </> : target.type === 'user' ? <>
            <DrawerTitle className="sr-only">{title}</DrawerTitle><DrawerDescription className="sr-only">Report or block {firstName}</DrawerDescription>
            <Button variant="ghost" className="safety-button safety-option" onClick={() => setMode('report')}><span className="safety-option-icon"><Flag /></span><span className="safety-option-copy"><span className="safety-option-title">Report {firstName}</span><span className="safety-option-detail">Tell us about a post, comment or message. We review every report within 72 hours.</span></span></Button>
            <div className="safety-divider" />
            <Button variant="ghost" className="safety-button safety-option" onClick={chooseBlock}><span className="safety-option-icon safety-danger-icon"><Ban /></span><span className="safety-option-copy"><span className="safety-option-title safety-danger-text">Block {firstName}</span><span className="safety-option-detail">They can't see your posts, comment or message you, and you won't see theirs. They aren't told.</span></span></Button>
            <Button variant="ghost" className="safety-button safety-cancel-button" onClick={() => setOpen(false)}>Cancel</Button>
          </> : <>
            <div className="safety-menu-heading"><DrawerTitle className="safety-menu-title">{title}</DrawerTitle><DrawerDescription className={target.type === 'comment' ? 'sr-only' : 'safety-menu-description'}>{target.type === 'comment' ? `Options for ${firstName}'s comment` : 'Only you see what you choose here.'}</DrawerDescription></div>
            <div className="safety-menu-group">
              {target.type === 'post' && <><Button variant="ghost" className="safety-button safety-menu-row" disabled={busy} onClick={() => void hide()}>Hide this post</Button><div className="safety-menu-rule" /></>}
              <Button variant="ghost" className="safety-button safety-menu-row" onClick={() => setMode('report')}>{target.type === 'comment' ? 'Report comment' : 'Report this post'}</Button><div className="safety-menu-rule" />
              <Button variant="ghost" className="safety-button safety-menu-row safety-menu-block" onClick={chooseBlock}>Block {firstName}</Button>
            </div>
            <Button variant="ghost" className="safety-button safety-menu-cancel" onClick={() => setOpen(false)}>Cancel</Button>
          </>}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </Drawer>
    <Alert.Root open={confirm} onOpenChange={value => { if (!busy) { setConfirm(value); if (!value) { pendingBlock.current = false; if (timer.current) clearTimeout(timer.current); onClose?.(); } } }}><Alert.Portal><Alert.Overlay className="safety-overlay" /><Alert.Content className="safety-confirm" aria-label={`Block ${firstName}?`}>
      <div className="self-center"><FeedAvatar url={target.avatarUrl} color={target.avatarColor} name={target.name} size={56} /></div>
      <Alert.Title className="safety-confirm-title">Block {firstName}?</Alert.Title>
      <Alert.Description className="safety-confirm-body">They won't see your posts or be able to comment on them or message you, and you won't see theirs. They aren't told. {crewLine}</Alert.Description>
      <div className="safety-confirm-note">You can unblock them in Settings › Blocked people.</div>
      <Button variant="ghost" className="safety-button safety-confirm-block" disabled={busy || profile.isFetching} onClick={() => void block()}>Block</Button>
      <Alert.Cancel asChild><Button variant="ghost" className="safety-button safety-confirm-cancel" disabled={busy}>Cancel</Button></Alert.Cancel>
    </Alert.Content></Alert.Portal></Alert.Root>
  </>;
}

export function UnblockButton({ userId, name, onUnblocked }: { userId: string; name: string; onUnblocked?: () => void }) {
  const toast = useVersionToast();
  const [busy, setBusy] = useState(false);
  const unblock = useServerFn(setUserBlock);
  const qc = useQueryClient();
  return <Button variant="ghost" className="safety-button safety-unblock" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await unblock({ data: { userId, blocked: false } }); onUnblocked?.(); toast.success(`${name.trim().split(/\s+/)[0] || 'Member'} is unblocked`); await qc.invalidateQueries(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not unblock member'); }
    finally { setBusy(false); }
  }}>Unblock</Button>;
}