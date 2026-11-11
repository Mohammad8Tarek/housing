import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  LogOut,
  ArrowRightLeft,
  BedDouble,
  Building2,
  CheckCircle,
  Palmtree,
  Key,
  Printer,
  UserCheck,
  CalendarPlus,
  Globe,
  Layers,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { formatDate } from "@/lib/date-utils";
import { formatNationality } from "@/lib/countries";
import {
  getProfileDisplayName,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { EmpAvatar } from "./EmpAvatar";
import { buildProfileObj, type LookupMaps } from "../utils/profile-helpers";

export type RowActions = {
  onOpenProfile: (profileId: number) => void;
  onExtend: (assignment: any, emp: any, room: any) => void;
  onReissueKey: (assignment: any, emp: any, room: any) => void;
  onPrintLetter: (assignment: any, profileObj: any) => void;
  onGatePass: (profileId: number) => void;
  onReturnFromVacation: (emp: any) => void;
  onSetVacation: (emp: any, room: any) => void;
  onWhatsApp: (assignment: any, emp: any) => void;
  onCheckout: (assignment: any, emp: any) => void;
  onTransfer: (assignment: any, emp: any) => void;
};

type Props = LookupMaps & {
  a: any;
  ar: boolean;
  isSelected: boolean;
  onToggleRow: (id: number) => void;
  isIHVisible: (key: string) => boolean;
  actions: RowActions;
};

export function InHouseTableRow({
  a,
  ar,
  isSelected,
  onToggleRow: toggleRow,
  isIHVisible,
  empMap,
  roomMap,
  buildingMap,
  floorMap,
  actions,
}: Props) {
  const emp = empMap[a.profileId];
  const room = roomMap[a.roomId];
  const building =
    a.buildingName || (room ? buildingMap[room.buildingId] : null);
  const floorNum =
    a.floorNumber ?? (room ? floorMap[room.floorId]?.number : null);
  const roomNum =
    a.roomNumber || room?.roomNumber || (a.roomId ? `#${a.roomId}` : "—");
  const roomType = a.roomType || room?.roomType;

  const profileObj = buildProfileObj(a, emp);

  const fullName =
    getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
  const profileCode =
    a.profileCode || emp?.profileId || (a.profileId ? String(a.profileId) : "");
  const department = getProfileDisplayDepartment(profileObj, ar);
  const nationality = a.profileNationality || (emp as any)?.nationality;
  const photoUrl = a.profilePhotoUrl || emp?.photoUrl;

  const daysStayed = a.checkInDate
    ? differenceInDays(new Date(), new Date(a.checkInDate))
    : 0;
  const daysRemaining = a.expectedCheckOutDate
    ? differenceInDays(new Date(a.expectedCheckOutDate), new Date())
    : null;
  const isAlert =
    daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isEntire = Boolean(
    a.isEntireRoom ||
    (a as any).is_entire_room ||
    a.notes?.includes("[حجز الغرفة بالكامل]") ||
    a.notes?.includes("[تسكين الغرفة بالكامل]"),
  );
  const displayBed = a.bedNumber ?? (isEntire ? 1 : null);

  return (
    <TableRow
      className={`${isSelected ? "bg-primary/5" : isOverdue ? "bg-red-50/60 dark:bg-red-950/20" : isAlert ? "bg-amber-50/60 dark:bg-amber-950/20" : "hover:bg-muted/20"} transition-colors`}
    >
      <TableCell className="px-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleRow(a.id)}
        />
      </TableCell>

      {/* Column 1: Resident / Employee */}
      {isIHVisible("profile") && (
        <TableCell className="py-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => a.profileId && actions.onOpenProfile(a.profileId)}
              className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
              title={ar ? "عرض ملف المقيم" : "View profile"}
            >
              <EmpAvatar emp={emp} name={fullName} photoUrl={photoUrl} />
            </button>
            <div className="flex flex-col min-w-0">
              <button
                type="button"
                onClick={() =>
                  a.profileId && actions.onOpenProfile(a.profileId)
                }
                className="font-semibold text-foreground text-sm leading-tight text-left rtl:text-right hover:text-primary hover:underline transition-colors truncate"
              >
                {fullName}
              </button>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                {profileCode && (
                  <span className="font-mono text-[11px] text-muted-foreground font-medium">
                    #{profileCode}
                  </span>
                )}
                {department && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[11px]">{department}</span>
                  </>
                )}
                {nationality && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[11px] flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5 text-muted-foreground/60" />
                      {formatNationality(nationality, ar, false)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </TableCell>
      )}

      {/* Column 2: Building & Floor */}
      {isIHVisible("building") && (
        <TableCell className="py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary/70" />
              {building || "—"}
            </span>
            {floorNum != null && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Layers className="w-3 h-3 text-muted-foreground/60" />
                {ar ? `الدور ${floorNum}` : `Floor ${floorNum}`}
              </span>
            )}
          </div>
        </TableCell>
      )}

      {/* Column 3: Room & Bed */}
      {isIHVisible("room") && (
        <TableCell className="py-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-primary text-base">
                {roomNum}
              </span>
              {displayBed ? (
                <Badge
                  variant="secondary"
                  className="text-xs font-semibold px-1.5 py-0"
                >
                  <BedDouble className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
                  {ar ? `سرير ${displayBed}` : `Bed ${displayBed}`}
                </Badge>
              ) : null}
              {isEntire && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 text-[11px] px-1.5 py-0 font-medium"
                >
                  {ar ? "غرفة كاملة" : "Entire"}
                </Badge>
              )}
            </div>
            {roomType && (
              <span className="text-[11px] text-muted-foreground capitalize">
                {roomType}
              </span>
            )}
          </div>
        </TableCell>
      )}

      {/* Column 4: Check-in Date */}
      {isIHVisible("checkin") && (
        <TableCell className="py-3 whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {formatDate(a.checkInDate)}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {ar ? `منذ ${daysStayed} يوم` : `${daysStayed}d ago`}
            </span>
          </div>
        </TableCell>
      )}

      {/* Column 5: Expected Check-out */}
      {isIHVisible("expected") && (
        <TableCell className="py-3 whitespace-nowrap">
          {a.expectedCheckOutDate ? (
            <div className="flex flex-col">
              <span
                className={
                  isOverdue
                    ? "text-sm font-semibold text-red-600"
                    : isAlert
                      ? "text-sm font-semibold text-amber-600"
                      : "text-sm font-medium text-foreground"
                }
              >
                {formatDate(a.expectedCheckOutDate)}
              </span>
              {isOverdue && (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0 font-bold w-fit mt-0.5"
                >
                  {ar ? "متأخر" : "Overdue"}
                </Badge>
              )}
              {isAlert && !isOverdue && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-bold border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 w-fit mt-0.5"
                >
                  {daysRemaining} {ar ? "يوم متبقي" : "d left"}
                </Badge>
              )}
              {!isOverdue && !isAlert && daysRemaining !== null && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {ar ? `متبقي ${daysRemaining} يوم` : `${daysRemaining}d left`}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      )}

      {/* Column 6: Status */}
      {isIHVisible("personStatus") && (
        <TableCell className="py-3">
          {(() => {
            const pStatus = (
              (a as any).profileStatus ||
              emp?.status ||
              ""
            ).toUpperCase();
            const isVacation = pStatus === "VACATION";
            const isCheckedOut =
              a.status === "CHECKED_OUT" ||
              a.status === "LEFT" ||
              pStatus === "LEFT" ||
              pStatus === "CHECKED_OUT";

            if (isCheckedOut) {
              return (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1 font-medium whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" />
                  {ar ? "مغادر" : "Checked Out"}
                </Badge>
              );
            }

            if (isVacation) {
              const returnDate =
                (a as any).vacationEndDate || emp?.vacationEndDate;
              return (
                <div className="flex flex-col gap-0.5 items-start">
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-semibold gap-1 whitespace-nowrap"
                  >
                    <Palmtree className="w-3 h-3 text-amber-600" />
                    {ar ? "في إجازة" : "On Vacation"}
                  </Badge>
                  {returnDate && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {ar
                        ? `عودة: ${formatDate(returnDate)}`
                        : `Return: ${formatDate(returnDate)}`}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-semibold gap-1 whitespace-nowrap"
              >
                <UserCheck className="w-3 h-3 text-emerald-600" />
                {ar ? "مقيم بالسكن" : "In-House"}
              </Badge>
            );
          })()}
        </TableCell>
      )}

      {/* Column 5: Actions */}
      {isIHVisible("actions") && (
        <TableCell className="py-2.5 text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1"
              >
                <ArrowRightLeft className="w-3 h-3 rtl:ml-1 rtl:mr-0" />
                {ar ? "إجراءات" : "Actions"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <PermissionGate module="accommodation" action="edit">
                <DropdownMenuItem
                  onClick={() =>
                    actions.onExtend(
                      a,
                      emp || {
                        id: a.profileId,
                        firstName: a.profileFirstName,
                        lastName: a.profileLastName,
                      },
                      room || { id: a.roomId, roomNumber: a.roomNumber },
                    )
                  }
                  className="text-primary font-medium"
                >
                  <CalendarPlus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-primary" />
                  {ar ? "تمديد الإقامة" : "Extend Stay"}
                </DropdownMenuItem>
              </PermissionGate>
              <PermissionGate module="accommodation" action="edit">
                <DropdownMenuItem
                  onClick={() => {
                    actions.onReissueKey(
                      a,
                      emp || {
                        id: a.profileId,
                        firstName: a.profileFirstName,
                        lastName: a.profileLastName,
                      },
                      room || { id: a.roomId, roomNumber: a.roomNumber },
                    );
                  }}
                >
                  <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {ar ? "إعادة إصدار مفتاح" : "Re-issue Key"}
                </DropdownMenuItem>
              </PermissionGate>
              <PermissionGate module="accommodation" action="export">
                <DropdownMenuItem
                  onClick={() => actions.onPrintLetter(a, profileObj)}
                >
                  <Printer className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
                </DropdownMenuItem>
              </PermissionGate>
              <DropdownMenuItem
                onClick={() => {
                  actions.onGatePass(a.profileId);
                }}
                className="font-medium text-emerald-600 dark:text-emerald-400"
              >
                <QrCode className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600 dark:text-emerald-400" />
                {ar ? "تصريح السكن (Gate Pass)" : "Gate QR Pass"}
              </DropdownMenuItem>
              <PermissionGate module="accommodation" action="edit">
                <DropdownMenuItem
                  onClick={() => {
                    if (
                      emp?.status === "VACATION" ||
                      (a as any).profileStatus === "VACATION"
                    ) {
                      actions.onReturnFromVacation(
                        emp || {
                          id: a.profileId,
                          firstName: a.profileFirstName,
                        },
                      );
                    } else {
                      actions.onSetVacation(
                        emp || {
                          id: a.profileId,
                          firstName: a.profileFirstName,
                        },
                        room,
                      );
                    }
                  }}
                  className={
                    emp?.status === "VACATION" ||
                    (a as any).profileStatus === "VACATION"
                      ? "text-emerald-600 font-medium"
                      : "text-amber-600 font-medium"
                  }
                >
                  {emp?.status === "VACATION" ||
                  (a as any).profileStatus === "VACATION" ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600" />
                      {ar ? "تسجيل عودة من الإجازة" : "Return from Vacation"}
                    </>
                  ) : (
                    <>
                      <Palmtree className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-600" />
                      {ar ? "تسجيل خروج في إجازة" : "Set on Vacation"}
                    </>
                  )}
                </DropdownMenuItem>
              </PermissionGate>
              <PermissionGate
                anyPermission={[
                  ["whatsapp", "create"],
                  ["accommodation", "edit"],
                ]}
              >
                <DropdownMenuItem
                  onClick={() => {
                    actions.onWhatsApp(a, emp);
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600" />
                  {ar
                    ? "إرسال تفاصيل التسكين (واتساب)"
                    : "Send WhatsApp Welcome"}
                </DropdownMenuItem>
              </PermissionGate>
              <PermissionGate
                anyPermission={[
                  ["accommodation", "checkout"],
                  ["accommodation", "edit"],
                ]}
              >
                <DropdownMenuItem
                  onClick={() => {
                    actions.onCheckout(a, emp);
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {ar ? "خروج" : "Checkout"}
                </DropdownMenuItem>
              </PermissionGate>
              <PermissionGate
                anyPermission={[
                  ["accommodation", "transfer"],
                  ["accommodation", "edit"],
                ]}
              >
                <DropdownMenuItem
                  onClick={() => {
                    actions.onTransfer(a, emp);
                  }}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {ar ? "نقل لغرفة أخرى" : "Room Move"}
                </DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
}
