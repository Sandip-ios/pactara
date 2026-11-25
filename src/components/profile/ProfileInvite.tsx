import { useState } from 'react';
import { toast } from 'sonner';
import { ShareInviteDrawer, inviteLinkFor, CREW_INVITE_TEXT } from '@/components/groups/GroupOverflowMenu';

export function ProfileInvite({ groupId, groupName, open, onOpenChange }: { groupId: string; groupName: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLinkFor(groupId);
  return <ShareInviteDrawer open={open} onOpenChange={onOpenChange} groupName={groupName} inviteLink={link} shareText={CREW_INVITE_TEXT} copied={copied} onCopy={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => toast.error('Could not copy invite link')); }} />;
}