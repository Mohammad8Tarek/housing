import { Capacitor } from "@capacitor/core";

export async function hapticFeedback(style: "light" | "medium" | "heavy" = "light") {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");

    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: map[style] });
  } catch {
    /* haptics not available — silent fail */
  }
}

export function canHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover)").matches;
}

export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(hover: hover)").matches;
}
