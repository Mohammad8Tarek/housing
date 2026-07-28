import { TABS } from "../constants";
import { Tab } from "../types";

interface TabsNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  setFilterStatus: (status: string) => void;
  setFilterCategory: (category: string) => void;
  ar: boolean;
}

export function TabsNav({
  activeTab,
  setActiveTab,
  setFilterStatus,
  setFilterCategory,
  ar,
}: TabsNavProps) {
  return (
    <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            setActiveTab(tab.id);
            setFilterStatus("all");
            setFilterCategory("all");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm border"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          }`}
        >
          {tab.icon}
          {ar ? tab.labelAr : tab.label}
        </button>
      ))}
    </div>
  );
}
