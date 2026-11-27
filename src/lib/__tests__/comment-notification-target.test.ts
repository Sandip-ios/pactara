import { describe, expect, it } from 'vitest';
import { commentNotificationTarget } from '../notifications.functions';

const input = {
  checkInId: 'later', firstCheckInId: 'first',
  scopedPhoto: new Map([['later', 'member/later.mp4']]),
  postPhoto: 'member/first.jpg', commentMedia: 'reply/photo.jpg',
};

describe('comment Activity thumbnail and destination', () => {
  it('uses the later check-in video instead of the comment attachment', () => {
    expect(commentNotificationTarget({ ...input, perCheckIn: true }))
      .toEqual({ checkInId: 'later', mediaPath: 'member/later.mp4' });
  });
  it('uses the first check-in when the comment has no check-in reference', () => {
    expect(commentNotificationTarget({ ...input, perCheckIn: true, checkInId: null }))
      .toEqual({ checkInId: 'first', mediaPath: 'member/first.jpg' });
  });
  it('preserves classic comment attachments and day-level navigation', () => {
    expect(commentNotificationTarget({ ...input, perCheckIn: false }))
      .toEqual({ checkInId: null, mediaPath: 'reply/photo.jpg' });
  });
});