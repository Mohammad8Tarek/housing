export type FloorConfig = {
  floorNumber: string;
  roomsCount: number;
  roomType: string;
  roomCapacity: number;
  roomStartNumber: number;
  genderPolicy: string;
};

export const statusNorm = (s: string) => s?.toLowerCase() || "";

export const roomStatusBadge = (status: string) => {
  switch (statusNorm(status)) {
    case "available":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "occupied":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "maintenance":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "reserved":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
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
