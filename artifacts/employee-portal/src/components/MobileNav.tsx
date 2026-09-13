import { useState } from "react";
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
  Menu,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import type { PortalTab } from "../lib/portal-tabs";
import { BottomSheetDrawer } from "./BottomSheetDrawer";
import { cn } from "../lib/utils";

export type Tab = PortalTab;

interface NavItem {
  id: Tab;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  badge?: number;
  descAr?: string;
  descEn?: string;
  color?: string;
  bgColor?: string;
}

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  requestCount?: number;
  notifCount?: number;
  chatCount?: number;
}

const MORE_ITEMS: NavItem[] = [
  {
    id: "roommates",
    icon: Users,
    labelAr: "زملاء السكن",
    labelEn: "Roommates Hub",
    descAr: "التواصل مع زملاء الغرفة",
    descEn: "Connect with room members",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "food",
    icon: UtensilsCrossed,
    labelAr: "الوجبات والمطعم",
    labelEn: "Dining & Meals",
    descAr: "قائمة طعام اليوم",
    descEn: "Today's cafeteria menu",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "transport",
    icon: Bus,
    labelAr: "باصات السكن",
    labelEn: "Shuttle Buses",
    descAr: "مواعيد باصات الفندق",
    descEn: "Hotel transfer schedules",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "activities",
    icon: Calendar,
    labelAr: "الفعاليات والأنشطة",
    labelEn: "Activities",
    descAr: "بطولات ودورات السكن",
    descEn: "Sports & community events",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    id: "evaluations",
    icon: Star,
    labelAr: "التقييمات والأداء",
    labelEn: "Evaluations",
    descAr: "سجل الأداء الشهري",
    descEn: "Performance reviews",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    id: "documents",
    icon: FileText,
    labelAr: "المستندات والعقود",
    labelEn: "Documents",
    descAr: "عقود العمل والهوية",
    descEn: "Contracts & ID copies",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    id: "profile",
    icon: User,
    labelAr: "الملف الشخصي",
    labelEn: "My Profile",
    descAr: "بيانات الإقامة والاتصال",
    descEn: "Personal details & QR",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "portal-settings",
    icon: Settings,
    labelAr: "الإعدادات والتطبيق",
    labelEn: "Settings & App",
    descAr: "تثبيت PWA والأمان",
    descEn: "PWA install & security",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
  },
];

export default function MobileNav({
  active,
  onChange,
  requestCount = 0,
  notifCount = 0,
  chatCount = 0,
}: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [showMore, setShowMore] = useState(false);

  const items: NavItem[] = [
    { id: "overview", icon: Home, labelAr: "الرئيسية", labelEn: "Home" },
    {
      id: "requests",
      icon: ListTodo,
      labelAr: "طلباتي",
      labelEn: "Requests",
      badge: requestCount,
    },
    {
      id: "chat",
      icon: MessageCircle,
      labelAr: "المحادثة",
      labelEn: "Chat",
      badge: chatCount,
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
      icon: Menu,
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
    <>
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
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
                  setShowMore(true);
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
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  style={{
                    width: "22px",
                    height: "22px",
                    color: isActive
                      ? "hsl(var(--accent2))"
                      : "hsl(var(--muted2))",
                    transition: "color 0.15s, transform 0.15s",
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                  }}
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
      </nav>

      {/* Modern iOS Bottom Sheet Drawer for All Services */}
      <BottomSheetDrawer
        isOpen={showMore}
        onClose={() => setShowMore(false)}
        title={isRtl ? "خدمات السكن والموظف" : "Resort Housing Services"}
        subtitle={
          isRtl
            ? "الوصول السريع لكافة المرافق والخدمات الميدانية"
            : "Direct quick access to all resort staff amenities"
        }
      >
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isItemActive = active === item.id;
            const label = isRtl ? item.labelAr : item.labelEn;
            const desc = isRtl ? item.descAr : item.descEn;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTap(item.id)}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 text-start cursor-pointer select-none",
                  isItemActive
                    ? "bg-accent2/10 border-accent2/40 shadow-sm"
                    : "bg-card/70 border-border/60 hover:bg-muted/50 hover:border-border",
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                      item.bgColor || "bg-accent2/10",
                      item.color || "text-accent2",
                    )}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  {isRtl ? (
                    <ChevronLeft className="w-4 h-4 text-muted-foreground/40" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-xs text-foreground truncate">
                    {label}
                  </h4>
                  {desc && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {desc}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </BottomSheetDrawer>
    </>
  );
}
