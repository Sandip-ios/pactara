import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pactara",
  appName: "Pactara",
  // Bundle the web build inside the native app. This prevents the iOS shell
  // from behaving like a launcher for the public website when installed from Xcode.
  webDir: "dist",
  server: {
    allowNavigation: ["pactara.app", "www.pactara.app"],
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
