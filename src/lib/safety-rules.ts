import { z } from 'zod';

export const reportReasons = [
  ['inappropriate_media', 'Inappropriate photo or video'],
  ['harassment', 'Harassment or bullying'],
  ['hate_or_threats', 'Hate speech or threats'],
  ['spam_or_fake', 'Spam or fake account'],
  ['other', 'Something else'],
] as const;

export const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  targetType: z.enum(['user', 'post', 'comment']),
  targetId: z.string().uuid().nullable(),
  groupId: z.string().uuid(),
  reason: z.enum(['inappropriate_media', 'harassment', 'hate_or_threats', 'spam_or_fake', 'other']),
  details: z.string().max(500),
  alsoBlock: z.boolean(),
}).refine(v => v.targetType === 'user' ? v.targetId === null : v.targetId !== null, { message: 'Invalid report target' });
export type SafetyReport = z.infer<typeof reportSchema>;

export function visibleTo<T>(rows: readonly T[], blocked: ReadonlySet<string>, author: (row: T) => string): T[] {
  return rows.filter(row => !blocked.has(author(row)));
}

export function visiblePost(userId: string, postId: string, hidden: readonly { user_id: string; post_id: string }[]): boolean {
  return !hidden.some(row => row.user_id === userId && row.post_id === postId);
}

export function canInteract(actor: string, author: string, blocked: ReadonlySet<string>): boolean {
  return actor === author || !blocked.has(author);
}

export function reportAge(createdAt: string, now = Date.now()) {
  const hours = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 3_600_000));
  return { hours, overdue: hours > 48 };
}