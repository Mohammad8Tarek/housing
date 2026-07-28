import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Moon, Sun, Bell, LogOut } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import {
  usePortalProfile,
  usePortalRoom,
  usePortalNotifications,
  usePortalAlerts,
} from "@workspace/api-client-react";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

import MobileNav, { type Tab } from "../components/MobileNav";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useSwipeGesture, useHapticFeedback } from "../hooks/useMobileGestures";
import {
  SkeletonOverview,
  SkeletonRequests,
  SkeletonDocuments,
} from "../components/SkeletonLoader";

import TabOverview from "../components/TabOverview";
import TabRequests from "../components/TabRequests";
import TabActivities from "../components/TabActivities";
import TabPortalSettings from "../components/TabPortalSettings";
import TabEvaluations from "../components/TabEvaluations";
import TabDocuments from "../components/TabDocuments";
import TabProfile from "../components/TabProfile";
import TabRoommates from "../components/TabRoommates";
import TabNotifications from "../components/TabNotifications";
import TabFood from "../components/TabFood";
import TabTransport from "../components/TabTransport";
import TabChat from "../components/chat/TabChat";
import { getPortalTabFromUrl, normalizePortalTab } from "../lib/portal-tabs";

interface Employee {
  id?: number;
  employeeId?: string;
  fullName?: string;
  firstName?: string;
  photoUrl?: string;
  department?: string;
  [key: string]: unknown;
}

interface PortalData {
  photoUrl?: string | null;
  room?: Record<string, unknown> | null;
  assignments?: Record<string, unknown>[];
  [key: string]: unknown;
}

interface Contact {
  id?: number;
  nameAr?: string;
  nameEn?: string;
  roleAr?: string;
  roleEn?: string;
  phone?: string;
  email?: string;
  extension?: string;
  [key: string]: unknown;
}

const TAB_ORDER: Tab[] = [
  "overview",
  "documents",
  "requests",
  "activities",
  "evaluations",
  "notifications",
  "profile",
  "portal-settings",
];

