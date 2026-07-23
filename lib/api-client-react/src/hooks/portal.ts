import { useQuery } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

export const usePortalProfile = () => useQuery({
  queryKey: ["portal", "profile"],
  queryFn: () => customFetch("/api/portal-data/profile")
});

export const usePortalRoom = () => useQuery({
  queryKey: ["portal", "room"],
  queryFn: () => customFetch("/api/portal-data/room")
});

export const usePortalNotifications = () => useQuery({
  queryKey: ["portal", "notifications"],
  queryFn: () => customFetch("/api/portal-data/notifications")
});

export const usePortalAlerts = () => useQuery({
  queryKey: ["portal", "alerts"],
  queryFn: () => customFetch("/api/portal-data/alerts")
});
