/**
 * Shared portal category/status catalog for admin + profile portals.
 * Custom entries are kept in memory per property until a DB table exists.
 */

export type PortalCategory = {
  id: number;
  key: string;
  name: string;
  nameAr: string;
  color: string;
  icon: string;
  contentTypes: ("activities" | "evaluations" | "documents")[];
};

export type PortalActivityStatus = {
  key: string;
  name: string;
  nameAr: string;
};

const DEFAULT_ACTIVITY_CATEGORIES: PortalCategory[] = [
  {
    id: 1,
    key: "social",
    name: "Social",
    nameAr: "اجتماعي",
    color: "#3B82F6",
    icon: "users",
    contentTypes: ["activities"],
  },
  {
    id: 2,
    key: "sports",
    name: "Sports",
    nameAr: "رياضي",
    color: "#EF4444",
    icon: "trophy",
    contentTypes: ["activities"],
  },
  {
    id: 3,
    key: "training",
    name: "Training",
    nameAr: "تدريبي",
    color: "#8B5CF6",
    icon: "book",
    contentTypes: ["activities", "documents"],
  },
  {
    id: 4,
    key: "welfare",
    name: "Wellness",
    nameAr: "رفاهية",
    color: "#10B981",
    icon: "heart",
    contentTypes: ["activities"],
  },
];

const DEFAULT_EVALUATION_CATEGORIES: PortalCategory[] = [
  {
    id: 10,
    key: "general",
    name: "General",
    nameAr: "عام",
    color: "#6B7280",
    icon: "inbox",
    contentTypes: ["evaluations"],
  },
  {
    id: 11,
    key: "performance",
    name: "Performance",
    nameAr: "الأداء",
    color: "#F59E0B",
    icon: "target",
    contentTypes: ["evaluations"],
  },
  {
    id: 12,
    key: "behavior",
    name: "Behavior",
    nameAr: "السلوك",
    color: "#10B981",
    icon: "user-check",
    contentTypes: ["evaluations"],
  },
  {
    id: 13,
    key: "attendance",
    name: "Attendance",
    nameAr: "الحضور",
    color: "#3B82F6",
    icon: "calendar",
    contentTypes: ["evaluations"],
  },
];

export const DEFAULT_ACTIVITY_STATUSES: PortalActivityStatus[] = [
  { key: "planned", name: "Planned", nameAr: "مخطط" },
  { key: "ongoing", name: "Ongoing", nameAr: "جاري" },
  { key: "completed", name: "Completed", nameAr: "مكتمل" },
  { key: "cancelled", name: "Cancelled", nameAr: "ملغي" },
];

const customByProperty = new Map<number, PortalCategory[]>();
let nextCustomId = 1000;

function mergeCategories(propertyId: number): PortalCategory[] {
  const custom = customByProperty.get(propertyId) ?? [];
  const keys = new Set<string>();
  const merged: PortalCategory[] = [];
  for (const c of [
    ...DEFAULT_ACTIVITY_CATEGORIES,
    ...DEFAULT_EVALUATION_CATEGORIES,
    ...custom,
  ]) {
    if (keys.has(c.key)) continue;
    keys.add(c.key);
    merged.push(c);
  }
  return merged;
}

export function getPortalCategories(
  propertyId: number,
  contentType?: string,
): PortalCategory[] {
  const all = mergeCategories(propertyId);
  if (!contentType) return all;
  return all.filter((c) => c.contentTypes.includes(contentType as any));
}

export function getActivityStatuses(): PortalActivityStatus[] {
  return DEFAULT_ACTIVITY_STATUSES;
}

export function addPortalCategory(
  propertyId: number,
  data: {
    key?: string;
    name: string;
    nameAr: string;
    color: string;
    icon?: string;
    contentTypes?: PortalCategory["contentTypes"];
  },
): PortalCategory {
  const key =
    data.key || data.name.toLowerCase().replace(/\s+/g, "_").slice(0, 40);
  const category: PortalCategory = {
    id: nextCustomId++,
    key,
    name: data.name,
    nameAr: data.nameAr,
    color: data.color,
    icon: data.icon ?? "folder",
    contentTypes: data.contentTypes ?? ["activities"],
  };
  const list = customByProperty.get(propertyId) ?? [];
  list.push(category);
  customByProperty.set(propertyId, list);
  return category;
}

export function getCategoryLabel(key: string, ar = false): string {
  const all = [
    ...DEFAULT_ACTIVITY_CATEGORIES,
    ...DEFAULT_EVALUATION_CATEGORIES,
  ];
  const found = all.find((c) => c.key === key);
  if (!found) return key;
  return ar ? found.nameAr : found.name;
}
