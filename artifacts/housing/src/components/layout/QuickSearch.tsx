// Quick search (Ctrl+K / ⌘K): pages, employees, rooms, tickets and users of
// the current property in one box. Arrow keys move, Enter opens.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BedDouble,
  CornerDownLeft,
  FileText,
  Loader2,
  Search,
  UserCircle2,
  UserCog,
  Wrench,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export type QuickSearchPage = { label: string; href: string };

type SearchResponse = {
  profiles: Array<{
    id: number;
    profileId: string;
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    department: string;
    departmentAr: string | null;
    jobTitle: string;
    status: string;
    room: { roomNumber: string; buildingName: string | null } | null;
  }>;
  rooms: Array<{
    id: number;
    roomNumber: string;
    status: string;
    capacity: number;
    buildingName: string | null;
    occupants: number;
  }>;
  tickets: Array<{
    id: number;
    ticketNo: string;
    category: string;
    problemType: string;
    description: string;
    status: string;
    roomNumber: string | null;
  }>;
  users: Array<{
    id: number;
    username: string;
    email: string | null;
    roles: string[];
  }>;
};

type Item = {
  key: string;
  group: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  href: string;
};

const TICKET_STATUS: Record<string, { ar: string; en: string }> = {
  open: { ar: "مفتوح", en: "Open" },
  pending: { ar: "قيد الانتظار", en: "Pending" },
  in_progress: { ar: "جاري التنفيذ", en: "In progress" },
  resolved: { ar: "تم الحل", en: "Resolved" },
  closed: { ar: "مغلق", en: "Closed" },
};

export function QuickSearch({
  ar,
  propertyId,
  pages,
  buildNavHref,
}: {
  ar: boolean;
  propertyId: number | null;
  pages: QuickSearchPage[];
  buildNavHref: (path: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q.trim(), 300);
  const [, setLocation] = useLocation();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["/api/search", propertyId, debounced],
    queryFn: () =>
      customFetch<SearchResponse>(
        `/api/search?${new URLSearchParams({
          q: debounced,
          ...(propertyId ? { propertyId: String(propertyId) } : {}),
        })}`,
      ),
    enabled: open && debounced.length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out: Item[] = [];
    const pageHits = term
      ? pages.filter((p) => p.label.toLowerCase().includes(term))
      : pages;
    for (const p of pageHits.slice(0, term ? 5 : 8)) {
      out.push({
        key: `page:${p.href}`,
        group: ar ? "الصفحات" : "Pages",
        icon: FileText,
        title: p.label,
        href: buildNavHref(p.href),
      });
    }
    if (!term || !data || debounced !== q.trim()) return out;

    const people: Item[] = [];
    const places: Item[] = [];
    const tickets: Item[] = [];
    const accounts: Item[] = [];
    for (const p of data.profiles) {
      const nameAr = [p.firstNameAr, p.lastNameAr].filter(Boolean).join(" ");
      const nameEn = `${p.firstName} ${p.lastName}`.trim();
      const room = p.room
        ? `${ar ? "غرفة" : "Room"} ${p.room.roomNumber}`
        : ar
          ? "غير مسكّن"
          : "Not housed";
      people.push({
        key: `profile:${p.id}`,
        group: ar ? "الموظفين" : "Employees",
        icon: UserCircle2,
        title: ar ? nameAr || nameEn : nameEn,
        subtitle: [
          `#${p.profileId}`,
          ar ? p.departmentAr || p.department : p.department,
          room,
        ]
          .filter(Boolean)
          .join(" · "),
        href: buildNavHref(`/profiles/${p.id}`),
      });
    }
    for (const r of data.rooms) {
      places.push({
        key: `room:${r.id}`,
        group: ar ? "الغرف" : "Rooms",
        icon: BedDouble,
        title: `${ar ? "غرفة" : "Room"} ${r.roomNumber}`,
        subtitle: [
          r.buildingName,
          `${r.occupants}/${r.capacity} ${ar ? "مقيم" : "occupied"}`,
        ]
          .filter(Boolean)
          .join(" · "),
        href: buildNavHref(
          `/accommodation/in-house?search=${encodeURIComponent(r.roomNumber)}`,
        ),
      });
    }
    for (const t of data.tickets) {
      const st = TICKET_STATUS[t.status];
      tickets.push({
        key: `ticket:${t.id}`,
        group: ar ? "البلاغات" : "Tickets",
        icon: Wrench,
        title: `${t.ticketNo} · ${t.problemType}`,
        subtitle: [
          t.roomNumber ? `${ar ? "غرفة" : "Room"} ${t.roomNumber}` : null,
          st ? (ar ? st.ar : st.en) : t.status,
          t.description,
        ]
          .filter(Boolean)
          .join(" · "),
        href: buildNavHref(`/maintenance/${t.id}`),
      });
    }
    for (const u of data.users) {
      accounts.push({
        key: `user:${u.id}`,
        group: ar ? "المستخدمين" : "Users",
        icon: UserCog,
        title: u.username,
        subtitle: [u.roles.join(", "), u.email].filter(Boolean).join(" · "),
        href: buildNavHref(`/users/${u.id}`),
      });
    }
    // A number is most likely a room or a ticket; text most likely a name.
    const numeric = /^[#\d\s-]+$|^(mnt|hk|gen)-/i.test(term);
    return out.concat(
      numeric
        ? [...places, ...tickets, ...people, ...accounts]
        : [...people, ...places, ...tickets, ...accounts],
    );
  }, [q, debounced, data, pages, ar, buildNavHref]);

  useEffect(() => setActive(0), [q, items.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    setLocation(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  };

  const searching =
    q.trim().length > 0 && (isFetching || debounced !== q.trim());
  const nothing = q.trim().length > 0 && !searching && items.length === 0;

  let lastGroup = "";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-muted-foreground font-normal px-2 sm:px-3"
        title={ar ? "بحث سريع (Ctrl+K)" : "Quick search (Ctrl+K)"}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline text-xs">
          {ar ? "بحث…" : "Search…"}
        </span>
        <kbd className="hidden md:inline text-[10px] font-mono bg-muted rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 gap-0 max-w-xl overflow-hidden top-[15%] translate-y-0"
          dir={ar ? "rtl" : "ltr"}
        >
          <DialogTitle className="sr-only">
            {ar ? "بحث سريع" : "Quick search"}
          </DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                ar
                  ? "اسم موظف، رقم غرفة، رقم بلاغ (MNT-2026-0012)، صفحة…"
                  : "Employee, room number, ticket (MNT-2026-0012), page…"
              }
              className="h-12 flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {searching && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
            {nothing && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {ar ? "مفيش نتائج" : "No results"}
              </p>
            )}
            {items.map((item, i) => {
              const header = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.key}>
                  {header && (
                    <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-start ${i === active ? "bg-primary/10" : ""}`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {i === active && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="border-t px-4 py-2 text-[11px] text-muted-foreground flex gap-4">
            <span>↑↓ {ar ? "للتنقل" : "to move"}</span>
            <span>Enter {ar ? "للفتح" : "to open"}</span>
            <span>Esc {ar ? "للإغلاق" : "to close"}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
