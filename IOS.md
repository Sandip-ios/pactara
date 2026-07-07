# Running Pactara as an iOS app

Pactara is wrapped with [Capacitor](https://capacitorjs.com). The iOS app is a
thin native shell that loads the live web build from
`https://pactara.lovable.app`. That means any UI or content change you publish
from Lovable ships to installed iOS apps **instantly** — no App Store
resubmission required. You only resubmit when the native shell itself changes
(new plugins, icon, etc.).

## Requirements

- macOS with **Xcode 15+** (free on the Mac App Store)
- An **Apple Developer account** ($99/year) to install on a real iPhone and
  submit to the App Store
- The Pactara web app **published** (already at `pactara.lovable.app`)

## One-time setup on your Mac

```bash
# 1. Pull the project locally and install deps
bun install

# 2. Add the iOS platform (creates the /ios folder)
npx cap add ios

# 3. Sync web build + native config into the iOS project
npx cap sync ios

# 4. Open Xcode
npx cap open ios
```

## Inside Xcode

1. Select the **App** target → **Signing & Capabilities**
   - Set your **Team** (your Apple Developer account)
   - Bundle Identifier: `app.pactara` (already set — change only if you own a different one)
   - Click **+ Capability** → add **Push Notifications**
   - Click **+ Capability** → add **Background Modes** → check **Remote notifications**
2. Drop the Pactara app icon into `ios/App/App/Assets.xcassets/AppIcon.appiconset`
   (the source PNG is at `public/pactara-icon.png` — use an icon generator or
   Xcode's asset editor to produce all required sizes from that 1024×1024 image)
3. Plug in your iPhone, select it as the run destination, press ▶

## Every subsequent build

Only re-run these when the native shell config changes (plugin added, icon
changed, etc.):

```bash
npx cap sync ios
npx cap open ios
```

Web-only changes need nothing on your Mac — publish from Lovable and the app
picks them up on next launch.

## Submitting to the App Store

1. In Xcode: **Product → Archive**
2. Organizer opens → **Distribute App → App Store Connect → Upload**
3. Log into [App Store Connect](https://appstoreconnect.apple.com), create
   the app record, add screenshots, description, privacy policy URL, then
   submit for review

## Known follow-ups (not in this build)

- **Apple Sign In** — App Review requires it if Google Sign In stays. Add a
  Supabase "Apple" provider and an Apple-branded sign-in button.
- **APNs backend delivery** — the app registers for push and logs the APNs
  device token (`console.log("[push] APNs token…")`). The existing backend
  uses Web Push (VAPID); sending to iOS additionally requires an APNs sender
  (Firebase Cloud Messaging, OneSignal, or direct APNs) and storing the iOS
  token alongside the current `push_subscriptions` table.
- **Native camera** — the web `getUserMedia` camera works inside the iOS
  WebView. Swapping to `@capacitor/camera` for higher quality can happen in a
  follow-up.

## Switching to bundled web assets (offline / no live URL)

Every UI change would then require a new App Store submission — not
recommended for a fast-iterating product. If you ever need it:

1. In `capacitor.config.ts` remove the `server` block and add `webDir: "dist"`.
2. `bun run build && npx cap sync ios`
