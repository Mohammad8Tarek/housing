// @ts-nocheck
import { useState } from "react";
import { Building, MapPin, Users, Key, Info } from "lucide-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useListBuildings,
  useListFloors,
  useListRooms,
  useListAssignments,
  useListEmployees,
} from "@workspace/api-client-react";

import { AvailabilityTab } from "./housing-components/AvailabilityTab";
import { OccupancyTab } from "./housing-components/OccupancyTab";
import { BuildingsTab } from "./housing-components/BuildingsTab";
import { FloorsTab } from "./housing-components/FloorsTab";
import { RoomsTab } from "./housing-components/RoomsTab";
import { KeysTab } from "./housing-components/KeysTab";
import { RoomDetailsDialog } from "./housing-components/RoomDetailsDialog";
import { RoomLogDialog } from "./housing-components/RoomLogDialog";

export default function Housing() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const [tab, setTab] = useState("availability");
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [roomLogRoom, setRoomLogRoom] = useState<any>(null);

  const { data: bData, isLoading: bLoading } = useListBuildings({
    propertyId: activePropertyId as number,
  });
  const { data: fData, isLoading: fLoading } = useListFloors({
    propertyId: activePropertyId as number,
  });
  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(
    { propertyId: activePropertyId as number, limit: 1000 },
    { query: { staleTime: 0 } },
  );
  const rData = _rDataWrapper?.data || [];
  const { data: aData } = useListAssignments({
    propertyId: activePropertyId as number,
  });

  const { data: eDataWrapper } = useListEmployees({
    propertyId: activePropertyId as number,
  });
  const eData = eDataWrapper?.data || [];
  if (!activePropertyId) {
    return (
      <div className="p-8">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertTitle>{ar ? "مطلوب" : "Required"}</AlertTitle>
          <AlertDescription>
            {ar ? "الرجاء اختيار فندق أولاً" : "Please select a hotel first"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const buildings = (bData as any)?.data || bData || [];
  const floors = (fData as any)?.data || fData || [];
  const rooms = (rData as any)?.data || rData || [];
  const assignments = (aData as any)?.data || aData || [];
  const employees = (eData as any)?.employees || eData || [];

  const isLoading = bLoading || fLoading || rLoading;

  const totalCapacity = buildings.reduce((s, b) => s + (b.capacity || 0), 0);
  const currentOccupancy = rooms.reduce(
    (s, r) => s + (r.currentOccupancy || 0),
    0,
  );
  const freeBeds = totalCapacity - currentOccupancy;
  const occPct =
    totalCapacity > 0
      ? Math.round((currentOccupancy / totalCapacity) * 100)
      : 0;

  return (
    <div className="flex-1 w-full p-6 md:p-8 space-y-6">
      {/* ── HEADER & STATS ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar ? "إدارة السكن" : "Housing Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {ar
              ? "إدارة المباني، الطوابق، الغرف والتسكين"
              : "Manage buildings, floors, rooms, and assignments"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Building className="w-4 h-4" />
            <span className="text-sm font-medium">
              {ar ? "إجمالي المباني" : "Total Buildings"}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">{buildings.length}</div>
          )}
        </div>
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">
              {ar ? "إجمالي الغرف" : "Total Rooms"}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">{rooms.length}</div>
          )}
        </div>
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between mb-2 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {ar ? "الإشغال الحالي" : "Current Occupancy"}
              </span>
            </div>
            {!isLoading && (
              <span className="text-xs font-bold text-primary">{occPct}%</span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">{currentOccupancy}</span>
                <span className="text-sm text-muted-foreground pb-1">
                  / {totalCapacity} {ar ? "سرير" : "beds"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${occPct >= 90 ? "bg-red-500" : occPct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${occPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm bg-primary/5 border-primary/10">
          <div className="flex items-center gap-2 mb-2 text-primary/80">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">
              {ar ? "الأسرة المتاحة" : "Available Beds"}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-primary">{freeBeds}</div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b overflow-x-auto no-scrollbar">
        {[
          { id: "availability", label: ar ? "توافر الغرف" : "Availability" },
          { id: "occupancy", label: ar ? "مخطط الإشغال" : "Occupancy Tree" },
          { id: "buildings", label: ar ? "المباني" : "Buildings" },
          { id: "floors", label: ar ? "الطوابق" : "Floors" },
          { id: "rooms", label: ar ? "الغرف" : "Rooms" },
          {
            id: "keys",
            label: ar ? "المفاتيح" : "Keys",
            icon: <Key className="w-3.5 h-3.5 mr-1.5" />,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "availability" && (
          <AvailabilityTab
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            rLoading={rLoading}
            onSelectRoom={setSelectedRoom}
          />
        )}
        {tab === "occupancy" && (
          <OccupancyTab
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            onSelectRoom={setSelectedRoom}
          />
        )}
        {tab === "buildings" && (
          <BuildingsTab
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            bLoading={bLoading}
          />
        )}
        {tab === "floors" && (
          <FloorsTab
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            fLoading={fLoading}
          />
        )}
        {tab === "rooms" && (
          <RoomsTab
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            rLoading={rLoading}
          />
        )}
        {tab === "keys" && (
          <KeysTab
            buildings={buildings}
            rooms={rooms}
            assignments={assignments}
            employees={employees}
          />
        )}
      </div>

      {/* Shared Dialogs */}
      <RoomDetailsDialog
        room={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onOpenRoomLog={(room) => setRoomLogRoom(room)}
        buildings={buildings}
        floors={floors}
        assignments={assignments}
        employees={employees}
      />

      <RoomLogDialog
        room={roomLogRoom}
        onClose={() => setRoomLogRoom(null)}
        assignments={assignments}
        employees={employees}
      />
    </div>
  );
}
