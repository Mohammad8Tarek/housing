export function EmpAvatar({ emp, name, photoUrl }: { emp?: any; name?: string; photoUrl?: string }) {
  const photo = photoUrl || emp?.photoUrl;
  const firstName = emp?.firstName || name?.split(" ")?.[0] || "";
  const lastName = emp?.lastName || name?.split(" ")?.slice(1)?.join(" ") || "";
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "—";
  return photo ? (
    <img
      src={photo}
      alt={initials}
      className="w-9 h-9 rounded-full object-cover border border-border shadow-xs flex-shrink-0"
    />
  ) : (
    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">{initials}</span>
    </div>
  );
}
