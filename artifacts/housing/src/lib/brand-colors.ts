// @ts-nocheck
export function hexToHslComponents(hex: string): string | null {
  if (!hex?.startsWith("#") || hex.length < 7) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandColors(
  primaryColor?: string | null,
  buttonColor?: string | null,
) {
  if (primaryColor) {
    const h = hexToHslComponents(primaryColor);
    if (h) {
      document.documentElement.style.setProperty("--sidebar", h);
      document.documentElement.style.setProperty(
        "--sidebar-border",
        h.replace(/(\d+)%$/, (_, n) => `${Math.max(0, parseInt(n) - 4)}%`),
      );
    }
  }
  if (buttonColor) {
    const h = hexToHslComponents(buttonColor);
    if (h) {
      document.documentElement.style.setProperty("--primary", h);
      document.documentElement.style.setProperty("--sidebar-primary", h);
      document.documentElement.style.setProperty("--ring", h);
    }
  }
}
