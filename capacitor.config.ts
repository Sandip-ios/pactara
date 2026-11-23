import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pactara",
  appName: "Pactara",
  // White everywhere (webview, safe areas, native splash) so launch never
  // flashes black.
  backgroundColor: "#FFFFFF",
  includePlugins: [
    "@capacitor-firebase/messaging",
    "@capacitor/app",
    "@capacitor/haptics",
    "@capacitor/share",
    "@capacitor/splash-screen",
    "@capacitor/status-bar",
    "@capacitor-community/contacts",
    "@revenuecat/purchases-capacitor",
    "@capacitor-community/in-app-review",
  ],
  // This app is a TanStack Start (SSR + server functions) app, so `vite build`
  // intentionally produces a server bundle (dist/server) plus client assets
  // (dist/client) and NO static index.html. There is no static export.
  //
  // `webDir` therefore points at a tiny committed shell that only exists to
  // satisfy Capacitor's "web assets directory must contain an index.html"
  // requirement; the real app is loaded from `server.url`.
  webDir: "native-shell",
  server: {
    url: "https://pactara.lovable.app",
    allowNavigation: ["pactara.lovable.app"],
    cleartext: false,
  },
  ios: {
    // "never" lets the webview span the full screen (status bar + home
    // indicator included) so full-screen overlays/sheets really are edge to
    // edge. Safe areas are handled in CSS via env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#FFFFFF",
  },
  plugins: {
    SplashScreen: {
      // The web launch screen (src/components/SplashScreen.tsx) looks
      // identical and hides this one as soon as it is painted — no fixed timer.
      launchAutoHide: false,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
      launchFadeOutDuration: 0,
    },
    StatusBar: {
      // LIGHT = black icons/text on the white background.
      style: "LIGHT",
      backgroundColor: "#FFFFFF",
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
