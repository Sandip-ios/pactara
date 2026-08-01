import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pactara",
  appName: "Pactara",
  // The root web view background is black so that the brief moment before
  // the native splash screen appears, plus the splash itself, are both dark.
  // Once the React app renders it paints the body white, so slides/login/etc.
  // show on the intended light background.
  backgroundColor: "#000000",
  includePlugins: [
    "@capacitor-firebase/messaging",
    "@capacitor/app",
    "@capacitor/haptics",
    "@capacitor/share",
    "@capacitor/splash-screen",
    "@capacitor/status-bar",
    "@capacitor-community/contacts",
    "@revenuecat/purchases-capacitor",
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
    contentInset: "always",
    backgroundColor: "#000000",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FFFFFF",
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
