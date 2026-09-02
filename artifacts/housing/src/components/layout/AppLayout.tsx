// @ts-nocheck
import { useState, useCallback, useEffect } from "react";
import { applyBrandColors } from "@/lib/brand-colors";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { useTheme } from "next-themes";
import type { Module } from "@/lib/permissions";
import {
  Building2,
  LayoutDashboard,
  Users,
  Wrench,
  FileBarChart,
  Settings,
  Activity,
  LogOut,
  Moon,
  Sun,
  Menu,
  Languages,
  BedDouble,
  UserCheck,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Lock,
  Bell,
  AlertTriangle,
  Clock,
  CalendarCheck,
  UserPlus,
  FileText,
  Trophy,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout, useGetSettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

const SEEN_KEY = "notif_seen_ids";

type NavItem = {
  href?: string;
  label: string;
  icon: React.ElementType;
  subItems?: { href: string; label: string }[];
  superAdminOnly?: boolean;
  permissionModule?: Module;
};

type Notification = {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  entityId: number;
  entityType: string;
};

function NotificationIcon({ type }: { type: string }) {
  if (type === "OVERDUE_CHECKOUT")
    return <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (type === "UPCOMING_CHECKOUT")
    return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  if (type === "RESERVATION_CHECKIN")
    return <CalendarCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  if (type === "PENDING_HOSTING")
    return <UserPlus className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  if (type === "NO_CHECKOUT_DATE")
    return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  if (type === "OPEN_MAINTENANCE")
    return <Wrench className="w-4 h-4 text-orange-500 flex-shrink-0" />;
  if (type === "NEW_SURVEY")
    return <Trophy className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (type === "NEW_DOCUMENT")
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  if (type === "NEW_ACTIVITY")
    return <CalendarCheck className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  return <Bell className="w-4 h-4 text-sidebar-foreground/70 flex-shrink-0" />;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const {
    activeProperty,
    activePropertyId,
    properties,
    isSuperAdmin,
    setActivePropertyId,
  } = useProperty();
  const { canView } = usePermission();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { language, setLanguage, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accommodationOpen, setAccommodationOpen] = useState(
    location.startsWith("/accommodation"),
  );
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const { data: sysSettings } = useGetSettings(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId, staleTime: 300000 } },
  );
  const systemName = sysSettings?.systemName || "Sunrise";
  const systemLogo = sysSettings?.systemLogo ?? null;

  useEffect(() => {
    if (sysSettings) {
      applyBrandColors(sysSettings?.primaryColor, sysSettings?.buttonColor);
    }
  }, [sysSettings]);

  const { data: notifData } = useQuery<{
    count: number;
    notifications: Notification[];
  }>({
    queryKey: ["/api/notifications", activePropertyId],
    queryFn: async () => {
      const url = activePropertyId
        ? `/api/notifications?propertyId=${activePropertyId}`
        : "/api/notifications";
      const r = await fetch(url);
      return r.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const allNotifications = notifData?.notifications ?? [];
  const notifications = allNotifications;
  const notifCount = allNotifications.filter((n) => !seenIds.has(n.id)).length;

  const markAllSeen = useCallback(() => {
    const ids = allNotifications.map((n) => n.id);
    const updated = new Set([...seenIds, ...ids]);
    setSeenIds(updated);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...updated]));
    } catch {}
  }, [allNotifications, seenIds]);

  const markOneSeen = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = new Set([...seenIds, id]);
      setSeenIds(updated);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...updated]));
      } catch {}
    },
    [seenIds],
  );

  const handleSwitchProperty = async (id: number | "all") => {
    if (id === activePropertyId) return;
    if (id !== "all") {
      try {
        await fetch("/api/auth/switch-property", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ propertyId: id }),
        });
      } catch (_) {}
    }
    localStorage.setItem("activePropertyId", String(id));
    window.location.href = id === "all" ? "/dashboard" : "/dashboard";
  };

  const ar = language === "ar";

  const logoutMutation = useLogout({
    mutation: { onSuccess: () => logout() },
  });

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: ar ? "لوحة القيادة" : "Dashboard",
      icon: LayoutDashboard,
      permissionModule: "dashboard",
    },
    {
      href: "/housing",
      label: ar ? "الإسكان" : "Housing",
      icon: Building2,
      permissionModule: "housing",
    },
    {
      href: "/employees",
      label: ar ? "الموظفون" : "Employees",
      icon: Users,
      permissionModule: "employees",
    },
    {
      label: ar ? "الإقامة" : "Accommodation",
      icon: BedDouble,
      permissionModule: "accommodation",
      subItems: [
        {
          href: "/accommodation/reservations",
          label: ar ? "الحجوزات" : "Reservations",
        },
        { href: "/accommodation/in-house", label: ar ? "داخلي" : "In-House" },
        {
          href: "/accommodation/room-assignment",
          label: ar ? "تعيين الغرف" : "Room Assignment",
        },
        {
          href: "/hosting-requests",
          label: ar ? "طلبات الاستضافة" : "Hosting Requests",
        },
        {
          href: "/accommodation/guest-hosting",
          label: ar ? "تسكين الاستضافات" : "Guest Housing",
        },
        { href: "/accommodation/history", label: ar ? "السجل" : "History" },
      ],
    },
    {
      href: "/maintenance",
      label: ar ? "التذاكر" : "Tickets",
      icon: Wrench,
      permissionModule: "maintenance",
    },
    {
      href: "/reports",
      label: ar ? "التقارير" : "Reports",
      icon: FileBarChart,
      permissionModule: "reports",
    },
    {
      href: "/users",
      label: ar ? "المستخدمين" : "Users",
      icon: UserCheck,
      permissionModule: "users",
    },
    {
      href: "/properties",
      label: ar ? "العقارات" : "Properties",
      icon: Building2,
      superAdminOnly: true,
      permissionModule: "properties",
    },
    {
      href: "/portal",
      label: ar ? "البوابة" : "Portal",
      icon: Trophy,
      permissionModule: "employees",
    },
    {
      href: "/settings",
      label: ar ? "الإعدادات" : "Settings",
      icon: Settings,
      permissionModule: "settings",
    },
    {
      href: "/activity-log",
      label: ar ? "سجل النشاط" : "Activity Log",
      icon: Activity,
      permissionModule: "activity_log",
    },
  ];

  const visibleNavItems = navItems.filter((n) => {
    if (n.superAdminOnly && !isSuperAdmin) return false;
    if (n.permissionModule && !canView(n.permissionModule)) return false;
    return true;
  });

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href + "/"));

  const renderSidebar = () => (
    <div className="flex h-full flex-col bg-sidebar backdrop-blur-xl text-sidebar-foreground w-64 border-r border-white/10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]">
      <div className="px-6 py-5 flex flex-col items-center gap-3 border-b border-white/5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        
        {systemLogo ? (
          <img
            src={systemLogo}
            alt="Logo"
            className="h-12 w-auto max-w-[160px] object-contain drop-shadow-md z-10 relative"
            fetchpriority="high"
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 z-10 relative">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="text-center z-10 relative">
          <span className="text-base font-extrabold tracking-tight leading-none block text-sidebar-foreground">
            {systemName}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1.5 no-scrollbar">
        <p className="text-[10px] font-semibold text-sidebar-foreground/70/50 uppercase tracking-widest mb-2 px-3">
          {ar ? "القائمة الرئيسية" : "Main Menu"}
        </p>
        {visibleNavItems.map((item, idx) => {
          if (item.subItems) {
            const isGroupActive = item.subItems.some((s) => isActive(s.href));
            const open = accommodationOpen || isGroupActive;
            return (
              <div key={idx} className="mb-1">
                <button
                  onClick={() => setAccommodationOpen((o) => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                    isGroupActive
                      ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${isGroupActive ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-sidebar-foreground/70'}`}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                  </div>
                  <span className="flex-1 text-start font-medium">{item.label}</span>
                  {open ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
                  ) : (
                    <ChevronRight
                      className={`h-4 w-4 flex-shrink-0 opacity-50 transition-transform ${ar ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}
                >
                  <div
                    className={`${ar ? "mr-6 pr-3 border-r-2" : "ml-6 pl-3 border-l-2"} border-border/40 flex flex-col gap-1`}
                  >
                    {item.subItems.map((sub, sIdx) => {
                      const active = isActive(sub.href);
                      return (
                        <Link
                          key={sIdx}
                          href={sub.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span
                            className={`block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                              active
                                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-500/20 translate-x-1"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 hover:translate-x-1"
                            }`}
                          >
                            {sub.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const active = isActive(item.href!);
          return (
            <Link
              key={idx}
              href={item.href!}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 scale-[1.02]"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:scale-[1.01]"
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20 text-white' : 'text-sidebar-foreground/70'}`}>
                  <item.icon
                    className={`h-4 w-4 flex-shrink-0`}
                  />
                </div>
                <span className="font-medium">{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </span>
            </Link>
          );
        })}
      </div>

    </div>
  );

  return (
    <>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      <div
        className="flex h-full w-full bg-background overflow-hidden"
        dir={dir}
      >
        <div className="hidden md:block flex-shrink-0">{renderSidebar()}</div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side={dir === "rtl" ? "right" : "left"}
                  className="p-0 w-64 bg-sidebar border-none"
                >
                  {renderSidebar()}
                </SheetContent>
              </Sheet>

              {/* Property Switcher in Topbar with property logo */}
              {(isSuperAdmin || activeProperty) &&
                (isSuperAdmin || properties.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors">
                        {activePropertyId === "all" ? (
                          <LayoutGrid className="w-3.5 h-3.5 text-sidebar-primary flex-shrink-0" />
                        ) : activeProperty && (activeProperty as any).logo ? (
                          <img
                            src={(activeProperty as any).logo}
                            alt=""
                            className="h-6 w-auto max-w-[56px] rounded object-contain flex-shrink-0"
                          />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-sidebar-primary flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-sidebar-primary truncate max-w-[140px]">
                          {activePropertyId === "all"
                            ? ar
                              ? "كل البروبرتيز"
                              : "All Properties"
                            : activeProperty
                              ? activeProperty.displayName ||
                                activeProperty.name
                              : ar
                                ? "اختر بروبرتي"
                                : "Select Property"}
                        </span>
                        {isSuperAdmin &&
                          activeProperty &&
                          activePropertyId !== "all" && (
                            <span className="text-[9px] font-mono text-sidebar-foreground/70 uppercase bg-muted px-1 rounded">
                              {activeProperty.code}
                            </span>
                          )}
                        <ChevronsUpDown className="w-3 h-3 text-sidebar-primary/50 flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                      <DropdownMenuLabel className="text-xs text-sidebar-foreground/70 uppercase tracking-wide">
                        {ar ? "اختر الفرع" : "Switch Property"}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isSuperAdmin && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleSwitchProperty("all")}
                            className="flex items-center gap-2 cursor-pointer border-b border-border/50 mb-1"
                          >
                            <Check
                              className={`w-3.5 h-3.5 ${activePropertyId === "all" ? "opacity-100 text-sidebar-primary" : "opacity-0"}`}
                            />
                            <LayoutGrid className="w-4 h-4 text-violet-600" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {ar ? "كل البروبرتيز" : "All Properties"}
                              </p>
                              <p className="text-xs text-sidebar-foreground/70">
                                {ar
                                  ? "عرض إجمالي كل الفروع"
                                  : "Aggregated overview"}
                              </p>
                            </div>
                          </DropdownMenuItem>
                        </>
                      )}
                      {properties.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => handleSwitchProperty(p.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Check
                            className={`w-3.5 h-3.5 ${activePropertyId !== "all" && activeProperty?.id === p.id ? "opacity-100 text-sidebar-primary" : "opacity-0"}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {p.displayName || p.name}
                            </p>
                            <p className="text-xs text-sidebar-foreground/70 font-mono">
                              {p.code}
                            </p>
                          </div>
                          {p.status !== "active" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0"
                            >
                              inactive
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : activeProperty ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/8 border border-primary/15">
                    {(activeProperty as any).logo ? (
                      <img
                        src={(activeProperty as any).logo}
                        alt=""
                        className="h-6 w-auto max-w-[56px] rounded object-contain flex-shrink-0"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-sidebar-primary" />
                    )}
                    <span className="text-xs font-semibold text-sidebar-primary truncate max-w-[140px]">
                      {activeProperty.displayName || activeProperty.name}
                    </span>
                    {isSuperAdmin && (
                      <span className="ml-1 text-[9px] font-mono text-sidebar-foreground/70 uppercase bg-muted px-1 rounded">
                        {activeProperty.code}
                      </span>
                    )}
                  </div>
                ) : null)}
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu
                open={notifOpen}
                onOpenChange={(open) => {
                  setNotifOpen(open);
                }}
              >
                <div className="relative">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={ar ? "الإشعارات" : "Notifications"}
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  {notifCount > 0 && (
                    <span className="pointer-events-none absolute -top-1 -right-1 h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none z-10">
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </div>
                <DropdownMenuContent
                  align="end"
                  className="w-80 max-h-[480px] overflow-y-auto"
                >
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>{ar ? "الإشعارات" : "Notifications"}</span>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {notifCount} {ar ? "جديد" : "new"}
                        </Badge>
                      )}
                      {notifCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            markAllSeen();
                          }}
                          className="text-[10px] text-sidebar-primary hover:underline font-medium"
                        >
                          {ar ? "قراءة الكل" : "Mark all read"}
                        </button>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm text-sidebar-foreground/70">
                        {ar ? "لا توجد إشعارات" : "No notifications"}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isSeen = seenIds.has(n.id);
                      const notifHref =
                        n.type === "OVERDUE_CHECKOUT" ||
                        n.type === "UPCOMING_CHECKOUT" ||
                        n.type === "NO_CHECKOUT_DATE"
                          ? "/accommodation/in-house"
                          : n.type === "RESERVATION_CHECKIN"
                            ? "/accommodation/reservations"
                            : n.type === "PENDING_HOSTING"
                              ? "/accommodation/guest-hosting"
                              : n.type === "HOSTING_REQUEST_PENDING"
                                ? `/hosting-requests/${n.entityId}`
                                : n.type === "OPEN_MAINTENANCE"
                                  ? "/maintenance"
                                  : n.type === "NEW_SURVEY"
                                    ? "/portal"
                                    : n.type === "NEW_DOCUMENT"
                                      ? "/portal"
                                      : n.type === "NEW_ACTIVITY"
                                        ? "/portal"
                                        : "/dashboard";
                      return (
                        <DropdownMenuItem
                          key={n.id}
                          className={`flex items-start gap-2.5 p-3 cursor-pointer group ${!isSeen ? "bg-primary/5" : ""}`}
                          onClick={(e) => {
                            markOneSeen(n.id, e);
                            setNotifOpen(false);
                            setTimeout(() => setLocation(notifHref), 50);
                          }}
                        >
                          <NotificationIcon type={n.type} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-xs">
                                {ar ? n.titleAr : n.title}
                              </p>
                              {!isSeen && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-sidebar-foreground/70 mt-0.5 line-clamp-2">
                              {ar ? n.descriptionAr : n.description}
                            </p>
                            <Badge
                              variant="outline"
                              className={`mt-1 text-[10px] py-0 px-1.5 h-4 ${
                                n.priority === "high"
                                  ? "border-red-300 text-red-600"
                                  : n.priority === "medium"
                                    ? "border-amber-300 text-amber-600"
                                    : "border-gray-300 text-gray-500"
                              }`}
                            >
                              {n.priority}
                            </Badge>
                          </div>
                          {!isSeen && (
                            <button
                              onClick={(e) => markOneSeen(n.id, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                              title={ar ? "تعليم كمقروء" : "Mark as read"}
                            >
                              <span className="text-xs">✓</span>
                            </button>
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Language"
                  >
                    <Languages className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLanguage("en")}
                    className={
                      language === "en" ? "bg-accent font-semibold" : ""
                    }
                  >
                    🇺🇸 English
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLanguage("ar")}
                    className={
                      language === "ar" ? "bg-accent font-semibold" : ""
                    }
                  >
                    🇸🇦 العربية
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Theme"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    ☀️ Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    🌙 Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    💻 System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden md:flex items-center gap-2 ml-1 pl-3 border-l border-border hover:opacity-70 transition-opacity cursor-pointer">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-sidebar-primary-foreground text-xs font-bold">
                        {user?.username?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {user?.username}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-semibold">{user?.username}</p>
                      <p className="text-xs text-sidebar-foreground/70 capitalize">
                        {user?.roles?.[0]?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setChangePasswordOpen(true)}
                    className="cursor-pointer"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {ar ? "تغيير كلمة المرور" : "Change Password"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="cursor-pointer text-red-600"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {ar ? "تسجيل الخروج" : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-auto bg-background flex flex-col">
            <div className="flex-1 flex flex-col p-4 sm:p-6">
              {activePropertyId === "all" &&
                !location.startsWith("/dashboard") && (
                  <div className="mb-4 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 px-4 py-3 flex items-center gap-3 text-sm shadow-sm">
                    <LayoutGrid className="w-5 h-5 text-violet-600 flex-shrink-0" />
                    <p className="text-violet-700 dark:text-violet-300 flex-1">
                      {ar
                        ? "أنت تتصفح جميع الفروع حالياً. يرجى اختيار فرع محدد من قائمة الفروع للوصول إلى هذه الصفحة."
                        : "You are currently viewing all properties. Please select a specific property from the dropdown to access this page."}
                    </p>
                  </div>
                )}
              {children}
            </div>

            {/* Footer التعديل الجديد هنا - حجم أصغر */}
            <footer className="py-3 border-t bg-card/30 backdrop-blur-sm mt-auto">
              <div className="container mx-auto flex flex-col items-center justify-center gap-0.5 text-center px-4">
                <p className="text-[11px] md:text-xs font-medium text-sidebar-foreground/70/80 flex flex-wrap items-center justify-center gap-x-2">
                  <span className="text-sidebar-primary/80 font-bold">© 2026</span>
                  <span className="font-semibold uppercase tracking-wider">
                    SUNRISE IT Team
                  </span>
                  <span className="hidden md:inline text-sidebar-foreground/70/20">
                    |
                  </span>
                  <span className="font-normal">
                    White Hills & Meraki Resort
                  </span>
                </p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
