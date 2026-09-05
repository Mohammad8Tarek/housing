import React from "react";

export function ProfileAvatar({
  firstName,
  lastName,
  size = "sm",
  photoUrl,
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg";
  photoUrl?: string | null;
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "lg" ? "w-24 h-24 text-3xl" : size === "md" ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}
