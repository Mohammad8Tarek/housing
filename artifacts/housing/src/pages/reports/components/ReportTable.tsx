import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bed, Building, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { roomStatusBadge, getRoomStatusLabel } from "@/pages/housing/utils";
import { SortableHead } from "@/components/ui/sortable-head";

export function ReportTable({
  isLoading,
  allData,
  paginatedData,
  selectedRows,
  setSelectedRows,
  activeTab,
  ar,
  sort,
  onSortToggle,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
}: any) {
  const H = (sortKey: string, label: React.ReactNode, className?: string) => (
    <SortableHead
      label={label}
      sortKey={sortKey}
      activeKey={sort?.key ?? null}
      dir={sort?.dir ?? "asc"}
      onToggle={onSortToggle ?? (() => {})}
      className={className}
    />
  );
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!paginatedData || paginatedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Building className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold text-base">
          {ar ? "لا توجد سجلات مطابقة للفلاتر المحددة" : "No records found matching filters"}
        </p>
        <p className="text-xs mt-1">
          {ar ? "جرب تغيير خيارات الفلترة أو البحث" : "Try adjusting your filter options or search query"}
        </p>
      </div>
    );
  }

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((r: any) => selectedRows.has(r.id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.add(r.id));
      setSelectedRows(next);
    } else {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.delete(r.id));
      setSelectedRows(next);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44] text-white">
            <TableHead className="w-10 px-3 text-white">
              <Checkbox
                className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2A44]"
                checked={isAllSelected}
                onCheckedChange={toggleAll}
              />
            </TableHead>

            {/* 1. ASSIGNMENTS HEADERS */}
            {activeTab === "assignments" && (
              <>
                {H("fullName", ar ? "الموظف / المقيم" : "Occupant / Profile")}
                {H("employmentType", ar ? "نوع التوظيف" : "Employment")}
                {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("department", ar ? "القسم والمسمى" : "Dept & Title")}
                {H("phone", ar ? "الهاتف" : "Phone")}
                {H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
                {H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
                {H("expectedCheckOutDate", ar ? "المغادرة المتوقعة" : "Expected Out")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 2. VACANT ROOMS HEADERS */}
            {activeTab === "vacant_rooms" && (
              <>
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
                {H("vacantBedsCount", ar ? "الأسرة الشاغرة" : "Vacant Beds", "text-center")}
                {H("availableBedsText", ar ? "أرقام الأسرة المتاحة" : "Available Beds")}
                {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
                {H("status", ar ? "حالة الغرفة" : "Room Status")}
              </>
            )}

            {/* 3. HOUSING INVENTORY HEADERS */}
            {activeTab === "housing" && (
              <>
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomType", ar ? "النوع" : "Type")}
                {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
                {H("vacantBeds", ar ? "الشاغر" : "Vacant", "text-center")}
                {H("occupancyRate", ar ? "نسبة الإشغال" : "Occupancy Rate", "text-center")}
                {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 4. PROFILES HEADERS */}
            {activeTab === "profiles" && (
              <>
                {H("fullName", ar ? "كود والاسم" : "Code & Name")}
                {H("employmentType", ar ? "النوع والشركة" : "Employment & Company")}
                {H("nationalId", ar ? "الرقم القومي" : "National ID")}
                {H("phone", ar ? "الهاتف" : "Phone")}
                {H("department", ar ? "القسم والمسمى" : "Dept & Job Title")}
                {H("assignedRoom", ar ? "السكن الحالي" : "Housing")}
                {H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
                {H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 5. EXPIRING CONTRACTS HEADERS */}
            {activeTab === "expiring_contracts" && (
              <>
                {H("fullName", ar ? "الموظف" : "Employee")}
                {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
                {H("assignedRoom", ar ? "السكن الحالي" : "Current Housing")}
                {H("phone", ar ? "الهاتف" : "Phone")}
                {H("contractEndDate", ar ? "تاريخ انتهاء العقد" : "Contract End Date")}
                {H("daysRemaining", ar ? "الأيام المتبقية" : "Days Remaining", "text-center")}
                {H("expStatus", ar ? "حالة العقد" : "Contract Status")}
              </>
            )}

            {/* 6. RESERVATIONS HEADERS */}
            {activeTab === "reservations" && (
              <>
                {H("guestName", ar ? "اسم الضيف" : "Guest Name")}
                {H("nationalId", ar ? "الرقم القومي والهاتف" : "ID & Phone")}
                {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("roomNumber", ar ? "الغرفة المحجوزة" : "Reserved Room")}
                {H("checkInDate", ar ? "تاريخ الوصول" : "Arrival Date")}
                {H("checkOutDate", ar ? "تاريخ المغادرة" : "Check-Out")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 7. HOSTINGS HEADERS */}
            {activeTab === "hostings" && (
              <>
                {H("hostEmployee", ar ? "الموظف المستضيف" : "Host Employee")}
                {H("guestName", ar ? "اسم الضيف والصلة" : "Guest & Relation")}
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("checkInDate", ar ? "من تاريخ" : "Check-In")}
                {H("checkOutDate", ar ? "إلى تاريخ" : "Check-Out")}
                {H("dailyRate", ar ? "سعر اليوم" : "Daily Rate")}
                {H("totalAmount", ar ? "الإجمالي" : "Total Fee")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 8. MAINTENANCE HEADERS */}
            {activeTab === "maintenance" && (
              <>
                {H("roomNumber", ar ? "الغرفة والمبنى" : "Room & Building")}
                {H("category", ar ? "الفئة" : "Category")}
                {H("problemType", ar ? "وصف المشكلة" : "Problem Details")}
                {H("priority", ar ? "الأولوية" : "Priority")}
                {H("assignedTo", ar ? "الفني المعين" : "Assigned To")}
                {H("reportedAt", ar ? "تاريخ البلاغ" : "Reported At")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 9. HOUSEKEEPING HEADERS */}
            {activeTab === "housekeeping" && (
              <>
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("capacity", ar ? "السعة" : "Cap", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occ", "text-center")}
                {H("vacantBeds", ar ? "الأسرة الشاغرة" : "Vacant", "text-center")}
                {H("status", ar ? "حالة الغرفة" : "Room Status")}
                {H("hkPriority", ar ? "الإجراء المطلوب" : "HK Action")}
                {H("openHkTickets", ar ? "تذاكر مفتوحة" : "Open Tickets", "text-center")}
              </>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedData.map((row: any, idx: number) => {
            const isSelected = selectedRows.has(row.id);

            return (
              <TableRow
                key={row.id || idx}
                className={`hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(row.id)}
                  />
                </TableCell>

                {/* 1. ASSIGNMENTS ROW */}
                {activeTab === "assignments" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.employmentType === "THIRD_PARTY" ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                          {row.companyName || "طرف ثالث"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          {ar ? "موظف داخلي" : "Internal"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-primary">{row.roomNumber}</span>
                        {row.bedNumber !== "—" && (
                          <Badge variant="secondary" className="text-[11px] h-5 px-1.5">
                            {ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`}
                          </Badge>
                        )}
                        {row.isEntireRoom && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] h-5 px-1.5 font-medium">
                            {ar ? "غرفة كاملة" : "Full Lock"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.buildingName} • {row.floorName}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                    <TableCell className="text-xs">{row.checkInDate}</TableCell>
                    <TableCell>
                      {row.contractEndDate !== "—" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-mono">
                          {row.contractEndDate}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{row.expectedCheckOutDate}</TableCell>
                    <TableCell>
                      {row.status === "VACATION" ? (
                        <div className="flex flex-col gap-0.5 items-start">
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold">
                            {ar ? "في إجازة" : "On Vacation"}
                          </Badge>
                          {row.vacationEndDate && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {ar ? `حتى ${row.vacationEndDate}` : `Till ${row.vacationEndDate}`}
                            </span>
                          )}
                        </div>
                      ) : row.status === "CHECKED_OUT" || row.status === "LEFT" ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium">
                          {ar ? "تمت المغادرة" : "Checked Out"}
                        </Badge>
                      ) : row.status === "TRANSFERRED" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          {ar ? "تم النقل" : "Transferred"}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold">
                            {ar ? "مقيم بالسكن" : "In-House"}
                          </Badge>
                          {row.isEntireRoom && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] px-1 py-0 font-medium">
                              {ar ? "غرفة كاملة" : "Entire Room"}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </>
                )}

                {/* 2. VACANT ROOMS ROW */}
                {activeTab === "vacant_rooms" && (
                  <>
                    <TableCell className="font-bold text-base text-primary">
                      {row.roomNumber}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.buildingName} • {row.floorName}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs">
                        {row.vacantBedsCount} {ar ? "سرير شاغر" : "beds free"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {row.availableBedsText}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.genderPolicy}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${roomStatusBadge(row.status)}`}>
                        {getRoomStatusLabel(row.status, ar)}
                      </span>
                    </TableCell>
                  </>
                )}

                {/* 3. HOUSING INVENTORY ROW */}
                {activeTab === "housing" && (
                  <>
                    <TableCell className="font-bold text-primary">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs">{row.buildingName} • {row.floorName}</TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <span className={row.vacantBeds > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                        {row.vacantBeds}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs">{row.occupancyRate}</TableCell>
                    <TableCell className="text-xs capitalize">{row.genderPolicy}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${roomStatusBadge(row.status)}`}>
                        {getRoomStatusLabel(row.status, ar)}
                      </span>
                    </TableCell>
                  </>
                )}

                {/* 4. PROFILES ROW */}
                {activeTab === "profiles" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.employmentType === "THIRD_PARTY" ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                          {row.companyName || "طرف ثالث"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          {ar ? "موظف داخلي" : "Internal"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{row.nationalId}</TableCell>
                    <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle} {row.level !== "—" ? `(${row.level})` : ""}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-primary">{row.assignedRoom}</span>
                    </TableCell>
                    <TableCell className="text-xs">{row.hireDate}</TableCell>
                    <TableCell>
                      {row.contractEndDate !== "—" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-mono">
                          {row.contractEndDate}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                    </TableCell>
                  </>
                )}

                {/* 5. EXPIRING CONTRACTS ROW */}
                {activeTab === "expiring_contracts" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.assignedRoom}</TableCell>
                    <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-400 font-mono font-bold text-xs">
                        {row.contractEndDate}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-bold text-xs px-2 py-1 rounded-full ${
                          row.daysRemaining < 0
                            ? "bg-rose-100 text-rose-800"
                            : row.daysRemaining <= 30
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {row.daysRemaining < 0
                          ? ar ? `منتهي منذ ${Math.abs(row.daysRemaining)} يوم` : `Expired ${Math.abs(row.daysRemaining)}d ago`
                          : ar ? `متبقي ${row.daysRemaining} يوم` : `${row.daysRemaining} days left`}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.expStatus}</TableCell>
                  </>
                )}

                {/* 6. RESERVATIONS ROW */}
                {activeTab === "reservations" && (
                  <>
                    <TableCell className="font-bold text-sm">{row.guestName}</TableCell>
                    <TableCell className="text-xs font-mono">{row.nationalId} • {row.phone}</TableCell>
                    <TableCell className="text-xs">{row.department} • {row.jobTitle}</TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-xs font-semibold text-primary">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs">{row.checkInDate}</TableCell>
                    <TableCell className="text-xs">{row.checkOutDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "UPCOMING"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : row.status === "CHECKED_IN"
                            ? "bg-green-50 text-green-800 border-green-300"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {row.status === "UPCOMING" ? (ar ? "حجز مستقبلي" : "Future") : row.status}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* 7. HOSTINGS ROW */}
                {activeTab === "hostings" && (
                  <>
                    <TableCell>
                      <p className="font-bold text-xs">{row.hostEmployee}</p>
                      <p className="text-[11px] text-muted-foreground">{row.hostDept}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-xs">{row.guestName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.relation} • {row.guestId}</p>
                    </TableCell>
                    <TableCell className="font-bold text-primary text-xs">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs">{row.checkInDate}</TableCell>
                    <TableCell className="text-xs">{row.checkOutDate}</TableCell>
                    <TableCell className="text-xs">{row.dailyRate}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-600">{row.totalAmount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                    </TableCell>
                  </>
                )}

                {/* 8. MAINTENANCE ROW */}
                {activeTab === "maintenance" && (
                  <>
                    <TableCell>
                      <span className="font-bold text-primary">{row.roomNumber}</span>
                      <p className="text-[11px] text-muted-foreground">{row.buildingName}</p>
                    </TableCell>
                    <TableCell className="text-xs font-semibold capitalize">{row.category}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{row.problemType}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.priority === "Urgent" || row.priority === "High"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs"
                            : "text-xs"
                        }
                      >
                        {row.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.assignedTo}</TableCell>
                    <TableCell className="text-xs">{row.reportedAt}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                    </TableCell>
                  </>
                )}

                {/* 9. HOUSEKEEPING ROW */}
                {activeTab === "housekeeping" && (
                  <>
                    <TableCell>
                      <span className="font-bold text-primary">{row.roomNumber}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center text-xs font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center text-xs">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.vacantBeds === 0
                            ? "bg-red-50 text-red-700 border-red-200 text-xs"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        }
                      >
                        {row.vacantBeds}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status?.toLowerCase() === "dirty"
                            ? "bg-orange-50 text-orange-700 border-orange-200 text-xs"
                            : row.status?.toLowerCase() === "occupied_dirty"
                            ? "bg-red-50 text-red-700 border-red-200 text-xs"
                            : row.status?.toLowerCase() === "available"
                            ? "bg-green-50 text-green-700 border-green-200 text-xs"
                            : row.status?.toLowerCase() === "occupied"
                            ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            : row.status?.toLowerCase() === "maintenance"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                            : "text-xs"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.hkPriority === "high"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                            : row.hkPriority === "none"
                            ? "bg-green-50 text-green-700 border-green-200 text-xs"
                            : row.hkPriority === "maintenance"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                            : "text-xs"
                        }
                      >
                        {ar
                          ? row.status?.toLowerCase() === "dirty" ? "تنظيف فوري 🧹"
                          : row.status?.toLowerCase() === "occupied_dirty" ? "تنظيف عند الخروج"
                          : row.status?.toLowerCase() === "available" ? "✅ جاهزة"
                          : row.status?.toLowerCase() === "occupied" ? "مشغولة — لا تزعج"
                          : row.status?.toLowerCase() === "maintenance" ? "🔧 صيانة"
                          : "مراجعة"
                          : row.status?.toLowerCase() === "dirty" ? "Immediate Clean 🧹"
                          : row.status?.toLowerCase() === "occupied_dirty" ? "Clean on Checkout"
                          : row.status?.toLowerCase() === "available" ? "✅ Ready"
                          : row.status?.toLowerCase() === "occupied" ? "Occupied — DND"
                          : row.status?.toLowerCase() === "maintenance" ? "🔧 Maintenance"
                          : "Review"
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.openHkTickets > 0 ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold">
                          {row.openHkTickets}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
