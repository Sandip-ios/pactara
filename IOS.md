# Running Pactara as an iOS app

Pactara is wrapped with [Capacitor](https://capacitorjs.com). The iOS app is a
thin native shell that loads the live web build from
`https://pactara.lovable.app`. UI/content changes published from Lovable ship
to installed apps instantly — App Store resubmission is only needed when the
native shell itself changes (new plugins, icon, entitlements).

## Requirements

- macOS with **Xcode 15+**
- An **Apple Developer account** ($99/year)
- A **Firebase project** (free) for iOS push delivery via FCM
- The Pactara web app **published** (already at `pactara.lovable.app`)

---

## Push notifications (FCM + APNs)

The backend sends push via **Firebase Cloud Messaging (FCM)**. FCM bridges to
APNs for iOS, so you upload one APNs Auth Key to Firebase and the backend
speaks only FCM.

### 1. Firebase project setup (one time)

1. Create/open a Firebase project at <https://console.firebase.google.com>.
2. Add an iOS app with bundle ID **`app.pactara`**. Download the generated
   `GoogleService-Info.plist` — you'll add it to Xcode below.
3. In **Project settings → Cloud Messaging → Apple app configuration**,
   upload your **APNs Authentication Key (.p8)** along with the Key ID and
   Team ID.
4. In **Project settings → Service accounts**, click **Generate new private
   key**. This downloads a JSON file (the service-account credentials). Open
   it, copy the **entire JSON contents**, and save it into Lovable as the
   secret named `FIREBASE_SERVICE_ACCOUNT_JSON` (the app requests this
   automatically — a secure form opens; paste the JSON exactly as it is in
   the file).

### 2. Xcode setup (one time)

```bash
bun install
npx cap add ios
npx cap sync ios
npx cap open ios
```

In Xcode:

1. **App target → Signing & Capabilities**
   - Set your **Team** (Apple Developer account)
   - Bundle Identifier: `app.pactara`
   - **+ Capability → Push Notifications**
   - **+ Capability → Background Modes → Remote notifications**
2. Drag **`GoogleService-Info.plist`** (from step 1) into
   `ios/App/App/`. Check "Copy items if needed" and add it to the App target.
3. Open `ios/App/App/AppDelegate.swift` and initialize Firebase plus the
   notification bridge:

   ```swift
   import UIKit
   import Capacitor
   import FirebaseCore

   @UIApplicationMain
   class AppDelegate: UIResponder, UIApplicationDelegate {
       var window: UIWindow?

       func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
           if FirebaseApp.app() == nil {
               FirebaseApp.configure()
           }
           return true
       }

       func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
           NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
       }

       func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
           NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
       }

       func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
           NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
       }
   }
   ```

   If your generated file already has the `AppDelegate` class, add only the
   `import FirebaseCore`, `FirebaseApp.configure()` block, and the three
   notification methods inside that existing class.
4. Drop the Pactara app icon into
   `ios/App/App/Assets.xcassets/AppIcon.appiconset` (source at
   `public/pactara-icon.png`).
5. Plug in your iPhone, select it as the run destination, press ▶.

After sign-in the app requests notification permission, obtains an FCM token
via `@capacitor-firebase/messaging`, and calls the `saveFcmToken` server
function to store it against the signed-in user. From that point, the
morning-ritual cron and teammate nudges deliver to the device.

### How it fits together

```
iOS device  →  FCM token  →  saveFcmToken()  →  public.fcm_tokens
                                                         │
Cron / nudge  →  sendFcm()  →  FCM HTTP v1  →  APNs  →  iPhone
```

`src/lib/fcm.server.ts` handles OAuth against the service-account JSON and
POSTs to the FCM HTTP v1 endpoint. Both `nudgeUser` (in
`src/lib/push.functions.ts`) and the hourly cron
(`src/routes/api/public/hooks/morning-ritual-reminder.ts`) send to Web Push
and FCM in parallel, so browsers and phones both get pings.

---

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
2. Organizer → **Distribute App → App Store Connect → Upload**
3. Log into [App Store Connect](https://appstoreconnect.apple.com), create
   the app record, add screenshots, description, privacy policy URL, then
   submit for review.

## Known follow-ups (not in this build)

- **Apple Sign In** — App Review requires it if Google Sign In stays. Add a
  Supabase "Apple" provider and an Apple-branded sign-in button.
- **Native camera** — the web `getUserMedia` camera works inside the iOS
  WebView. Swapping to `@capacitor/camera` for higher quality can happen in
  a follow-up.

## Switching to bundled web assets (offline / no live URL)

Every UI change would then require a new App Store submission — not
recommended for a fast-iterating product. If you ever need it:

1. In `capacitor.config.ts` remove the `server` block and add `webDir: "dist"`.
2. `bun run build && npx cap sync ios`