function getTabFromURL(): Tab {
  return getPortalTabFromUrl(window.location.search) as Tab;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { lang, toggleTheme, theme } = useTheme();
  const isRtl = lang === "ar";
  const haptic = useHapticFeedback();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, unknown>[]>([]);
  const [roommates, setRoommates] = useState<Record<string, unknown>[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const fetched = useRef<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromURL);
  const [isLoading, setIsLoading] = useState(true);
  const [showHR, setShowHR] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef(0);

  const { data: profileRes, isError: isProfileError } = usePortalProfile();
  const { data: roomRes } = usePortalRoom();
  const { data: notifRes } = usePortalNotifications();
  const { data: alertsRes } = usePortalAlerts();

  // Update employee and portalData when query data changes
  useEffect(() => {
    if (isProfileError) {
      sessionStorage.removeItem("portal_employee");
      window.location.href = "/login";
      return;
    }
    const profileData = profileRes as any;
    if (profileData) {
      setEmployee((prev: any) => ({
        ...prev,
        ...profileData,
        fullName: profileData.name,
        photoUrl: profileData.photo,
      }));
    }

    setPortalData({
      room: roomRes as any,
      assignments: [],
      photoUrl: profileData?.photo,
      notifications: notifRes as any,
      alerts: alertsRes as any,
    } as any);

    if (profileData && roomRes) {
      setIsLoading(false);
    }
  }, [profileRes, roomRes, notifRes, alertsRes, isProfileError]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Track if a tab has been fetched (separate from ref for render-safe access)
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());
  const markFetched = useCallback((tab: string) => {
    fetched.current.add(tab);
    setFetchedTabs((prev) => new Set(prev).add(tab));
  }, []);

  const redirectToLogin = useCallback(() => {
    sessionStorage.removeItem("portal_employee");
    window.location.href = "/login";
  }, []);

  const playNotifSound = useCallback(() => {
    try {
      const ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const { handleTouchStart, handleTouchEnd } = useSwipeGesture({
    onSwipeLeft: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      const next = isRtl ? TAB_ORDER[idx - 1] : TAB_ORDER[idx + 1];
      if (next) changeTab(next);
    },
    onSwipeRight: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      const prev = isRtl ? TAB_ORDER[idx + 1] : TAB_ORDER[idx - 1];
      if (prev) changeTab(prev);
    },
    threshold: 60,
  });

  const fetchDocuments = useCallback(async () => {
    if (fetched.current.has("documents")) return;
    try {
      const r = await apiFetch("/api/portal-data/documents", {
        credentials: "include",
      });
      if (r.status === 401) {
        redirectToLogin();
        return;
      }
      markFetched("documents");
      const d = await r.json();
      if (d && typeof d === "object" && "success" in d && d.success) {
        setDocuments(
          (d as { documents?: Record<string, unknown>[] }).documents || [],
        );
      }
    } catch {
      /* silent - offline */
    }
  }, [redirectToLogin, markFetched]);

  const fetchEvaluations = useCallback(async () => {
    if (fetched.current.has("evaluations")) return;
    try {
      const r = await apiFetch("/api/portal-data/my-evaluations", {
        credentials: "include",
      });
      if (r.status === 401) {
        redirectToLogin();
        return;
      }
      if (!r.ok) return;
      markFetched("evaluations");
      const d = await r.json();
      if (Array.isArray(d)) setEvaluations(d as Record<string, unknown>[]);
      else if (d && typeof d === "object" && "success" in d && d.success) {
        setEvaluations(
          (d as { evaluations?: Record<string, unknown>[] }).evaluations || [],
        );
      }
    } catch {
      /* silent - offline */
    }
  }, [redirectToLogin, markFetched]);

  const fetchRoommates = useCallback(async () => {
    if (fetched.current.has("roommates")) return;
    try {
      const r = await apiFetch("/api/portal-data/roommates", {
        credentials: "include",
      });
      if (r.status === 401) {
        redirectToLogin();
        return;
      }
      markFetched("roommates");
      const d = await r.json();
      if (d && typeof d === "object" && "success" in d && d.success) {
        setRoommates(
          (d as { roommates?: Record<string, unknown>[] }).roommates || [],
        );
      }
    } catch {
      /* silent - offline */
    }
  }, [redirectToLogin, markFetched]);

  const changeTab = useCallback(
    (tab: Tab, forceRefresh = false) => {
      const nextTab = normalizePortalTab(tab);
      haptic.tap();
      if (forceRefresh) {
        fetched.current.delete(nextTab);
        setFetchedTabs((prev) => {
          const next = new Set(prev);
          next.delete(nextTab);
          return next;
        });
      }
      if (nextTab === activeTab) return;
      setActiveTab(nextTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url.toString());
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [activeTab, haptic],
  );

  // Lazy tab fetching via effects
  useEffect(() => {
    if (activeTab === "documents") fetchDocuments();
    if (activeTab === "evaluations") fetchEvaluations();
    if (activeTab === "roommates") fetchRoommates();
  }, [activeTab, fetchDocuments, fetchEvaluations, fetchRoommates]);

  const handleRefresh = useCallback(async () => {
    fetched.current.delete("dashboard");
    fetched.current.delete(activeTab);
    setFetchedTabs((prev) => {
      const next = new Set(prev);
      next.delete("dashboard");
      next.delete(activeTab);
      return next;
    });
    if (activeTab === "documents") await fetchDocuments();
    if (activeTab === "evaluations") await fetchEvaluations();
  }, [activeTab, fetchDocuments, fetchEvaluations]);

  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
    containerRef: scrollRef as React.RefObject<HTMLElement>,
  });

  // Fetch notifications via polling (with proper effect)
  const fetchNotifs = useCallback(async () => {
    if (!employee) return;
    try {
      const res = await apiFetch("/api/portal-notifications/my", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          setUnreadCount((data as { unreadCount?: number }).unreadCount || 0);
        }
      }
    } catch {
      /* silent - offline */
    }
  }, [employee]);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(() => {
      if (!document.hidden) fetchNotifs();
    }, 15000);
    window.addEventListener("refresh_notifications", fetchNotifs);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh_notifications", fetchNotifs);
    };
  }, [fetchNotifs]);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      playNotifSound();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, playNotifSound]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      if (headerRef.current) {
        if (scrollEl.scrollTop > 4) {
          headerRef.current.classList.add("scrolled");
        } else {
          headerRef.current.classList.remove("scrolled");
        }
      }
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    const fetchPending = async () => {
      try {
        const r = await apiFetch("/api/portal-data/my-maintenance", {
          credentials: "include",
        });
        if (r.ok) {
          const d = await r.json();
          const requests = Array.isArray(d)
            ? d
            : (d as { requests?: Record<string, unknown>[] }).requests || [];
          const open = requests.filter(
            (req: Record<string, unknown>) =>
              req.status === "OPEN" ||
              req.status === "IN_PROGRESS" ||
              req.status === "open" ||
              req.status === "in_progress",
          ).length;
          if (!cancelled) setPendingCount(open);
        }
      } catch {
        /* silent */
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [employee]);

  useEffect(() => {
    let cancelled = false;

    if (Capacitor.isNativePlatform()) {
      import("@capacitor/local-notifications")
        .then(({ LocalNotifications }) => {
          LocalNotifications.requestPermissions().catch(() => {});
        })
        .catch(() => {});
      import("@capacitor/push-notifications")
        .then(({ PushNotifications }) => {
          PushNotifications.requestPermissions().catch(() => {});
        })
        .catch(() => {});
      import("@capacitor/camera")
        .then(({ Camera }) => {
          Camera.requestPermissions().catch(() => {});
        })
        .catch(() => {});
      import("@capacitor/geolocation")
        .then(({ Geolocation }) => {
          Geolocation.requestPermissions().catch(() => {});
        })
        .catch(() => {});
    }

    const bootstrap = async () => {
      try {
        const stored = sessionStorage.getItem("portal_employee");
        if (stored) {
          try {
            setEmployee(JSON.parse(stored) as Employee);
          } catch {}
        }

        const me = await apiFetch("/api/portal-auth/me", {
          credentials: "include",
        });
        if (me.status === 401 || me.status === 403) {
          redirectToLogin();
          return;
        }

        const data = await me.json();
        if (!data.success || !data.employee) {
          redirectToLogin();
          return;
        }

        if (data.mustChangePassword) {
          sessionStorage.setItem(
            "portal_employee",
            JSON.stringify(data.employee),
          );
          setLocation("/change-password");
          return;
        }

        sessionStorage.setItem(
          "portal_employee",
          JSON.stringify(data.employee),
        );
        if (!cancelled) setEmployee(data.employee as Employee);

        if ("serviceWorker" in navigator && "PushManager" in window) {
          navigator.serviceWorker?.ready?.then(async (reg) => {
            try {
              const existingSub = await reg.pushManager.getSubscription();
              if (existingSub) return;
              if (Notification.permission !== "granted") return;
              const keyRes = await apiFetch("/api/push/vapid-key", {
                credentials: "include",
              });
              const keyData = await keyRes.json();
              if (!keyData.success || !keyData.publicKey) return;
              const padding = "=".repeat(
                (4 - (keyData.publicKey.length % 4)) % 4,
              );
              const base64 = (keyData.publicKey + padding)
                .replace(/-/g, "+")
                .replace(/_/g, "/");
              const rawData = window.atob(base64);
              const appKey = new Uint8Array(rawData.length);
              for (let i = 0; i < rawData.length; ++i)
                appKey[i] = rawData.charCodeAt(i);
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: appKey.buffer,
              });
              const subJson = sub.toJSON();
              await apiFetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  endpoint: sub.endpoint,
                  p256dhKey:
                    (subJson as { keys?: { p256dh?: string } }).keys?.p256dh ||
                    "",
                  authKey:
                    (subJson as { keys?: { auth?: string } }).keys?.auth || "",
                }),
              });
            } catch {}
          });
        }

        await Promise.all([
          apiFetch("/api/portal-data/my-contacts", { credentials: "include" })
            .then((r) => (r.status === 401 ? null : r.json()))
            .then((d) => {
              if (
                d &&
                typeof d === "object" &&
                "success" in d &&
                d.success &&
                Array.isArray((d as { contacts: Contact[] }).contacts)
              ) {
                setContacts((d as { contacts: Contact[] }).contacts);
              }
            })
            .catch(() => {}),
        ]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    bootstrap().catch(() => {
      if (!cancelled) redirectToLogin();
    });
    return () => {
      cancelled = true;
    };
  }, [setLocation, redirectToLogin]);

  // Memoize activeTab for conditional rendering
  const isDocFetched = useMemo(
    () => fetchedTabs.has("documents"),
    [fetchedTabs],
  );
  const isEvalFetched = useMemo(
    () => fetchedTabs.has("evaluations"),
    [fetchedTabs],
  );

  if (isLoading || !employee) {
    return (
      <div style={{ height: "100dvh", background: "hsl(var(--surface2))" }}>
        <SkeletonOverview />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        background: "hsl(var(--surface2))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />

      <header
        ref={headerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "hsl(var(--card))",
          borderBottom: "0.5px solid hsl(var(--border2))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          paddingTop: `max(10px, env(safe-area-inset-top, 10px))`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "hsl(var(--accent2)/0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(var(--accent2))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "hsl(var(--foreground))",
                lineHeight: 1.2,
                fontFamily: "'Playfair Display', serif",
                letterSpacing: "0.03em",
              }}
            >
              {isRtl ? "صن رايز للموارد البشرية" : "Sunrise HR"}
            </div>
            <div
              style={{
                fontSize: "9px",
                color: "hsl(var(--accent2))",
                lineHeight: 1.2,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {isRtl ? "بوابة الموظفين" : "Employee Portal"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <button
            onClick={() => changeTab("notifications")}
            style={{
              position: "relative",
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label={isRtl ? "الإشعارات" : "Notifications"}
          >
            <Bell
              style={{
                width: "19px",
                height: "19px",
                color:
                  unreadCount > 0
                    ? "hsl(var(--accent2))"
                    : "hsl(var(--muted2))",
              }}
            />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  right: "3px",
                  minWidth: "15px",
                  height: "15px",
                  borderRadius: "8px",
                  background: "hsl(var(--accent2))",
                  color: "white",
                  fontSize: "8px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 2px",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            style={{
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label={isRtl ? "تبديل الثيم" : "Toggle theme"}
          >
            {theme === "dark" ? (
              <Sun
                style={{
                  width: "17px",
                  height: "17px",
                  color: "hsl(var(--muted2))",
                }}
              />
            ) : (
              <Moon
                style={{
                  width: "17px",
                  height: "17px",
                  color: "hsl(var(--muted2))",
                }}
              />
            )}
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem("portal_employee");
              Preferences.remove({ key: "portal_employee" });
              Preferences.remove({ key: "session_id" });
              setLocation("/login");
            }}
            style={{
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label={isRtl ? "تسجيل الخروج" : "Logout"}
          >
            <LogOut
              style={{
                width: "17px",
                height: "17px",
                color: "hsl(var(--destructive, 0 84.2% 60.2%))",
              }}
            />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          ref={contentRef}
          onTouchStart={(e) => handleTouchStart(e.nativeEvent)}
          onTouchEnd={(e) => handleTouchEnd(e.nativeEvent)}
        >
          {activeTab === "overview" && (
            <TabOverview
              employee={employee}
              portalData={portalData}
              onRequestTab={() => changeTab("requests")}
              onActivitiesTab={() => changeTab("activities")}
              onEvaluationsTab={() => changeTab("evaluations")}
              onDocTab={() => changeTab("documents")}
              onProfileTab={() => changeTab("profile")}
              onRoommatesTab={() => changeTab("roommates")}
              onHR={() => setShowHR(true)}
            />
          )}
          {activeTab === "requests" && <TabRequests />}
          {activeTab === "documents" &&
            (documents.length === 0 && !isDocFetched ? (
              <SkeletonDocuments />
            ) : (
              <TabDocuments
                documents={
                  documents as {
                    id: number;
                    titleAr: string;
                    titleEn: string;
                    fileName: string;
                    fileType: string;
                    fileData: string;
                    category: string;
                    createdAt: string;
                  }[]
                }
              />
            ))}
          {activeTab === "activities" && <TabActivities />}
          {activeTab === "evaluations" &&
            (evaluations.length === 0 && !isEvalFetched ? (
              <SkeletonRequests />
            ) : (
              <TabEvaluations
                evaluations={
                  evaluations as {
                    id: number;
                    employeeId: number | null;
                    rating: number | null;
                    comment?: string;
                    employeeResponse?: string;
                    employeeRating?: number;
                    category: string;
                    titleAr?: string;
                    titleEn?: string;
                    descriptionAr?: string;
                    descriptionEn?: string;
                    department?: string;
                    submittedAt: string;
                    createdAt: string;
                    _hasResponded?: boolean;
                    items?: {
                      id: number;
                      templateId: number;
                      titleAr: string;
                      titleEn: string;
                      type: "rating" | "text" | "yes_no";
                      required: boolean;
                      orderIndex: number;
                    }[];
                  }[]
                }
                onCommentAdded={() => {
                  fetched.current.delete("evaluations");
                  setFetchedTabs((prev) => {
                    const n = new Set(prev);
                    n.delete("evaluations");
                    return n;
                  });
                  fetchEvaluations();
                }}
              />
            ))}
          {activeTab === "portal-settings" && <TabPortalSettings />}
          {activeTab === "profile" && (
            <TabProfile photoUrl={employee?.photoUrl} />
          )}
          {activeTab === "roommates" && (
            <TabRoommates
              roommates={
                roommates as {
                  id: number;
                  firstName: string;
                  lastName: string;
                  employeeCode: string;
                  email: string;
                  phone?: string;
                  department: string;
                  jobTitle?: string;
                  photoUrl?: string;
                }[]
              }
              room={portalData?.room ?? undefined}
            />
          )}
          {activeTab === "notifications" && (
            <TabNotifications
              onChangeTab={
                changeTab as (tab: string, forceRefresh?: boolean) => void
              }
            />
          )}
          {activeTab === "food" && <TabFood />}
          {activeTab === "transport" && <TabTransport />}
          {activeTab === "chat" && (
            <TabChat
              myEmployeeId={employee?.id}
              contacts={contacts}
            />
          )}
        </div>
      </div>

      <MobileNav
        active={activeTab}
        onChange={changeTab}
        requestCount={pendingCount}
        notifCount={unreadCount}
      />

      {showHR && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowHR(false)}
        >
          <div
            style={{
              width: "100%",
              background: "hsl(var(--card))",
              borderRadius: "20px 20px 0 0",
              padding: "20px 20px",
              paddingBottom: `calc(20px + env(safe-area-inset-bottom, 0px))`,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "36px",
                height: "4px",
                background: "hsl(var(--border2))",
                borderRadius: "2px",
                margin: "0 auto 8px",
              }}
            />
            <div
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "hsl(var(--foreground))",
              }}
            >
              {isRtl ? "تواصل مع الموارد البشرية" : "Contact HR"}
            </div>
            {contacts.length === 0 ? (
              <div
                style={{
                  padding: "12px",
                  textAlign: "center",
                  color: "hsl(var(--muted2))",
                  fontSize: "13px",
                }}
              >
                {isRtl
                  ? "لا توجد جهات اتصال مضافة حتى الآن"
                  : "No contacts available yet"}
              </div>
            ) : (
              contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "hsl(var(--surface))",
                    borderRadius: "12px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "15px",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {isRtl ? c.nameAr : c.nameEn}
                  </div>
                  {(c.roleAr || c.roleEn) && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "hsl(var(--muted2))",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {isRtl ? c.roleAr : c.roleEn}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "hsl(var(--accent2))",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        📞 {c.phone}
                        {c.extension ? ` (${c.extension})` : ""}
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "hsl(var(--accent2))",
                          textDecoration: "none",
                          fontSize: "13px",
                        }}
                      >
                        📧 {c.email}
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
