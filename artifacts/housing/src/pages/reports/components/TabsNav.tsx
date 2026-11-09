import { useEffect, useMemo, useState } from "react";
import { REPORT_GROUPS, TABS, groupOfTab } from "../constants";
import { Tab } from "../types";

interface TabsNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  setFilterStatus: (status: string) => void;
  setFilterCategory: (category: string) => void;
  ar: boolean;
}

/**
 * Two-level report catalog: business-area groups (teal underline) → reports in
 * that group (pills). Replaces the flat 26-button wrap so users scan 6 areas
 * instead of 26 labels.
 */
export function TabsNav({
  activeTab,
  setActiveTab,
  setFilterStatus,
  setFilterCategory,
  ar,
}: TabsNavProps) {
  const activeGroupId = groupOfTab(activeTab).id;
  const [openGroupId, setOpenGroupId] = useState(activeGroupId);

  useEffect(() => {
    setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  const tabById = useMemo(() => new Map(TABS.map((t) => [t.id, t])), []);
  const openGroup = REPORT_GROUPS.find((g) => g.id === openGroupId) ?? REPORT_GROUPS[0];

  const selectTab = (id: Tab) => {
    setActiveTab(id);
    setFilterStatus("all");
    setFilterCategory("all");
  };

  return (
    <nav
      aria-label={ar ? "فهرس التقارير" : "Report catalog"}
      className="rounded-xl border bg-card overflow-hidden"
    >
      {/* Level 1 — business areas */}
      <div
        role="tablist"
        className="flex overflow-x-auto border-b scrollbar-none"
      >
        {REPORT_GROUPS.map((g) => {
          const open = g.id === openGroupId;
          const containsActive = g.id === activeGroupId;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={open}
              onClick={() => setOpenGroupId(g.id)}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                open
                  ? "text-[#1F7F81] dark:text-[#59B7A8]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {ar ? g.labelAr : g.label}
                <span
                  className={`text-[10px] tabular-nums rounded-full px-1.5 leading-4 ${
                    open
                      ? "bg-[#2AA8AB]/15 text-[#1F7F81] dark:text-[#59B7A8]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {g.tabs.length}
                </span>
                {containsActive && !open && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2AA8AB]" aria-hidden />
                )}
              </span>
              <span
                className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-colors ${
                  open ? "bg-[#2AA8AB]" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Level 2 — reports in the open area */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30">
        {openGroup.tabs.map((id) => {
          const tab = tabById.get(id);
          if (!tab) return null;
          const active = id === activeTab;
          return (
            <button
              key={id}
              onClick={() => selectTab(id)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all [&_svg]:!text-current [&_svg]:shrink-0 ${
                active
                  ? "bg-[#2AA8AB] border-[#2AA8AB] text-white shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:text-[#1F7F81] hover:border-[#2AA8AB]/50 dark:hover:text-[#59B7A8]"
              }`}
            >
              {tab.icon}
              {ar ? tab.labelAr : tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
