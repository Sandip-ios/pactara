import { queryOptions } from '@tanstack/react-query';
import { getActivityUnreadCount, getNotifications } from '@/lib/notifications.functions';
import { getFollowNotifications } from '@/lib/follows.functions';
import { getActivityExtras, getSocialList } from '@/lib/profile-social.functions';
import { stabilizeSignedUrls } from '@/lib/stable-urls';

export const activityOptions = queryOptions({ queryKey: ['new-activity'], queryFn: async () => {
  const [crew, follows, extras] = await Promise.all([getNotifications({ data: { groupId: 'all', previewMedia: true } }), getFollowNotifications(), getActivityExtras()]);
  return stabilizeSignedUrls({ crew: crew.items, follows: follows.items, ...extras });
}, staleTime: 30_000 });

export const newActivityUnreadOptions = queryOptions({ queryKey: ['new-activity-unread'], queryFn: () => getActivityUnreadCount(), staleTime: 30_000, refetchInterval: 60_000 });

export const socialListOptions = (target: string, direction: 'followers' | 'following' | 'requests', search = '') => queryOptions({
  queryKey: ['social-list', target, direction, search],
  queryFn: () => getSocialList({ data: { target, direction, search, offset: 0 } }).then(stabilizeSignedUrls), staleTime: 30_000,
});