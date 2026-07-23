import { useState, useRef, useEffect } from "react";
import {
  Home,
  ListTodo,
  Star,
  Settings,
  Bell,
  FileText,
  User,
  Users,
  Calendar,
  UtensilsCrossed,
  Bus,
  MessageCircle,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import type { PortalTab } from "../lib/portal-tabs";

export type Tab = PortalTab;

interface NavItem {
  id: Tab;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  badge?: number;
}

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  requestCount?: number;
  notifCount?: number;
}

const MORE_ITEMS: NavItem[] = [
  {
    id: "evaluations",
    icon: Star,
    labelAr: "التقييمات",
    labelEn: "Evaluations",
  },
  {
    id: "activities",
    icon: Calendar,
    labelAr: "الفعاليات",
    labelEn: "Activities",
  },
  { id: "profile", icon: User, labelAr: "الملف الشخصي", labelEn: "Profile" },
  {
    id: "roommates",
    icon: Users,
    labelAr: "زملاء السكن",
    labelEn: "Roommates",
  },
  { id: "food", icon: UtensilsCrossed, labelAr: "الطعام", labelEn: "Food" },
  { id: "transport", icon: Bus, labelAr: "المواصلات", labelEn: "Transport" },
  { id: "chat", icon: MessageCircle, labelAr: "المحادثة", labelEn: "Chat" },
  {
    id: "portal-settings",
    icon: Settings,
    labelAr: "الإعدادات",
    labelEn: "Settings",
  },
];

export default function MobileNav({
  active,
  onChange,
  requestCount = 0,
  notifCount = 0,
}: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node))
        setShowMore(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items: NavItem[] = [
    { id: "overview", icon: Home, labelAr: "الرئيسية", labelEn: "Home" },
    {
      id: "documents",
      icon: FileText,
      labelAr: "المستندات",
      labelEn: "Documents",
    },
    {
      id: "requests",
      icon: ListTodo,
      labelAr: "طلباتي",
      labelEn: "Requests",
      badge: requestCount,
    },
    {
      id: "notifications",
      icon: Bell,
      labelAr: "الإشعارات",
      labelEn: "Alerts",
      badge: notifCount,
    },
    {
      id: "portal-settings",
      icon: Settings,
      labelAr: "المزيد",
      labelEn: "More",
    },
  ];

  const handleTap = (id: Tab) => {
    if ("vibrate" in navigator) navigator.vibrate(8);
    setShowMore(false);
    onChange(id);
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "hsl(var(--card))",
        borderTop: "0.5px solid hsl(var(--border2))",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        display: "flex",
        alignItems: "stretch",
      }}
      role="tablist"
      aria-label={isRtl ? "التنقل الرئيسي" : "Main navigation"}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const label = isRtl ? item.labelAr : item.labelEn;

        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => {
              if (item.id === "portal-settings") {
                setShowMore(!showMore);
              } else {
                handleTap(item.id);
              }
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              paddingTop: "10px",
              paddingBottom: "10px",
              minHeight: "56px",
              background: "none",
              border: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              position: "relative",
              transition: "opacity 0.15s",
            }}
          >
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: "25%",
                  right: "25%",
                  height: "2px",
                  borderRadius: "0 0 2px 2px",
                  background: "hsl(var(--accent2))",
                }}
              />
            )}

            <span style={{ position: "relative" }}>
              <Icon
                style={{
                  width: "22px",
                  height: "22px",
                  color: isActive
                    ? "hsl(var(--accent2))"
                    : "hsl(var(--muted2))",
                  transition: "color 0.15s",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {!!item.badge && item.badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-6px",
                    minWidth: "16px",
                    height: "16px",
                    borderRadius: "8px",
                    background: "hsl(var(--accent2))",
                    color: "hsl(var(--accent2-foreground))",
                    fontSize: "9px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                  }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </span>

            <span
              style={{
                fontSize: "10px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "hsl(var(--accent2))" : "hsl(var(--muted2))",
                transition: "color 0.15s, font-weight 0.15s",
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* More submenu */}
      {showMore && (
        <div
          ref={moreRef}
          style={{
            position: "fixed",
            bottom: "calc(64px + env(safe-area-inset-bottom, 8px))",
            right: isRtl ? "auto" : "8px",
            left: isRtl ? "8px" : "auto",
            background: "hsl(var(--card))",
            border: "0.5px solid hsl(var(--border2))",
            borderRadius: "16px",
            padding: "8px",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
            zIndex: 60,
            minWidth: "180px",
          }}
        >
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isItemActive = active === item.id;
            const label = isRtl ? item.labelAr : item.labelEn;
            return (
              <button
                key={item.id}
                onClick={() => handleTap(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: isItemActive ? "hsl(var(--accent2)/0.1)" : "none",
                  border: "none",
                  cursor: "pointer",
                  color: isItemActive
                    ? "hsl(var(--accent2))"
                    : "hsl(var(--foreground))",
                  fontWeight: isItemActive ? 600 : 400,
                  fontSize: "13px",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Icon
                  style={{
                    width: "18px",
                    height: "18px",
                    color: isItemActive
                      ? "hsl(var(--accent2))"
                      : "hsl(var(--muted2))",
                  }}
                />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
