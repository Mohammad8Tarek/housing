// @ts-nocheck
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useListAssignments,
  useListRooms,
  useListBuildings,
  useListFloors,
  useListProfiles,
  useListHostings,
} from "@workspace/api-client-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatNationality } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2,
  BedDouble,
  Calendar,
  Phone,
  Shield,
  Globe2,
  User,
  Users,
  Home,
  History,
  Briefcase,
  ExternalLink,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { formatDate } from "@/lib/date-utils";
import { Link } from "wouter";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface ProfileProfilePopupProps {
  profileId: number | null;
  propertyId: number | undefined;
  onClose: () => void;
}

export function ProfileProfilePopup({
  profileId,
  propertyId,
  onClose,
}: ProfileProfilePopupProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [companionCache, setCompanionCache] = useState<Record<number, any[]>>(
    {},
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string | undefined>(
    undefined,
  );

  const propId = propertyId && (propertyId as any) !== "all" ? Number(propertyId) : undefined;
  const { data: profile, isLoading: empLoading } = useQuery({
    queryKey: ["popup-profile", profileId, propId],
    queryFn: async () => {
      const url = propId ? `/api/profiles/${profileId}?propertyId=${propId}` : `/api/profiles/${profileId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!profileId,
  });

  const effectivePropId = (profile?.propertyId || propId) as number | undefined;

  const { data: _aData } = useListAssignments({ propertyId: effectivePropId } as any, {
    query: { enabled: !!effectivePropId },
  });
  const assignments: any[] = Array.isArray(_aData) ? _aData : (_aData?.data || []);

  const { data: _empAssignments } = useListAssignments({ propertyId: effectivePropId, profileId: Number(profileId) } as any, {
    query: { enabled: !!profileId && !!effectivePropId },
  });

  const { data: _rData } = useListRooms(
    { propertyId: effectivePropId, limit: 1000 },
    { query: { enabled: !!effectivePropId } },
  );
  const rooms = Array.isArray(_rData) ? _rData : (_rData?.data || []);
  const { data: _bData } = useListBuildings(
    { propertyId: effectivePropId },
    { query: { enabled: !!effectivePropId } },
  );
  const buildings = Array.isArray(_bData) ? _bData : (_bData?.data || []);
  const { data: _fData } = useListFloors(
    { propertyId: effectivePropId },
    { query: { enabled: !!effectivePropId } },
  );
  const floors = Array.isArray(_fData) ? _fData : (_fData?.data || []);
  const { data: _eData, isLoading: profilesLoading } = useListProfiles(
    { propertyId: effectivePropId },
    { query: { enabled: !!effectivePropId } },
  );
  const profiles = Array.isArray(_eData) ? _eData : (_eData?.data || []);
  const { data: _hData } = useListHostings(
    { propertyId: effectivePropId } as any,
    { query: { enabled: !!effectivePropId } },
  );
  const hostings = Array.isArray(_hData) ? _hData : (_hData?.data || []);

  const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r]));
  const buildingMap = Object.fromEntries(buildings.map((b: any) => [b.id, b.name]));
  const floorMap = Object.fromEntries(floors.map((f: any) => [f.id, f.floorNumber]));
  const empMap = Object.fromEntries(profiles.map((e: any) => [e.id, e]));

  const rawEmpAss = Array.isArray(_empAssignments)
    ? _empAssignments
    : ((_empAssignments as any)?.data || []);
  const profileAssignments = rawEmpAss.length > 0
    ? rawEmpAss
    : assignments.filter((a) => Number(a.profileId) === Number(profileId));

  const currentAssignment =
    profileAssignments.find((a) => a.status === "ACTIVE" && !a.checkOutDate) ||
    profileAssignments.find((a) => a.status === "ACTIVE");

  const pastAssignments = profileAssignments
    .filter((a) => a.id !== currentAssignment?.id)
    .sort(
      (a, b) =>
        new Date(b.checkInDate || b.createdAt || 0).getTime() -
        new Date(a.checkInDate || a.createdAt || 0).getTime(),
    );

  const activeAssignments = assignments.filter(
    (a) => a.status === "ACTIVE" && !a.checkOutDate,
  );
  const roommates = currentAssignment
    ? activeAssignments.filter(
        (a) =>
          a.roomId === currentAssignment.roomId &&
          Number(a.profileId) !== Number(profileId),
      )
    : [];

  const emp = (profile as any) ?? empMap[profileId as number];
  const room = currentAssignment ? roomMap[currentAssignment.roomId] : null;
  const building = room ? buildingMap[room.buildingId] : null;
  const floorNum = room ? floorMap[room.floorId] : null;
  const daysStayed = currentAssignment
    ? differenceInDays(new Date(), new Date(currentAssignment.checkInDate))
    : null;
  const profileHostings = (hostings as any[])
    .filter((h) => h.profileId === profileId)
    .sort(
      (a, b) =>
        new Date(b.expectedFrom ?? b.createdAt ?? 0).getTime() -
        new Date(a.expectedFrom ?? a.createdAt ?? 0).getTime(),
    );
  useEffect(() => {
    if (!propertyId || !profileHostings.length) return;
    const missing = profileHostings.filter(
      (h) =>
        Number(h.guestsCount ?? 0) > 0 &&
        (!Array.isArray(h.companions) || h.companions.length === 0) &&
        companionCache[h.id] === undefined,
    );
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (h) => {
        try {
          const resp = await fetch(
            `/api/hostings/${h.id}/companions?propertyId=${propertyId}`,
          );
          if (!resp.ok) return [h.id, []] as const;
          const list = await resp.json();
          return [h.id, Array.isArray(list) ? list : []] as const;
        } catch {
          return [h.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCompanionCache((prev) => {
        const next = { ...prev };
        entries.forEach(([id, list]) => {
          next[id] = list;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [propertyId, profileHostings, companionCache]);

  const getHostingGuests = (hosting: any) =>
    Array.isArray(hosting.companions) && hosting.companions.length > 0
      ? hosting.companions
      : (companionCache[hosting.id] ?? []);

  const hostingRoomLabel = (hosting: any) => {
    const hostingRoom =
      hosting.room ?? (hosting.roomId ? roomMap[hosting.roomId] : null);
    return (
      hostingRoom?.roomNumber ?? (hosting.roomId ? `#${hosting.roomId}` : "—")
    );
  };
  const guestLabel = (guest: any) => {
    const parts = [
      Number(guest.isChild) === 1
        ? ar
          ? "طفل"
          : "Child"
        : ar
          ? "بالغ"
          : "Adult",
      guest.relation,
      guest.age != null ? `${guest.age}${ar ? " سنة" : "y"}` : "",
    ].filter(Boolean);
    return parts.join(" • ");
  };

  return (
    <>
      <Dialog
        open={!!profileId}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {ar ? "بطاقة الموظف" : "Profile Profile"}
            </DialogTitle>
          </DialogHeader>

          {empLoading || profilesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : emp ? (
            <div className="space-y-4">
              {/* Photo + Name */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-transparent">
                {emp.photoUrl ? (
                  <img
                    src={emp.photoUrl}
                    className="w-16 h-16 rounded-full object-cover border-2 border-background shadow-md flex-shrink-0"
                    alt=""
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center border-2 border-background shadow-md flex-shrink-0">
                    <span className="text-2xl font-bold text-primary">
                      {emp.firstName?.[0]}
                      {emp.lastName?.[0]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold">
                    {emp.firstName} {emp.lastName}
                  </h3>
                  <p className="text-sm font-mono text-muted-foreground">
                    {emp.profileId || emp.profileCode}
                  </p>
                  {emp.jobTitle && (
                    <p className="text-sm text-primary font-medium mt-0.5">
                      {emp.jobTitle}
                      {emp.department ? ` • ${emp.department}` : ""}
                    </p>
                  )}
                  <Badge
                    variant="outline"
                    className={`mt-1 text-xs font-semibold px-2.5 py-0.5 border ${
                      emp.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : emp.status === "VACATION"
                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {emp.status === "ACTIVE"
                      ? (ar ? "مقيم بالسكن" : "In-House")
                      : emp.status === "VACATION"
                      ? (ar ? "في إجازة" : "Vacation")
                      : emp.status === "LEFT"
                      ? (ar ? "مغادر" : "Check-out")
                      : emp.status}
                  </Badge>
                </div>
                <Link href={`/profiles/${emp.id}`} onClick={onClose}>
                  <Button size="sm" variant="outline" className="shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-2">
                {emp.nationalId && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "رقم الهوية" : "National ID"}
                      </p>
                      <p className="text-sm font-mono truncate">
                        {emp.nationalId}
                      </p>
                    </div>
                  </div>
                )}
                {(emp.phone || emp.phoneNumber) && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الهاتف" : "Phone"}
                      </p>
                      <p className="text-sm">{emp.phone || emp.phoneNumber}</p>
                    </div>
                  </div>
                )}
                {emp.nationality && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Globe2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الجنسية" : "Nationality"}
                      </p>
                      <p className="text-sm">{formatNationality(emp.nationality, ar)}</p>
                    </div>
                  </div>
                )}
                {emp.gender && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الجنس" : "Gender"}
                      </p>
                      <p className="text-sm">
                        {emp.gender === "M"
                          ? ar
                            ? "ذكر"
                            : "Male"
                          : emp.gender === "F"
                            ? ar
                              ? "أنثى"
                              : "Female"
                            : emp.gender}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Housing */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  {ar ? "السكن الحالي" : "Current Housing"}
                </p>
                {currentAssignment ? (
                  (() => {
                    const roomNum = room?.roomNumber ?? currentAssignment.roomNumber ?? currentAssignment.roomId;
                    const bldName = building ?? currentAssignment.buildingName;
                    const flr = floorNum ?? currentAssignment.floorNumber;
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {bldName && (
                          <div className="flex gap-1.5 items-center text-sm">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{bldName}</span>
                          </div>
                        )}
                        {flr != null && (
                          <div className="text-sm text-muted-foreground">
                            {ar ? "الطابق" : "Floor"} {flr}
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <span className="font-mono font-bold text-primary text-base">
                            {roomNum}
                          </span>
                          {currentAssignment.bedNumber && (
                            <Badge variant="outline" className="text-xs">
                              <BedDouble className="w-3 h-3 mr-1" />
                              {ar ? "سرير" : "Bed"} {currentAssignment.bedNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {formatDate(currentAssignment.checkInDate)}
                          {daysStayed !== null && (
                            <span className="ml-1 text-xs">
                              ({daysStayed}
                              {ar ? "د" : "d"})
                            </span>
                          )}
                        </div>
                        {currentAssignment.expectedCheckOutDate && (
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {ar ? "مغادرة متوقعة:" : "Expected out:"}{" "}
                            {formatDate(currentAssignment.expectedCheckOutDate)}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    <Home className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    {ar
                      ? "لا يوجد تسكين نشط حالياً"
                      : "No active housing assignment"}
                  </div>
                )}
              </div>

              {/* Housing History in popup */}
              {pastAssignments.length > 0 && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    {ar ? "سجل الإقامة السابق" : "Housing History"} ({pastAssignments.length})
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pastAssignments.map((pa: any) => {
                      const pRoom = roomMap[pa.roomId];
                      const pRoomNum = pRoom?.roomNumber ?? pa.roomNumber ?? pa.roomId;
                      const pBld = pRoom ? buildingMap[pRoom.buildingId] : (pa.buildingName ?? null);
                      return (
                        <div key={pa.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-primary">🚪 {pRoomNum}</span>
                            {pBld && <span className="text-muted-foreground">• {pBld}</span>}
                            {pa.bedNumber && <span className="text-muted-foreground/80">({ar ? "سرير" : "Bed"} {pa.bedNumber})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {formatDate(pa.checkInDate)} ➔ {formatDate(pa.checkOutDate || pa.actualCheckOutDate)}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {pa.status === "CHECKED_OUT"
                                ? (ar ? "مغادرة" : "Out")
                                : pa.status === "TRANSFERRED"
                                ? (ar ? "نقل" : "Moved")
                                : pa.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guest Hosting */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {ar ? "ضيوف الموظف" : "Guest Hosting"} (
                  {profileHostings.length})
                </p>
                {profileHostings.length > 0 ? (
                  <div className="space-y-2">
                    {profileHostings.map((hosting: any) => {
                      const guests = getHostingGuests(hosting);
                      return (
                        <div
                          key={hosting.id}
                          className="rounded-lg bg-muted/30 p-2.5 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                {hosting.hostingType?.replace("_", " ") ||
                                  (ar ? "استضافة" : "Hosting")}
                                <span className="text-muted-foreground font-normal">
                                  {" "}
                                  • {ar ? "الغرفة" : "Room"}{" "}
                                  {hostingRoomLabel(hosting)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(hosting.expectedFrom)}
                                {" - "}
                                {formatDate(hosting.expectedTo)}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {hosting.status}
                            </Badge>
                          </div>

                          {guests.length > 0 ? (
                            <div className="space-y-1.5">
                              {guests.map((guest: any) => (
                                <div
                                  key={
                                    guest.id ?? `${hosting.id}-${guest.name}`
                                  }
                                  className="flex items-center gap-2 rounded-md bg-background/70 p-2"
                                >
                                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {guest.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {guestLabel(guest) ||
                                        (ar ? "بيانات الضيف" : "Guest details")}
                                      {guest.idNumber
                                        ? ` • ${guest.idNumber}`
                                        : ""}
                                    </p>
                                  </div>
                                  {guest.documentImage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLightboxSrc(guest.documentImage);
                                        setLightboxName(guest.documentFileName);
                                      }}
                                      className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border bg-background text-primary hover:bg-muted hover:border-primary transition-colors overflow-hidden"
                                      title={
                                        guest.documentFileName ||
                                        (ar ? "عرض المستند" : "View document")
                                      }
                                    >
                                      {guest.documentImage.startsWith(
                                        "data:image/",
                                      ) ||
                                      /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                        guest.documentImage,
                                      ) ? (
                                        <img
                                          src={guest.documentImage}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <ImageIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-md bg-background/70 p-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              {ar
                                ? "لا توجد بيانات ضيوف مسجلة"
                                : "No guest details recorded"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    {ar
                      ? "لا توجد استضافات ضيوف لهذا الموظف"
                      : "No guest hostings for this profile"}
                  </div>
                )}
              </div>

              {/* Roommates */}
              {roommates.length > 0 && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {ar ? "زملاء الغرفة" : "Roommates"} ({roommates.length})
                  </p>
                  <div className="space-y-1.5">
                    {roommates.map((rm: any) => {
                      const rmEmp = empMap[rm.profileId] as any;
                      return (
                        <div
                          key={rm.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          {rmEmp?.photoUrl ? (
                            <img
                              src={rmEmp.photoUrl}
                              className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
                              alt=""
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {rmEmp
                                  ? `${rmEmp.firstName?.[0] ?? ""}${rmEmp.lastName?.[0] ?? ""}`
                                  : "?"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">
                              {rmEmp
                                ? `${rmEmp.firstName} ${rmEmp.lastName}`
                                : `#${rm.profileId}`}
                            </p>
                            {rmEmp && (
                              <p className="text-xs text-muted-foreground truncate">
                                {rmEmp.jobTitle || rmEmp.department || ""}
                              </p>
                            )}
                          </div>
                          {rm.bedNumber && (
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              <BedDouble className="w-3 h-3 mr-1" />
                              {rm.bedNumber}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              {ar ? "الموظف غير موجود" : "Profile not found"}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <ImageLightbox
        src={lightboxSrc}
        fileName={lightboxName}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  );
}
