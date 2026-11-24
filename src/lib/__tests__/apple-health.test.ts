import { beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  platform: 'ios', installed: true,
  available: vi.fn(), authorize: vi.fn(), status: vi.fn(), query: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: {
  isNativePlatform: () => stub.platform !== 'web', getPlatform: () => stub.platform,
  isPluginAvailable: () => stub.installed,
} }));
vi.mock('@capgo/capacitor-health', () => ({ Health: {
  isAvailable: stub.available, requestAuthorization: stub.authorize,
  checkAuthorization: stub.status, queryWorkouts: stub.query,
} }));
import { appleHealthAvailable, connectAppleHealth, readAppleHealthToday } from '@/lib/apple-health';

beforeEach(() => {
  vi.resetAllMocks(); stub.platform = 'ios'; stub.installed = true;
  stub.available.mockResolvedValue({ available: true });
  stub.authorize.mockResolvedValue({ readAuthorized: ['workouts'], readDenied: [] });
  stub.status.mockResolvedValue({ readAuthorized: ['workouts'], readDenied: [] });
  stub.query.mockResolvedValue({ workouts: [] });
});
describe('iOS-only Health adapter', () => {
  it('never calls the plugin on web', async () => {
    stub.platform = 'web'; expect(await appleHealthAvailable()).toBe(false);
    expect(await connectAppleHealth()).toBe(false); expect(await readAppleHealthToday()).toEqual({ ok: false, workouts: [] });
    expect(stub.available).not.toHaveBeenCalled(); expect(stub.authorize).not.toHaveBeenCalled(); expect(stub.query).not.toHaveBeenCalled();
  });
  it('never calls the plugin on Android', async () => {
    stub.platform = 'android'; expect(await appleHealthAvailable()).toBe(false); expect(stub.available).not.toHaveBeenCalled();
  });
  it('hides Health when an older native build has no plugin', async () => {
    stub.installed = false; expect(await appleHealthAvailable()).toBe(false); expect(stub.available).not.toHaveBeenCalled();
  });
  it('requests read access for workouts only and no write access', async () => {
    expect(await connectAppleHealth()).toBe(true); expect(stub.authorize).toHaveBeenCalledWith({ read: ['workouts'], write: [] });
  });
  it('does not connect on a reported denial', async () => {
    stub.authorize.mockResolvedValue({ readAuthorized: [], readDenied: ['workouts'] }); expect(await connectAppleHealth()).toBe(false);
  });
  it('does not query workouts on a reported denial', async () => {
    stub.status.mockResolvedValue({ readAuthorized: [], readDenied: ['workouts'] });
    expect(await readAppleHealthToday()).toEqual({ ok: false, workouts: [] }); expect(stub.query).not.toHaveBeenCalled();
  });
  it('fails safely if the plugin is unavailable or throws', async () => {
    stub.available.mockRejectedValue(new Error('missing native method')); expect(await appleHealthAvailable()).toBe(false);
    stub.query.mockRejectedValue(new Error('Health unavailable')); expect(await readAppleHealthToday()).toEqual({ ok: false, workouts: [] });
  });
  it('reads local midnight through now without extra sample permissions', async () => {
    expect(await readAppleHealthToday()).toEqual({ ok: true, workouts: [] });
    expect(stub.status).toHaveBeenCalledWith({ read: ['workouts'], write: [] });
    const options = stub.query.mock.calls[0]?.[0] as { startDate: string; endDate: string; limit: number } | undefined;
    expect(options?.limit).toBe(100); expect(new Date(options?.startDate ?? '').getHours()).toBe(0);
    expect(Date.parse(options?.endDate ?? '')).toBeLessThanOrEqual(Date.now());
  });
});