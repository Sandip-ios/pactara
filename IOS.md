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
1a. **Info.plist — camera & microphone permissions** (required for check-in video)

   Open `ios/App/App/Info.plist` and add these keys inside the top-level `<dict>`.
   Without them iOS strips `navigator.mediaDevices` and the camera screen shows
   "Camera not supported on this device."

   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Pactara uses the camera so you can record your daily check-in video.</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>Pactara uses the microphone to record audio with your check-in video.</string>
   <key>NSPhotoLibraryAddUsageDescription</key>
   <string>Pactara saves your check-in video to your photo library when you choose to.</string>
   ```

   The native check-in screen uses the system camera app (via a `capture`
   file input), which requires `NSCameraUsageDescription` and
   `NSMicrophoneUsageDescription` to be present or iOS will silently refuse
   to launch it.

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

## Subscriptions (RevenueCat)

Pactara uses RevenueCat for iOS in-app purchases. The Capacitor plugin
(`@revenuecat/purchases-capacitor`) is installed in the web project. When you
add or sync the iOS platform, it pulls in the RevenueCat iOS SDK
automatically.

### RevenueCat dashboard (one time)

1. Create an entitlement called **`premium`** (or update `REVENUECAT_ENTITLEMENT_ID`
   in `src/lib/revenuecat.ts` to match the identifier you created).
2. Create an offering called **`default`** with:
   - `$rc_monthly` → product `pactara_monthly`
   - `$rc_annual` → product `pactara_annual`
3. Copy the **Public SDK key** from RevenueCat → Project settings → API keys
   and set it as `VITE_REVENUECAT_PUBLIC_KEY` in `.env`.

### Xcode setup (one time)

1. After `npx cap add ios`, open the project in Xcode and add the **In-App
   Purchase** capability:
   **App target → Signing & Capabilities → + Capability → In-App Purchase**.
2. Configure your StoreKit products in App Store Connect (or create a local
   StoreKit Configuration file for testing in Xcode).
3. RevenueCat uses StoreKit 2 by default. Add your **In-App Purchase Key** in
   the RevenueCat dashboard so StoreKit 2 purchases can be validated.

### Testing purchases

- Real purchases can only be tested on a physical iOS device or via Xcode
  sandbox on a signed-in Apple ID.
- The web preview will show the paywall UI but cannot complete App Store
  purchases.

## Switching to bundled web assets (offline / no live URL)

Every UI change would then require a new App Store submission — not
recommended for a fast-iterating product. If you ever need it:

1. In `capacitor.config.ts` remove the `server` block and add `webDir: "dist"`.
2. `bun run build && npx cap sync ios`
