import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signActivityThumbs } from '../media-urls';

describe('Activity media', () => {
  it('signs a deduplicated video poster rather than downloading its full video', async () => {
    const createSignedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://example.com/thumb/${path}` } }));
    const createSignedUrls = vi.fn(async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `https://example.com/thumb/${path}`, error: null })) }));
    const from = vi.fn(() => ({ createSignedUrl, createSignedUrls }));
    const client = { storage: { from } } as unknown as SupabaseClient;
    const result = await signActivityThumbs(client, ['clip.mp4', 'clip.mp4', 'photo.jpg', 'photo.jpg']);
    expect(createSignedUrls).toHaveBeenCalledExactlyOnceWith(['clip.mp4.poster.jpg'], 3600);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(result.get('clip.mp4')).toBe('https://example.com/thumb/clip.mp4.poster.jpg');
    expect(result.get('photo.jpg')).toBe('https://example.com/thumb/photo.jpg');
  });
  it('omits a legacy video whose poster could not be signed', async () => {
    const client = { storage: { from: () => ({ createSignedUrls: async () => ({ data: [{ path: 'old.mp4.poster.jpg', signedUrl: null, error: 'Not found' }] }) }) } } as unknown as SupabaseClient;
    expect((await signActivityThumbs(client, ['old.mp4'])).has('old.mp4')).toBe(false);
  });
});