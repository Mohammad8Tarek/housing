export type FloorConfig = {
  floorNumber: string;
  roomsCount: number;
  roomType: string;
  roomCapacity: number;
  roomStartNumber: number;
  genderPolicy: string;
};

export const statusNorm = (s: string) => s?.toLowerCase().trim() || "";

export const ROOM_STATUS_OPTIONS = [
  { value: "available", labelAr: "شاغرة (جاهزة)", labelEn: "Vacant Clean", shortAr: "شاغرة", color: "emerald", dot: "bg-emerald-500" },
  { value: "dirty", labelAr: "تحتاج تنظيف", labelEn: "Vacant Dirty", shortAr: "تحتاج تنظيف", color: "orange", dot: "bg-orange-500" },
  { value: "occupied", labelAr: "مشغولة", labelEn: "Occupied Clean", shortAr: "مشغولة", color: "blue", dot: "bg-blue-500" },
  { value: "occupied_dirty", labelAr: "مشغولة تحتاج تنظيف", labelEn: "Occupied Dirty", shortAr: "مشغولة متسخة", color: "purple", dot: "bg-purple-500" },
  { value: "occupied_vacation", labelAr: "مشغولة - إجازة", labelEn: "Occupied (Vacation)", shortAr: "مشغولة - إجازة", color: "amber", dot: "bg-amber-500" },
  { value: "out_of_service", labelAr: "صيانة مؤقتة", labelEn: "Out of Service", shortAr: "صيانة مؤقتة", color: "slate", dot: "bg-slate-500" },
  { value: "out_of_order", labelAr: "خارج الخدمة", labelEn: "Out of Order", shortAr: "خارج الخدمة", color: "red", dot: "bg-red-500" },
] as const;

export const getRoomStatusLabel = (status: string, ar = true): string => {
  const s = statusNorm(status);
  switch (s) {
    case "available":
    case "vacant":
      return ar ? "شاغرة" : "Vacant";
    case "dirty":
    case "vacant_dirty":
      return ar ? "تحتاج تنظيف" : "Dirty";
    case "occupied":
    case "occupied_clean":
      return ar ? "مشغولة" : "Occupied";
    case "occupied_dirty":
      return ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty";
    case "occupied_vacation":
      return ar ? "مشغولة - إجازة" : "Occupied (Vacation)";
    case "out_of_service":
    case "maintenance":
    case "oos":
      return ar ? "صيانة مؤقتة" : "Out of Service";
    case "out_of_order":
    case "ooo":
      return ar ? "خارج الخدمة" : "Out of Order";
    case "reserved":
      return ar ? "محجوزة" : "Reserved";
    default:
      return status || (ar ? "شاغرة" : "Vacant");
  }
};

export const roomStatusBadge = (status: string) => {
  switch (statusNorm(status)) {
    case "available":
    case "vacant":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800";
    case "dirty":
    case "vacant_dirty":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300 dark:border-orange-800";
    case "occupied":
    case "occupied_clean":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800";
    case "occupied_dirty":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800";
    case "occupied_vacation":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-400 dark:border-amber-700 font-bold";
    case "out_of_service":
    case "maintenance":
    case "oos":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold";
    case "out_of_order":
    case "ooo":
      return "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 font-bold";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300";
  }
};

export const buildingStatusBadge = (status: string) => {
  return statusNorm(status) === "active"
    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
};

export function makeDefaultFloor(
  index: number,
  prevFloor?: FloorConfig,
): FloorConfig {
  return {
    floorNumber: String(index + 1),
    roomsCount: prevFloor?.roomsCount ?? 10,
    roomType: prevFloor?.roomType ?? "Standard",
    roomCapacity: prevFloor?.roomCapacity ?? 2,
    roomStartNumber: prevFloor
      ? prevFloor.roomStartNumber + prevFloor.roomsCount
      : (index + 1) * 100 + 1,
    genderPolicy: prevFloor?.genderPolicy ?? "",
  };
}
