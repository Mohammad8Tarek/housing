// Module-level constants/types of ProfileDetail (moved verbatim).

export function ProfileAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "lg",
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "lg" ? "w-24 h-24 text-3xl" : "w-12 h-12 text-base";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border-4 border-background shadow-lg flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}

export const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ENDED: "bg-gray-100 text-gray-700",
    TRANSFERRED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    CHECKED_OUT: "bg-orange-100 text-orange-700",
    CANCELLED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
};
