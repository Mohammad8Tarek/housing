import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useListProperties } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";
import { usePermission } from "@/hooks/use-permission";
import {
  type PropertyInfo,
  RESERVED_FIRST_SEGMENTS,
  getPropertySlug,
  findPropertyBySlug,
  extractPropertySlugFromPath,
  resolveInitialPropertyId,
} from "@/lib/property-slug";

export type Property = PropertyInfo;

interface PropertyContextType {
  activePropertyId: number | "all" | undefined;
  activeProperty: Property | undefined;
  propertySlug: string;
  properties: Property[];
  isSuperAdmin: boolean;
  canSeeAllProperties?: boolean;
  setActivePropertyId: (id: number | "all") => void;
  buildNavHref: (baseHref: string) => string;
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

  const userPropertyIds: number[] = useMemo(() => {
    if (!user) return [];
    const explicitIds = (user as any).propertyIds as number[] | undefined;
    if (explicitIds && explicitIds.length > 0) return explicitIds;
    return user.propertyId ? [user.propertyId] : [];
  }, [user]);

  const properties: Property[] = canSeeAllProperties
    ? (allProperties as Property[])
    : (allProperties as Property[]).filter((p) =>
        userPropertyIds.includes(p.id),
      );

  const [activePropertyId, setActivePropertyIdState] = useState<
    number | "all" | undefined
  >(() => {
    if (typeof window !== "undefined") {
      const pathSlug = extractPropertySlugFromPath();
      const initialFromSlug = resolveInitialPropertyId(pathSlug);
      if (initialFromSlug !== undefined) return initialFromSlug;

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

    // Check path prefix first, then fallback to URL search param
    const pathSlug = extractPropertySlugFromPath();
    const querySlug =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("property")
        : null;
    const targetSlug = pathSlug || querySlug;

    if (targetSlug) {
      const clean = targetSlug.trim().toLowerCase();
      if (clean === "all" && canSeeAllProperties) {
        if (activePropertyId !== "all") {
          setActivePropertyIdState("all");
          localStorage.setItem("activePropertyId", "all");
        }
        return;
      }
      const matched = findPropertyBySlug(allProperties as Property[], clean);
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
      saveLastPropertyId("all");
      return;
    }
    if (!canSeeAllProperties && !userPropertyIds.includes(id)) return;
    setActivePropertyIdState(id);
    localStorage.setItem("activePropertyId", String(id));
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

  const propertySlug =
    effectiveId === "all"
      ? "all"
      : (activeProperty
          ? getPropertySlug(activeProperty)
          : (properties.length > 0 ? getPropertySlug(properties[0]) : "taal_housing"));

  // Clean any old ?property= query param from the URL to keep paths clean
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("property")) {
        url.searchParams.delete("property");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch {}
  }, [effectiveId]);

  // Listen for browser Back/Forward (popstate) to sync property from URL path
  useEffect(() => {
    const handlePopState = () => {
      const pathSlug = extractPropertySlugFromPath();
      const querySlug = new URLSearchParams(window.location.search).get("property");
      const targetSlug = pathSlug || querySlug;
      if (!targetSlug || allProperties.length === 0) return;
      const clean = targetSlug.trim().toLowerCase();
      if (clean === "all" && canSeeAllProperties) {
        setActivePropertyIdState("all");
      } else {
        const matched = findPropertyBySlug(allProperties as Property[], clean);
        if (matched && (canSeeAllProperties || userPropertyIds.includes(matched.id))) {
          setActivePropertyIdState(matched.id);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allProperties, canSeeAllProperties, userPropertyIds]);

  const buildNavHref = (baseHref: string) => {
    const slug = propertySlug || "all";
    const cleanPath = baseHref.startsWith("/") ? baseHref : `/${baseHref}`;
    return `/${slug}${cleanPath}`;
  };

  return (
    <PropertyContext.Provider
      value={{
        activePropertyId: effectiveId,
        activeProperty,
        propertySlug,
        properties,
        isSuperAdmin,
        canSeeAllProperties,
        setActivePropertyId,
        buildNavHref,
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
