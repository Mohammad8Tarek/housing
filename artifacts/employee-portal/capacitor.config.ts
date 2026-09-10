import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sunrisehousing.portal",
  appName: "SUNRISE Resident Portal",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
    allowNavigation: ["*"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_launcher_foreground",
      iconColor: "#18B0BB",
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: "#0c0e14",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      spinnerColor: "#18B0BB",
      splashFullScreen: true,
      splashImmersive: true,
    },
    Biometric: {
      allowDeviceCredentials: true,
    },
    Camera: {
      permissions: ["camera", "photos"],
    },
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
