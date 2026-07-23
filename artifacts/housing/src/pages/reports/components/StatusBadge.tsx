import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const map: Record<string, string> = {
    available: "bg-green-100 text-green-800 border-green-200",
    occupied: "bg-blue-100 text-blue-800 border-blue-200",
    maintenance: "bg-orange-100 text-orange-800 border-orange-200",
    active: "bg-green-100 text-green-800 border-green-200",
    inactive: "bg-gray-100 text-gray-800 border-gray-200",
    vacation: "bg-purple-100 text-purple-800 border-purple-200",
    terminated: "bg-red-100 text-red-800 border-red-200",
    open: "bg-red-100 text-red-800 border-red-200",
    in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
    resolved: "bg-green-100 text-green-800 border-green-200",
    closed: "bg-gray-100 text-gray-800 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <Badge
      variant="outline"
      className={`capitalize whitespace-nowrap ${map[s] || "bg-gray-100 text-gray-800 border-gray-200"}`}
    >
      {status?.replace(/_/g, " ")}
    </Badge>
  );
}
