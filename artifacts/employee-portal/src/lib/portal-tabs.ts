export type PortalTab =
  | "overview"
  | "requests"
  | "documents"
  | "activities"
  | "evaluations"
  | "notifications"
  | "portal-settings"
  | "profile"
  | "roommates"
  | "food"
  | "transport"
  | "chat";

const supportedTabs: PortalTab[] = [
  "overview",
  "documents",
  "requests",
  "activities",
  "evaluations",
  "notifications",
  "profile",
  "portal-settings",
  "roommates",
  "food",
  "transport",
  "chat",
];

export function normalizePortalTab(
  value: string | null | undefined,
): PortalTab {
  if (value === "more") return "portal-settings";
  if (value && supportedTabs.includes(value as PortalTab))
    return value as PortalTab;
  return "overview";
}

export function getPortalTabFromUrl(
  search = window.location.search,
): PortalTab {
  const params = new URLSearchParams(search);
  return normalizePortalTab(params.get("tab"));
}
