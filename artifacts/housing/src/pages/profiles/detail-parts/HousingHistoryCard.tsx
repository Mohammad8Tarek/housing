// Profile detail: housing history table.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, BedDouble, History } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { statusBadge } from "./detail.constants";
import type {
  ProfileDetailState,
  ProfileDetailView,
} from "./useProfileDetailState";

export function renderHousingHistoryCard(
  s: ProfileDetailState,
  v: ProfileDetailView,
) {
  const { ar, roomMap, buildingMap, floorMap, pastAssignments } = s;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          {ar ? "سجل الإقامة" : "Housing History"}
          {pastAssignments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pastAssignments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{ar ? "المبنى" : "Building"}</TableHead>
              <TableHead>{ar ? "الدور" : "Floor"}</TableHead>
              <TableHead>{ar ? "الغرفة" : "Room"}</TableHead>
              <TableHead>{ar ? "السرير" : "Bed"}</TableHead>
              <TableHead>{ar ? "الدخول" : "Check-in"}</TableHead>
              <TableHead>{ar ? "الخروج" : "Check-out"}</TableHead>
              <TableHead>{ar ? "المدة" : "Days"}</TableHead>
              <TableHead>{ar ? "ملاحظات" : "Notes"}</TableHead>
              <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pastAssignments.map((a: any) => {
              const room = roomMap[a.roomId];
              const roomNum = room?.roomNumber ?? a.roomNumber ?? a.roomId;
              const building = room
                ? buildingMap[room.buildingId]
                : (a.buildingName ?? null);
              const floorNum = room
                ? floorMap[room.floorId]
                : (a.floorNumber ?? null);
              const checkOutDate =
                a.checkOutDate || (a as any).actualCheckOutDate;
              const days =
                a.checkInDate && checkOutDate
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(checkOutDate).getTime() -
                          new Date(a.checkInDate).getTime()) /
                          86400000,
                      ),
                    )
                  : null;
              return (
                <TableRow key={a.id} className="hover:bg-muted/20">
                  <TableCell className="text-sm whitespace-nowrap">
                    {building ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-muted-foreground" />
                        {building}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {floorNum ? `${ar ? "طابق" : "Floor"} ${floorNum}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold text-primary">
                      {roomNum}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.bedNumber ? (
                      <Badge variant="outline" className="text-xs">
                        <BedDouble className="w-3 h-3 mr-1" />
                        {a.bedNumber}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(a.checkInDate)}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(checkOutDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {days !== null ? (
                      <Badge variant="outline" className="text-xs">
                        {days} {ar ? "يوم" : "d"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    className="text-sm text-muted-foreground max-w-[120px] truncate"
                    title={a.notes || ""}
                  >
                    {a.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(a.status)}`}
                    >
                      {a.status === "CHECKED_OUT"
                        ? ar
                          ? "تمت المغادرة"
                          : "Checked Out"
                        : a.status === "TRANSFERRED"
                          ? ar
                            ? "تم النقل"
                            : "Transferred"
                          : a.status === "ENDED"
                            ? ar
                              ? "منتهي"
                              : "Ended"
                            : a.status === "ACTIVE"
                              ? ar
                                ? "نشط"
                                : "Active"
                              : a.status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {pastAssignments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  {ar
                    ? "لا يوجد سجل إقامة سابق"
                    : "No previous housing history"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
