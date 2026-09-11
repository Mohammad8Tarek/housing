import React, { createContext, useContext, useEffect, useState } from "react";
import { useListProperties } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";
import { usePermission } from "@/hooks/use-permission";

type Property = {
  id: number;
  name: string;
  code: string;
  displayName?: string | null;
  status: string;
  primaryColor: string;
  defaultLanguage: string;
};

interface PropertyContextType {
  activePropertyId: number | "all" | undefined;
  activeProperty: Property | undefined;
  properties: Property[];
  isSuperAdmin: boolean;
  canSeeAllProperties?: boolean;
  setActivePropertyId: (id: number | "all") => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(
  undefined,
);

async function saveLastPropertyId(propertyId: number | "all"): Promise<void> {
  try {
    await fetch("/api/users/me/last-property", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: propertyId === "all" ? -1 : propertyId,
      }),
    });
  } catch {}
}

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user, isSystemAdmin: authIsSuperAdmin } = useAuth();
  const { can, canView } = usePermission();

  const isSuperAdmin =
    authIsSuperAdmin ||
    !!user?.roles?.some((r: string) =>
      ["super_admin", "system_admin"].includes(r.toLowerCase()),
    );

  const canSeeAllProperties =
    isSuperAdmin || canView("properties") || can("dashboard", "audit");

  const { data: _pData } = useListProperties({
    query: {
      queryKey: ["/api/properties"],
      enabled: Boolean(user),
      staleTime: 60 * 1000,
    },
  });
  const allProperties = _pData || [];

  const userPropertyIds: number[] = (() => {
    if (!user) return [];
    const explicitIds = (user as any).propertyIds as number[] | undefined;
    if (explicitIds && explicitIds.length > 0) return explicitIds;
    return user.propertyId ? [user.propertyId] : [];
  })();

  const properties: Property[] = canSeeAllProperties
    ? (allProperties as Property[])
    : (allProperties as Property[]).filter((p) =>
        userPropertyIds.includes(p.id),
      );

  // Helper to get URL slug for property
  const getPropertySlug = (prop?: Property | null): string => {
    if (!prop) return "";
    return prop.code || prop.name;
  };

  // Update browser URL query param without triggering full page reload
  const updateUrlPropertyParam = (slug: string | null) => {
    if (typeof window === "undefined") return;
    try {
      if (window.location.pathname === "/login") return;
      const url = new URL(window.location.href);
      const current = url.searchParams.get("property");
      if (slug) {
        if (current !== slug) {
          url.searchParams.set("property", slug);
          window.history.replaceState({}, "", url.toString());
        }
      } else {
        if (url.searchParams.has("property")) {
          url.searchParams.delete("property");
          window.history.replaceState({}, "", url.toString());
        }
      }
    } catch (err) {
      console.error("Failed to update property in URL:", err);
    }
  };

  const [activePropertyId, setActivePropertyIdState] = useState<
    number | "all" | undefined
  >(() => {
    if (typeof window !== "undefined") {
      const urlProp = new URLSearchParams(window.location.search).get("property");
      if (urlProp === "all") return "all";
      if (urlProp && !isNaN(Number(urlProp))) return Number(urlProp);
    }
    const stored = localStorage.getItem("activePropertyId");
    if (stored === "all") return "all";
    if (stored) return Number(stored);
    return undefined;
  });

  useEffect(() => {
    if (!user || allProperties.length === 0) return;

    // Check if URL specifies a property by slug, code, or name
    const urlProp = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("property")
      : null;

    if (urlProp) {
      const clean = urlProp.trim().toLowerCase();
      if (clean === "all" && canSeeAllProperties) {
        if (activePropertyId !== "all") {
          setActivePropertyIdState("all");
          localStorage.setItem("activePropertyId", "all");
        }
        return;
      }
      const matched = (allProperties as Property[]).find(
        (p) =>
          p.code?.toLowerCase() === clean ||
          p.name?.toLowerCase() === clean ||
          String(p.id) === clean,
      );
      if (matched && (canSeeAllProperties || userPropertyIds.includes(matched.id))) {
        if (activePropertyId !== matched.id) {
          setActivePropertyIdState(matched.id);
          localStorage.setItem("activePropertyId", String(matched.id));
        }
        return;
      }
    }

    if (!activePropertyId) {
      const serverId = (user as any).lastPropertyId;
      let targetId: number | "all" | undefined;

      if (canSeeAllProperties) {
        if (serverId === -1) {
          targetId = "all";
        } else {
          targetId =
            serverId && serverId > 0
              ? serverId
              : user.propertyId ||
                (allProperties.length > 0
                  ? (allProperties[0] as Property).id
                  : undefined);
        }
      } else {
        if (serverId && serverId > 0 && userPropertyIds.includes(serverId)) {
          targetId = serverId;
        } else if (
          user.propertyId &&
          userPropertyIds.includes(user.propertyId)
        ) {
          targetId = user.propertyId;
        } else {
          targetId = userPropertyIds[0];
        }
      }

      if (targetId) {
        setActivePropertyIdState(targetId);
        localStorage.setItem("activePropertyId", String(targetId));
      }
    } else {
      // Enforce restrictions if they have an activePropertyId
      if (
        !canSeeAllProperties &&
        (activePropertyId === "all" ||
          !userPropertyIds.includes(activePropertyId as number))
      ) {
        const serverId = (user as any).lastPropertyId;
        const fallback =
          serverId && serverId > 0 && userPropertyIds.includes(serverId)
            ? serverId
            : userPropertyIds[0];
        if (fallback) {
          setActivePropertyIdState(fallback);
          localStorage.setItem("activePropertyId", String(fallback));
        }
      }
    }
  }, [user, canSeeAllProperties, isSuperAdmin, activePropertyId, userPropertyIds, allProperties]);

  const setActivePropertyId = (id: number | "all") => {
    if (id === "all") {
      if (!canSeeAllProperties) return;
      setActivePropertyIdState("all");
      localStorage.setItem("activePropertyId", "all");
      updateUrlPropertyParam("all");
      saveLastPropertyId("all");
      return;
    }
    if (!canSeeAllProperties && !userPropertyIds.includes(id)) return;
    setActivePropertyIdState(id);
    localStorage.setItem("activePropertyId", String(id));
    const targetProp = (allProperties as Property[]).find((p) => p.id === id);
    if (targetProp) {
      updateUrlPropertyParam(getPropertySlug(targetProp));
    }
    saveLastPropertyId(id);
  };

  const effectiveId =
    activePropertyId === "all"
      ? "all"
      : activePropertyId ||
        user?.propertyId ||
        (properties.length > 0 ? properties[0].id : undefined);
  const activeProperty =
    effectiveId === "all"
      ? undefined
      : (allProperties as Property[]).find((p) => p.id === effectiveId);

  // Sync URL and retain property param across all page navigations
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentSlug =
      effectiveId === "all" ? "all" : getPropertySlug(activeProperty);
    if (!currentSlug) return;

    if (window.location.pathname !== "/login") {
      updateUrlPropertyParam(currentSlug);
    }

    // Intercept pushState & replaceState so Wouter and link navigations retain ?property=
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (state: any, unused: string, url?: string | URL | null) {
      let finalUrl = url;
      if (url && typeof url === "string" && !url.includes("/login")) {
        try {
          const parsed = new URL(url, window.location.origin);
          if (!parsed.searchParams.has("property")) {
            parsed.searchParams.set("property", currentSlug);
            finalUrl = parsed.pathname + parsed.search + parsed.hash;
          }
        } catch {}
      }
      return originalPushState(state, unused, finalUrl);
    };

    window.history.replaceState = function (state: any, unused: string, url?: string | URL | null) {
      let finalUrl = url;
      if (url && typeof url === "string" && !url.includes("/login")) {
        try {
          const parsed = new URL(url, window.location.origin);
          if (!parsed.searchParams.has("property")) {
            parsed.searchParams.set("property", currentSlug);
            finalUrl = parsed.pathname + parsed.search + parsed.hash;
          }
        } catch {}
      }
      return originalReplaceState(state, unused, finalUrl);
    };

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [effectiveId, activeProperty]);

  // Listen for browser Back/Forward (popstate) to sync property from URL
  useEffect(() => {
    const handlePopState = () => {
      const urlProp = new URLSearchParams(window.location.search).get("property");
      if (!urlProp || allProperties.length === 0) return;
      const clean = urlProp.trim().toLowerCase();
      if (clean === "all" && canSeeAllProperties) {
        setActivePropertyIdState("all");
      } else {
        const matched = (allProperties as Property[]).find(
          (p) =>
            p.code?.toLowerCase() === clean ||
            p.name?.toLowerCase() === clean ||
            String(p.id) === clean,
        );
        if (matched && (canSeeAllProperties || userPropertyIds.includes(matched.id))) {
          setActivePropertyIdState(matched.id);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allProperties, canSeeAllProperties, userPropertyIds]);

  return (
    <PropertyContext.Provider
      value={{
        activePropertyId: effectiveId,
        activeProperty,
        properties,
        isSuperAdmin,
        canSeeAllProperties,
        setActivePropertyId,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error("useProperty must be used within PropertyProvider");
  return ctx;
}
