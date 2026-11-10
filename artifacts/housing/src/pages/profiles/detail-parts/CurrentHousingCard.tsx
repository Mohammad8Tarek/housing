// Profile detail: current housing and extend-stay action.
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, BedDouble, Home, Printer, CalendarPlus } from "lucide-react";
import { differenceInDays } from "date-fns";
import { formatDate } from "@/lib/date-utils";
import type { ProfileDetailState, ProfileDetailView } from "./useProfileDetailState";

export function renderCurrentHousingCard(s: ProfileDetailState, v: ProfileDetailView) {
  const { ar, roomMap, buildingMap, floorMap, currentAssignment, printHousingLetter, openExtendFromDetail } = s;
  const { profileId } = v;
  return (
<Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" />
              {ar ? "السكن الحالي" : "Current Housing"}
            </CardTitle>
            {currentAssignment && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openExtendFromDetail}
                  className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  {ar ? "تمديد الإقامة" : "Extend Stay"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={printHousingLetter}
                  className="gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentAssignment ? (
            (() => {
              const room = roomMap[currentAssignment.roomId];
              const roomNum = room?.roomNumber ?? currentAssignment.roomNumber ?? currentAssignment.roomId;
              const building = room ? buildingMap[room.buildingId] : (currentAssignment.buildingName ?? null);
              const floorNum = room ? floorMap[room.floorId] : (currentAssignment.floorNumber ?? null);
              const daysStayed = differenceInDays(
                new Date(),
                new Date(currentAssignment.checkInDate),
              );
              const daysRemaining = currentAssignment.expectedCheckOutDate
                ? differenceInDays(
                    new Date(currentAssignment.expectedCheckOutDate),
                    new Date(),
                  )
                : null;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: ar ? "المبنى" : "Building",
                      value: building ?? (room?.buildingId ? `#${room.buildingId}` : "—"),
                      icon: <Building2 className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "الدور" : "Floor",
                      value: floorNum
                        ? `${ar ? "الطابق" : "Floor"} ${floorNum}`
                        : "—",
                      icon: null,
                    },
                    {
                      label: ar ? "الغرفة" : "Room",
                      value: roomNum ?? "—",
                      icon: <Home className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "السرير" : "Bed",
                      value: currentAssignment.bedNumber ?? "—",
                      icon: <BedDouble className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "تاريخ الدخول" : "Check-in",
                      value: formatDate(currentAssignment.checkInDate),
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "المغادرة المتوقعة" : "Expected Out",
                      value: formatDate(currentAssignment.expectedCheckOutDate),
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "مدة الإقامة" : "Days Stayed",
                      value: `${daysStayed} ${ar ? "يوم" : "days"}`,
                      icon: null,
                    },
                    {
                      label: ar ? "الأيام المتبقية" : "Days Remaining",
                      value:
                        daysRemaining !== null
                          ? `${daysRemaining} ${ar ? "يوم" : "days"}`
                          : "—",
                      icon: null,
                    },
                  ].map((row, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                        {row.label}
                      </p>
                      <p className="font-semibold text-sm">
                        {String(row.value)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <Home className="w-8 h-8 mx-auto opacity-30" />
              <p>
                {ar
                  ? "لا يوجد تسكين نشط حالياً لهذا الموظف"
                  : "No active housing assignment for this employee"}
              </p>
              <Link href={`/accommodation/room-assignment?profileId=${profileId}`}>
                <Button size="sm" className="gap-1.5 mt-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  <BedDouble className="w-4 h-4" />
                  {ar ? "تسكين الموظف الآن" : "Assign Room Now"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
  );
}
