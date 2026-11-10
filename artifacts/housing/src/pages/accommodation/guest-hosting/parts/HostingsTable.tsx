// Guest hosting: hostings table.
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
import { formatDateTime } from "@/lib/date-utils";
import { LogIn, Pencil, Key, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataPagination } from "@/components/DataPagination";
import { statusColor } from "./GuestHostingPage.constants";
import type { GuestHostingState } from "./useGuestHostingState";

export function renderHostingsTable(s: GuestHostingState) {
  const { can, ar, pageSize, setPageSize, currentPage, setCurrentPage, setProfileEmpId, setCompanionsDetailHostingId, setKeyPromptOpen, setSelectedHostingKey, setKeyPromptRoomId, hostings, paginationTotal, checkinMutation, checkoutMutation, openEdit, selectedRows, pagedHostings, allHostPageSelected, toggleSelectAllHost, toggleHostRow, dateText, getHostProfile, getHostName, getHostCode, getAdultsCount, getChildrenCount, getGuestRelations, getGuestDocs, getRoom, getRoomNumber, guestProfileLines, HOSTING_COLS, isHVisible } = s;
  return (
<div className="border rounded-lg bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={allHostPageSelected}
                      onCheckedChange={toggleSelectAllHost}
                    />
                  </TableHead>
                  {HOSTING_COLS.map(
                    (col) =>
                      isHVisible(col.key) &&
                      col.key !== "actions" && (
                        <TableHead
                          key={col.key}
                          className="font-semibold"
                          style={
                            col.key === "guestProfiles" ||
                            col.key === "guestNames"
                              ? { minWidth: "160px" }
                              : {}
                          }
                        >
                          {ar ? col.labelAr : col.label}
                        </TableHead>
                      ),
                  )}
                  {isHVisible("actions") && (
                    <TableHead className="font-semibold">
                      {ar ? "إجراءات" : "Actions"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedHostings.map((h: any) => {
                  const isSelected = selectedRows.has(h.id);
                  const emp = getHostProfile(h);
                  const room = getRoom(h);
                  const guestProfiles = guestProfileLines(h);
                  return (
                    <TableRow
                      key={h.id}
                      className={
                        isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }
                    >
                      <TableCell className="px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleHostRow(h.id)}
                        />
                      </TableCell>
                      {isHVisible("host") && (
                        <TableCell className="font-medium">
                          <button
                            className="flex items-center gap-2 text-left text-sm font-semibold text-primary hover:underline"
                            onClick={() =>
                              h.profileId != null &&
                              setProfileEmpId(Number(h.profileId))
                            }
                          >
                            {emp?.photoUrl ? (
                              <img
                                src={emp.photoUrl}
                                alt=""
                                className="h-8 w-8 rounded-full border object-cover"
                              />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {getHostName(h)
                                  .split(" ")
                                  .map((part: string) => part[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block whitespace-nowrap">
                                {getHostName(h)}
                              </span>
                              <span className="block text-xs font-normal text-muted-foreground">
                                {getHostCode(h)}
                              </span>
                            </span>
                          </button>
                        </TableCell>
                      )}
                      {isHVisible("profileCode") && (
                        <TableCell className="font-mono text-xs">
                          {getHostCode(h)}
                        </TableCell>
                      )}
                      {isHVisible("department") && (
                        <TableCell className="text-sm">
                          {emp?.department || "—"}
                        </TableCell>
                      )}
                      {isHVisible("jobTitle") && (
                        <TableCell className="text-sm">
                          {emp?.jobTitle || "—"}
                        </TableCell>
                      )}
                      {isHVisible("guestProfiles") && (
                        <TableCell className="max-w-[160px]">
                          {guestProfiles.length > 0 ||
                          Number(h.guestsCount ?? 0) > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full text-xs justify-center"
                              onClick={() => setCompanionsDetailHostingId(h.id)}
                            >
                              {guestProfiles.length > 0
                                ? ar
                                  ? "عرض الملف"
                                  : "View Profile"
                                : ar
                                  ? "استكمال البيانات"
                                  : "Complete Data"}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isHVisible("guestDocs") && (
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">
                          {getGuestDocs(h)}
                        </TableCell>
                      )}
                      {isHVisible("relations") && (
                        <TableCell className="text-sm">
                          {getGuestRelations(h)}
                        </TableCell>
                      )}
                      {isHVisible("guestCounts") && (
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1 whitespace-nowrap">
                            <span className="font-semibold">
                              {h.guestsCount} {ar ? "إجمالي" : "total"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getAdultsCount(h)} {ar ? "بالغ" : "adult"} •{" "}
                              {getChildrenCount(h)} {ar ? "طفل" : "child"}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {isHVisible("type") && (
                        <TableCell className="text-sm">
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {h.hostingType?.replace("_", " ") ?? "—"}
                          </Badge>
                        </TableCell>
                      )}
                      {isHVisible("room") && (
                        <TableCell className="font-mono text-sm font-semibold">
                          {getRoomNumber(h)}
                        </TableCell>
                      )}
                      {isHVisible("building") && (
                        <TableCell className="text-sm">
                          {room?.buildingName ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("floor") && (
                        <TableCell className="text-sm">
                          {room?.floorNumber ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomType") && (
                        <TableCell className="text-sm capitalize">
                          {room?.roomType ?? h.roomType ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("capacity") && (
                        <TableCell className="text-sm">
                          {room?.capacity ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("occupancy") && (
                        <TableCell className="text-sm">
                          {room
                            ? `${room.currentOccupancy ?? 0}/${room.capacity ?? "—"}`
                            : "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomStatus") && (
                        <TableCell className="text-sm capitalize">
                          {room?.status ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomGender") && (
                        <TableCell className="text-sm capitalize">
                          {room?.gender ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("from") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.expectedFrom)}
                        </TableCell>
                      )}
                      {isHVisible("to") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.expectedTo)}
                        </TableCell>
                      )}
                      {isHVisible("actualIn") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.actualCheckIn)}
                        </TableCell>
                      )}
                      {isHVisible("actualOut") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.actualCheckOut)}
                        </TableCell>
                      )}
                      {isHVisible("status") && (
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(h.status)}`}
                          >
                            {h.status}
                          </span>
                        </TableCell>
                      )}
                      {isHVisible("notes") && (
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {h.notes || "—"}
                        </TableCell>
                      )}
                      {isHVisible("createdBy") && (
                        <TableCell className="text-sm">
                          {h.createdBy || "—"}
                        </TableCell>
                      )}
                      {isHVisible("createdAt") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDateTime(h.createdAt)}
                        </TableCell>
                      )}
                      {isHVisible("actions") && (
                        <TableCell>
                          {(h.status !== "COMPLETED" && h.status !== "CANCELLED") || can("guest_hosting", "edit") ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  {ar ? "إجراءات" : "Actions"}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {h.status === "APPROVED" && (
                                  <>
                                    {can("guest_hosting", "checkin") && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          checkinMutation.mutate({
                                            id: h.id,
                                            data: {
                                              actualCheckIn: new Date()
                                                .toISOString()
                                                .split("T")[0],
                                            } as any,
                                          })
                                        }
                                      >
                                        <LogIn className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                        {ar ? "تسجيل الوصول" : "Check-in"}
                                      </DropdownMenuItem>
                                    )}
                                    {can("guest_hosting", "edit") && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedHostingKey(h);
                                          setKeyPromptRoomId(
                                            h.roomId ? String(h.roomId) : "",
                                          );
                                          setKeyPromptOpen(true);
                                        }}
                                      >
                                        <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                        {ar ? "إصدار مفتاح" : "Issue Key"}
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {h.status === "ACTIVE" && (
                                  <>
                                    {can("guest_hosting", "edit") && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedHostingKey(h);
                                          setKeyPromptRoomId(
                                            h.roomId ? String(h.roomId) : "",
                                          );
                                          setKeyPromptOpen(true);
                                        }}
                                      >
                                        <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                        {ar ? "إصدار مفتاح" : "Issue Key"}
                                      </DropdownMenuItem>
                                    )}
                                    {can("guest_hosting", "checkout") && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          checkoutMutation.mutate({ id: h.id })
                                        }
                                      >
                                        <LogIn className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 rotate-180" />
                                        {ar ? "تسجيل المغادرة" : "Check-out"}
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {can("guest_hosting", "edit") && (
                                  <DropdownMenuItem onClick={() => openEdit(h)}>
                                    <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                    {ar ? "تعديل" : "Edit"}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-sm text-muted-foreground px-4">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {hostings.length > 0 && (
            <DataPagination
              currentPage={currentPage}
              pageSize={pageSize}
              total={paginationTotal}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
  );
}
