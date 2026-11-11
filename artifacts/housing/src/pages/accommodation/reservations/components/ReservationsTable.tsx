import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { formatDate } from "@/lib/date-utils";
import {
  Trash,
  BedDouble,
  CalendarDays,
  CheckCircle,
  Pencil,
  Building2,
  ChevronDown,
  Phone,
  CreditCard,
  Ban,
  MessageSquare,
} from "lucide-react";
import type { CancelDialogState, Setter } from "../types";

interface ReservationsTableProps {
  ar: boolean;
  reservations: any[];
  isLoading: boolean;
  selectedRows: Set<number>;
  allResPageSelected: boolean;
  toggleSelectAllRes: () => void;
  toggleResRow: (id: number) => void;
  isResVisible: (key: string) => boolean;
  roomMap: Map<number, any>;
  buildingMap: Record<string, any>;
  statusLabel: Record<string, string>;
  statusColor: (s: string) => string;
  handleStartCheckin: (res: any) => void;
  handleOpenWhatsAppDialog: (res: any) => void;
  openEdit: (res: any) => void;
  setCancelDialog: Setter<CancelDialogState>;
  setDeleteId: Setter<number | null>;
}

export function ReservationsTable({
  ar,
  reservations,
  isLoading,
  selectedRows,
  allResPageSelected,
  toggleSelectAllRes,
  toggleResRow,
  isResVisible,
  roomMap,
  buildingMap,
  statusLabel,
  statusColor,
  handleStartCheckin,
  handleOpenWhatsAppDialog,
  openEdit,
  setCancelDialog,
  setDeleteId,
}: ReservationsTableProps) {
  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/80 hover:bg-muted/80">
            <TableHead className="w-10 px-3 sticky ltr:left-0 rtl:right-0 z-20 bg-muted/90">
              <Checkbox
                checked={allResPageSelected}
                onCheckedChange={toggleSelectAllRes}
              />
            </TableHead>
            {isResVisible("guest") && (
              <TableHead className="font-semibold text-xs text-foreground w-[25%] min-w-0">
                {ar ? "النزيل والتصنيف" : "Guest & Type"}
              </TableHead>
            )}
            {isResVisible("contact") && (
              <TableHead className="font-semibold text-xs text-foreground w-[16%] min-w-0">
                {ar ? "التواصل والهوية" : "Contact & ID"}
              </TableHead>
            )}
            {isResVisible("stay") && (
              <TableHead className="font-semibold text-xs text-foreground w-[19%] min-w-0">
                {ar ? "فترة الإقامة" : "Stay Period"}
              </TableHead>
            )}
            {isResVisible("room") && (
              <TableHead className="font-semibold text-xs text-foreground w-[22%] min-w-0">
                {ar ? "المبنى والتسكين" : "Building & Housing"}
              </TableHead>
            )}
            {isResVisible("emptype") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "النوع" : "Type"}
              </TableHead>
            )}
            {isResVisible("phone") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "الهاتف" : "Phone"}
              </TableHead>
            )}
            {isResVisible("id") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "الهوية" : "ID Card"}
              </TableHead>
            )}
            {isResVisible("dept") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "القسم" : "Dept"}
              </TableHead>
            )}
            {isResVisible("roomtype") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "نوع الغرفة" : "Room Type"}
              </TableHead>
            )}
            {isResVisible("checkin") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "الدخول" : "Check-in"}
              </TableHead>
            )}
            {isResVisible("checkout") && (
              <TableHead className="font-semibold text-xs">
                {ar ? "المغادرة" : "Check-out"}
              </TableHead>
            )}
            {isResVisible("status") && (
              <TableHead className="font-semibold text-xs text-foreground w-[10%] min-w-0 text-center">
                {ar ? "الحالة" : "Status"}
              </TableHead>
            )}
            {isResVisible("actions") && (
              <TableHead className="font-semibold text-xs text-center w-20 sticky ltr:right-0 rtl:left-0 z-20 bg-muted/90 border-s border-border">
                {ar ? "إجراءات" : "Actions"}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : (reservations || []).length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center py-16 text-muted-foreground"
              >
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{ar ? "لا توجد حجوزات" : "No reservations found"}</p>
              </TableCell>
            </TableRow>
          ) : (
            (reservations || []).map((res: any) => {
              const isSel = selectedRows.has(res.id);
              const isThirdParty =
                res.employmentType === "THIRD_PARTY" ||
                res.department === "طرف ثالث";
              const room =
                (res.roomId && roomMap.get(Number(res.roomId))) || null;
              const roomNumber =
                res.roomNumber ||
                room?.roomNumber ||
                (res.roomId ? String(res.roomId) : null);
              const buildingName =
                res.buildingName ||
                (room?.buildingId ? buildingMap[room.buildingId] : null) ||
                room?.buildingName ||
                null;
              const bedNumber =
                res.bedNumber ||
                (room?.bedNumber ? String(room.bedNumber) : null);
              const roomType =
                res.roomType || room?.type || room?.classification || null;

              const inTime = res.checkInDate
                ? new Date(res.checkInDate).getTime()
                : NaN;
              const outTime = res.checkOutDate
                ? new Date(res.checkOutDate).getTime()
                : NaN;
              const nights =
                !isNaN(inTime) && !isNaN(outTime)
                  ? Math.max(
                      1,
                      Math.round((outTime - inTime) / (1000 * 60 * 60 * 24)),
                    )
                  : null;

              return (
                <TableRow
                  key={res.id}
                  className={`group ${isSel ? "bg-primary/5" : "hover:bg-muted/20"}`}
                >
                  <TableCell className="px-3 sticky ltr:left-0 rtl:right-0 z-10 bg-card group-hover:bg-accent/40">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={() => toggleResRow(res.id)}
                    />
                  </TableCell>

                  {/* Guest & Profile Type */}
                  {isResVisible("guest") && (
                    <TableCell className="py-2.5 min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-sm text-foreground leading-tight truncate block">
                          {res.firstName} {res.lastName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {isThirdParty ? (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block mr-1 rtl:ml-1 rtl:mr-0 flex-shrink-0" />
                              <span className="truncate">
                                {ar ? "طرف ثالث" : "Third Party"}
                                {res.companyName ? ` • ${res.companyName}` : ""}
                              </span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0 truncate"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block mr-1 rtl:ml-1 rtl:mr-0 flex-shrink-0" />
                              <span className="truncate">
                                {ar ? "موظف داخلي" : "Internal"}
                              </span>
                            </Badge>
                          )}
                        </div>
                        {(res.department || res.jobTitle) && (
                          <div className="text-[11px] text-muted-foreground/80 truncate">
                            {res.department && res.department !== "طرف ثالث"
                              ? res.department
                              : ""}
                            {res.department &&
                            res.department !== "طرف ثالث" &&
                            res.jobTitle
                              ? " • "
                              : ""}
                            {res.jobTitle ? res.jobTitle : ""}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Contact & ID */}
                  {isResVisible("contact") && (
                    <TableCell className="py-2.5 min-w-0">
                      <div className="flex flex-col text-xs gap-0.5 min-w-0">
                        {res.guestPhone ? (
                          <span
                            className="font-mono text-foreground font-medium flex items-center gap-1 truncate"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{res.guestPhone}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {res.guestIdCardNumber && (
                          <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                            <CreditCard className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                            <span className="truncate">
                              {res.guestIdCardNumber}
                            </span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Stay Period */}
                  {isResVisible("stay") && (
                    <TableCell className="py-2.5 min-w-0">
                      <div className="flex flex-col text-xs gap-0.5 min-w-0">
                        <div className="flex items-center gap-1 font-medium whitespace-nowrap">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            {formatDate(res.checkInDate)}
                          </span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {formatDate(res.checkOutDate)}
                          </span>
                        </div>
                        {nights !== null && (
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {ar
                              ? `${nights} ${nights === 1 ? "ليلة" : nights === 2 ? "ليلتان" : nights <= 10 ? "ليالٍ" : "ليلة"}`
                              : `${nights} ${nights === 1 ? "night" : "nights"}`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Building & Housing */}
                  {isResVisible("room") && (
                    <TableCell className="py-2.5 min-w-0">
                      <div className="flex flex-col text-xs gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {buildingName && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800 text-[11px] font-semibold">
                              <Building2 className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                              <span>{buildingName}</span>
                            </span>
                          )}
                          {roomNumber ? (
                            <span className="font-bold text-sm text-primary flex items-center gap-1 truncate">
                              <BedDouble className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>
                                {ar
                                  ? `غرفة ${roomNumber}`
                                  : `Room ${roomNumber}`}
                              </span>
                              {bedNumber && (
                                <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                                  {ar
                                    ? `سرير ${bedNumber}`
                                    : `Bed ${bedNumber}`}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <BedDouble className="w-3.5 h-3.5 shrink-0 opacity-80" />
                              <span>
                                {ar ? "لم تُحدد بعد" : "Not Assigned"}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          <span>
                            {roomType || (ar ? "غرفة سكنية" : "Standard")}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  )}

                  {/* Granular Fallback Cells if user checked them specifically in ColumnChooser */}
                  {isResVisible("emptype") && (
                    <TableCell>
                      {isThirdParty ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold">
                          {ar ? "طرف ثالث" : "Third Party"}
                          {res.companyName ? ` • ${res.companyName}` : ""}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold"
                        >
                          {ar ? "موظف داخلي" : "Internal"}
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  {isResVisible("phone") && (
                    <TableCell className="text-sm">
                      {res.guestPhone || "—"}
                    </TableCell>
                  )}
                  {isResVisible("id") && (
                    <TableCell className="text-sm font-mono">
                      {res.guestIdCardNumber || "—"}
                    </TableCell>
                  )}
                  {isResVisible("dept") && (
                    <TableCell className="text-sm">
                      {res.department || "—"}
                    </TableCell>
                  )}
                  {isResVisible("roomtype") && (
                    <TableCell className="text-sm">
                      {res.roomType || "—"}
                    </TableCell>
                  )}
                  {isResVisible("checkin") && (
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(res.checkInDate)}
                    </TableCell>
                  )}
                  {isResVisible("checkout") && (
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(res.checkOutDate)}
                    </TableCell>
                  )}

                  {/* Status */}
                  {isResVisible("status") && (
                    <TableCell className="py-2.5 whitespace-nowrap text-center">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColor(res.status)}`}
                      >
                        {statusLabel[res.status] || res.status}
                      </span>
                    </TableCell>
                  )}

                  {/* Actions */}
                  {isResVisible("actions") && (
                    <TableCell className="w-24 text-center sticky ltr:right-0 rtl:left-0 z-10 bg-card group-hover:bg-accent/40 border-s border-border">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 font-medium bg-background hover:bg-muted shadow-xs"
                          >
                            {ar ? "إجراءات" : "Actions"}{" "}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 shadow-lg"
                        >
                          {res.status === "UPCOMING" && (
                            <PermissionGate
                              module="accommodation"
                              action="create"
                            >
                              <DropdownMenuItem
                                onClick={() => handleStartCheckin(res)}
                                className="cursor-pointer font-medium text-emerald-600"
                              >
                                <CheckCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-500" />
                                {ar ? "تسكين" : "Check-In"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          )}
                          {res.status === "UPCOMING" && (
                            <PermissionGate
                              anyPermission={[
                                ["whatsapp", "create"],
                                ["accommodation", "edit"],
                              ]}
                            >
                              <DropdownMenuItem
                                onClick={() => handleOpenWhatsAppDialog(res)}
                                className="cursor-pointer font-medium text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <MessageSquare className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-500" />
                                {ar
                                  ? "إرسال تأكيد الحجز (واتساب)"
                                  : "Send WhatsApp Confirmation"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          )}
                          <PermissionGate module="accommodation" action="edit">
                            <DropdownMenuItem
                              onClick={() => openEdit(res)}
                              className="cursor-pointer"
                            >
                              <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-500" />
                              {ar ? "تعديل" : "Edit"}
                            </DropdownMenuItem>
                          </PermissionGate>
                          {res.status === "UPCOMING" && (
                            <PermissionGate
                              module="accommodation"
                              action="edit"
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  setCancelDialog({
                                    open: true,
                                    reservation: res,
                                    reason: "",
                                  })
                                }
                                className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10 font-medium"
                              >
                                <Ban className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-destructive" />
                                {ar ? "إلغاء الحجز" : "Cancel Reservation"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          )}
                          <PermissionGate
                            module="accommodation"
                            action="delete"
                          >
                            <DropdownMenuItem
                              onClick={() => setDeleteId(res.id)}
                              className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-destructive" />
                              {ar ? "حذف" : "Delete"}
                            </DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
