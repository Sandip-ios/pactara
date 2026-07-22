import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pactara",
  appName: "Pactara",
  // Load the live web build so UI/content updates ship instantly without an
  // App Store resubmission. To bundle the web build inside the app instead
  // (offline-capable, but every change needs a new submission), remove the
  // `server` block and set `webDir: "dist"` after running `bun run build`.
  server: {
    url: "https://www.pactara.app",
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
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
