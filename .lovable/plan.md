# Wrap Pactara as an iOS app with Capacitor

Add a thin native iOS layer on top of the existing TanStack Start web app so it can be installed from the App Store. The web UI, auth, routes, and Cloud backend stay exactly as they are — Capacitor loads them inside a native WebView shell and adds native camera / share / push / haptics / splash.

## What I'll add to the repo

1. **Capacitor packages**
   - `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`
   - `@capacitor/camera`, `@capacitor/share`, `@capacitor/haptics`
   - `@capacitor/status-bar`, `@capacitor/splash-screen`
   - `@capacitor/push-notifications`

2. **`capacitor.config.ts`** at the project root
   - `appId: "app.pactara"`, `appName: "Pactara"`
   - `server.url: "https://pactara.lovable.app"` so the app always loads the live web build (UI/content updates ship instantly, no App Store resubmit)
   - Splash config matching the dark radial Pactara splash you approved
   - iOS status bar style: light content

3. **`src/lib/native.ts`** — small helper wrapping `Capacitor.isNativePlatform()` so the web code can branch cleanly.

4. **Camera swap** in `src/routes/_authenticated/check-in.camera.tsx`
   - When running natively, use `@capacitor/camera` for photo capture and video recording (better quality, real front/back switch, native permission dialog).
   - Web browsers keep the current `getUserMedia` path.

5. **Native share** on `src/routes/_authenticated/invite.tsx` and the check-in share modal — use `@capacitor/share` when native, fall back to `navigator.share` on web.

6. **Haptics** on check-in submit and reaction taps (light impact) — no-op on web.

7. **Push notifications** wiring
   - On first launch after sign-in, request permission, register with APNs, and POST the device token to the existing `push.functions.ts` endpoint (add a `platform: "ios"` field).
   - Foreground/background listeners route taps to the correct route via TanStack router.

8. **iOS-safe head + layout tweaks** in `src/routes/__root.tsx`
   - `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`
   - Add `env(safe-area-inset-*)` padding to the bottom tab bar and the top header so nothing sits under the notch / home indicator.

9. **App icon + splash image** — generate the Pactara mark at the sizes Capacitor needs and drop them where `npx cap sync` will pick them up.

10. **`IOS.md`** — the exact commands to run on a Mac and what to click in Xcode:
    ```
    bun install
    bun run build
    npx cap add ios
    npx cap sync ios
    npx cap open ios
    ```
    Plus: set signing team, enable Push Notifications capability, plug in an iPhone, press ▶.

## What stays out of scope this turn

- The Xcode / App Store Connect / Apple Developer steps (those run on your Mac, not here).
- Apple Sign In (App Review requires it if Google Sign In stays). I'll add it as a follow-up — it needs a Supabase Auth provider config too.
- Android — same Capacitor project supports it later with one command.
- App Store listing copy, screenshots, privacy policy page.

Confirm and I'll build it.
