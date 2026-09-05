import { RoomImportWizard } from "./components/import/RoomImportWizard";
import { FileSpreadsheet, Download } from "lucide-react";
import { useState } from "react";
import { Building, MapPin, Users, Key, Info, LayoutGrid, Sparkles, BedDouble } from "lucide-react";
import { downloadRoomImportTemplate } from "@/lib/room-importer-engine";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePermission } from "@/hooks/use-permission";
import {
  useListBuildings,
  useListFloors,
  useListRooms,
  useListAssignments,
  useListProfiles,
} from "@workspace/api-client-react";

import { RoomSpaceViewTab } from "./components/RoomSpaceViewTab";
import { AvailabilityTab } from "./components/AvailabilityTab";
import { OccupancyTab } from "./components/OccupancyTab";
import { BuildingsTab } from "./components/buildings/BuildingsTab";
import { FloorsTab } from "./components/floors/FloorsTab";
import { RoomsTab } from "./components/rooms/RoomsTab";
import { KeysTab } from "./components/KeysTab";
import { RoomDetailsDialog } from "./components/RoomDetailsDialog";
import { RoomLogDialog } from "./components/RoomLogDialog";

export function HousingPage() {
  const { activePropertyId, properties } = useProperty();
  const qc = useQueryClient();
  const { language } = useLanguage();
  const ar = language === "ar";

  const [tab, setTab] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.location.pathname === "/room-space-view") {
        return "room_space_view";
      }
      return new URLSearchParams(window.location.search).get("tab") || "room_space_view";
    } catch {
      return "room_space_view";
    }
  });
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [roomLogRoom, setRoomLogRoom] = useState<any>(null);

  const { can } = usePermission();
  const hasAccommodation = can("accommodation", "view");
  const hasProfiles = can("profiles", "view");

  const { data: bData, isLoading: bLoading } = useListBuildings(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId } },
  );
  const { data: fData, isLoading: fLoading } = useListFloors(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId } },
  );
  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { queryKey: ["rooms", activePropertyId, 1000], enabled: !!activePropertyId } },
  );
  const rData = (_rDataWrapper as any)?.data || _rDataWrapper || [];
  const { data: aData } = useListAssignments(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId && hasAccommodation } },
  );

  const { data: eDataWrapper } = useListProfiles(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId && hasProfiles } },
  );
  const eData = (eDataWrapper as any)?.data || eDataWrapper || [];
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
  const profiles = (eData as any)?.profiles || eData || [];

  const isLoading = (bLoading || fLoading || rLoading) && (!buildings.length && !rooms.length);

  const activeAssignments = (assignments || []).filter((a: any) => a.status === "ACTIVE");
  const occupiedRoomIds = new Set(activeAssignments.map((a: any) => a.roomId));
  const totalRooms = rooms.length;
  const occupiedRooms = occupiedRoomIds.size;
  const totalBeds = rooms.reduce((s: number, r: any) => s + (r.capacity || 1), 0);
  const occupiedBeds = activeAssignments.length;
  const freeBeds = Math.max(0, totalBeds - occupiedBeds);

  const availableRooms = rooms.filter((r: any) => {
    const s = (r.status || "").toLowerCase();
    const roomOccCount = activeAssignments.filter((a: any) => a.roomId === r.id).length;
    return s === "available" || s === "vacant" || ((r.capacity || 1) > roomOccCount && s !== "out_of_service" && s !== "out_of_order");
  }).length;

  const occPct =
    totalRooms > 0
      ? Math.round((occupiedRooms / totalRooms) * 100)
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

        <div className="flex items-center gap-2">
          <PermissionGate module="housing" action="export">
            <Button
              variant="outline"
              onClick={() => downloadRoomImportTemplate("xlsx", ar ? "ar" : "en")}
              className="gap-1.5 text-xs font-semibold h-9 shadow-xs"
              title={ar ? "تحميل نموذج ملف تكوين واستيراد الغرف" : "Download Room Import Template"}
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              {ar ? "تحميل نموذج الغرف" : "Excel Template"}
            </Button>
          </PermissionGate>
          <PermissionGate module="housing" action="create">
            <Button
              onClick={() => setImportWizardOpen(true)}
              className="gap-2 bg-gradient-to-r from-primary to-indigo-600 font-bold text-white shadow-md text-xs h-9"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {ar ? "استيراد غرف (Excel / CSV)" : "Import Rooms (Excel / CSV)"}
            </Button>
          </PermissionGate>
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
                {ar ? "إشغال الغرف" : "Room Occupancy"}
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
                <span className="text-2xl font-bold">{occupiedRooms}</span>
                <span className="text-sm text-muted-foreground pb-1">
                  / {totalRooms} {ar ? "غرفة" : "rooms"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${occPct >= 90 ? "bg-red-500" : occPct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${occPct}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {occupiedBeds} / {totalBeds} {ar ? "سرير مشغول" : "beds occupied"}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm bg-primary/5 border-primary/10">
          <div className="flex items-center gap-2 mb-2 text-primary/80">
            <BedDouble className="w-4 h-4" />
            <span className="text-sm font-medium">
              {ar ? "الغرف المتاحة" : "Available Rooms"}
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">{availableRooms}</span>
                <span className="text-sm text-muted-foreground">{ar ? "غرفة" : "rooms"}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {freeBeds} {ar ? "سرير شاغر" : "free beds"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b overflow-x-auto no-scrollbar">
        {[
          {
            id: "room_space_view",
            label: ar ? "مخطط الغرف والأسرة" : "Room Space View",
            icon: <LayoutGrid className="w-4 h-4 text-primary" />,
          },
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
        {tab === "room_space_view" && (
          <RoomSpaceViewTab
            propertyId={activePropertyId as number}
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            assignments={assignments}
            profiles={profiles}
            onSelectRoom={setSelectedRoom}
          />
        )}
        {tab === "availability" && (
          <AvailabilityTab
            propertyId={activePropertyId as number}
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
            propertyId={activePropertyId as number}
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            bLoading={bLoading}
          />
        )}
        {tab === "floors" && (
          <FloorsTab
            propertyId={activePropertyId as number}
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            fLoading={fLoading}
          />
        )}
        {tab === "rooms" && (
          <RoomsTab
            propertyId={activePropertyId as number}
            buildings={buildings}
            floors={floors}
            rooms={rooms}
            rLoading={rLoading}
          />
        )}
        {tab === "keys" && (
          <KeysTab
            propertyId={activePropertyId as number}
            buildings={buildings}
            rooms={rooms}
            assignments={assignments}
            profiles={profiles}
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
        profiles={profiles}
      />

      <RoomLogDialog
        room={roomLogRoom}
        onClose={() => setRoomLogRoom(null)}
        assignments={assignments}
        profiles={profiles}
      />

      <RoomImportWizard
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        properties={properties}
        currentPropertyId={activePropertyId as number}
        buildings={buildings}
        existingRooms={rooms}
        onImportSuccess={() => {
          qc.invalidateQueries();
        }}
      />
    </div>
  );
}
