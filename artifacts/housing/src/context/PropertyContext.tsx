import React, { createContext, useContext, useEffect, useState } from "react";
import { useListProperties } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";

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

  const isSuperAdmin =
    authIsSuperAdmin ||
    !!user?.roles?.some((r: string) =>
      ["super_admin", "system_admin"].includes(r.toLowerCase()),
    );

  const { data: allProperties = [] } = useListProperties({
    query: { enabled: !!user } as any,
  });

  const userPropertyIds: number[] = (() => {
    if (!user) return [];
    const explicitIds = (user as any).propertyIds as number[] | undefined;
    if (explicitIds && explicitIds.length > 0) return explicitIds;
    return user.propertyId ? [user.propertyId] : [];
  })();

  const properties: Property[] = isSuperAdmin
    ? (allProperties as Property[])
    : (allProperties as Property[]).filter((p) =>
        userPropertyIds.includes(p.id),
      );

  const [activePropertyId, setActivePropertyIdState] = useState<
    number | "all" | undefined
  >(() => {
    const stored = localStorage.getItem("activePropertyId");
    if (stored === "all") return "all";
    if (stored) return Number(stored);
    return undefined;
  });

  useEffect(() => {
    if (!user) return;

    if (!activePropertyId) {
      const serverId = (user as any).lastPropertyId;
      let targetId: number | "all" | undefined;

      if (isSuperAdmin) {
        if (serverId === -1) {
          targetId = "all";
        } else {
          targetId = serverId && serverId > 0 ? serverId : (user.propertyId || (allProperties.length > 0 ? (allProperties[0] as Property).id : undefined));
        }
      } else {
        if (serverId && serverId > 0 && userPropertyIds.includes(serverId)) {
          targetId = serverId;
        } else if (user.propertyId && userPropertyIds.includes(user.propertyId)) {
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
      if (!isSuperAdmin && (activePropertyId === "all" || !userPropertyIds.includes(activePropertyId as number))) {
        const serverId = (user as any).lastPropertyId;
        const fallback = (serverId && serverId > 0 && userPropertyIds.includes(serverId)) ? serverId : userPropertyIds[0];
        if (fallback) {
          setActivePropertyIdState(fallback);
          localStorage.setItem("activePropertyId", String(fallback));
        }
      }
    }
  }, [user, isSuperAdmin, activePropertyId, userPropertyIds, allProperties]);

  const setActivePropertyId = (id: number | "all") => {
    if (id === "all") {
      if (!isSuperAdmin) return;
      setActivePropertyIdState("all");
      localStorage.setItem("activePropertyId", "all");
      saveLastPropertyId("all");
      return;
    }
    if (!isSuperAdmin && !userPropertyIds.includes(id)) return;
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

  return (
    <PropertyContext.Provider
      value={{
        activePropertyId: effectiveId,
        activeProperty,
        properties,
        isSuperAdmin,
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
