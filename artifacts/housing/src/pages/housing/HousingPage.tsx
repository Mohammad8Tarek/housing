import { RoomImportWizard } from "./components/import/RoomImportWizard";
import { FileSpreadsheet, Download, FileDown, Building, MapPin, Users, Key, Info, LayoutGrid, Sparkles, BedDouble } from "lucide-react";
import * as XLSX from "xlsx";
import { getExportFileName } from "@/lib/date-utils";
import { toast } from "sonner";
import { useState } from "react";
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
  getListBuildingsQueryKey,
  getListFloorsQueryKey,
  getListRoomsQueryKey,
  getListAssignmentsQueryKey,
  getListProfilesQueryKey,
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
import { DashboardKpiCard } from "@/pages/dashboard/components/DashboardKpiCard";
import { ReadinessTrackerBar } from "@/pages/dashboard/components/ReadinessTrackerBar";

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

  const bParams = { propertyId: activePropertyId as number, limit: 1000 } as any;
  const { data: bData, isLoading: bLoading } = useListBuildings(bParams, {
    query: { queryKey: getListBuildingsQueryKey(bParams), enabled: !!activePropertyId },
  });
  const fParams = { propertyId: activePropertyId as number, limit: 1000 } as any;
  const { data: fData, isLoading: fLoading } = useListFloors(fParams, {
    query: { queryKey: getListFloorsQueryKey(fParams), enabled: !!activePropertyId },
  });
  const rParams = { propertyId: activePropertyId as number, limit: 1000 } as any;
  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(rParams, {
    query: { queryKey: getListRoomsQueryKey(rParams), enabled: !!activePropertyId },
  });
  const rData = (_rDataWrapper as any)?.data || _rDataWrapper || [];
  const aParams = { propertyId: activePropertyId as number, limit: 1000 } as any;
  const { data: aData } = useListAssignments(aParams, {
    query: { queryKey: getListAssignmentsQueryKey(aParams), enabled: !!activePropertyId && hasAccommodation },
  });

  const eParams = { propertyId: activePropertyId as number, limit: 1000 } as any;
  const { data: eDataWrapper } = useListProfiles(eParams, {
    query: { queryKey: getListProfilesQueryKey(eParams), enabled: !!activePropertyId && hasProfiles },
  });
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
  const rooms = rData || [];
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
    // Fully-vacant-only: any occupied bed disqualifies the room.
    if (roomOccCount > 0) return false;
    return s === "available" || s === "vacant" || (s !== "out_of_service" && s !== "out_of_order");
  }).length;

  const partiallyOccupiedRooms = rooms.filter((r: any) => {
    const s = (r.status || "").toLowerCase();
    const roomOccCount = activeAssignments.filter((a: any) => a.roomId === r.id).length;
    const cap = r.capacity || 1;
    if (["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(s)) return false;
    return roomOccCount > 0 && roomOccCount < cap;
  }).length;

  const occPct =
    totalRooms > 0
      ? Math.round((occupiedRooms / totalRooms) * 100)
      : 0;

  const dirtyRooms = rooms.filter((r: any) => {
    const s = (r.status || "").toLowerCase();
    return s === "dirty" || s === "occupied_dirty";
  }).length;

  const maintenanceRooms = rooms.filter((r: any) => {
    const s = (r.status || "").toLowerCase();
    return s === "maintenance" || s === "out_of_service" || s === "out_of_order";
  }).length;

  const cleanRate = totalRooms > 0 ? Math.round((availableRooms / totalRooms) * 100) : 100;

  const exportHousingConfiguration = () => {
    if (!rooms.length && !buildings.length) {
      toast.error(ar ? "لا توجد بيانات غرف أو مبانٍ لتصديرها" : "No housing data available to export");
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Rooms Configuration Sheet
    const roomRows = rooms.map((r: any) => {
      const bld = buildings.find((b: any) => b.id === r.buildingId);
      const flr = floors.find((f: any) => f.id === r.floorId);
      const roomAssignments = activeAssignments.filter((a: any) => a.roomId === r.id);
      const cap = r.capacity || 1;
      const occ = roomAssignments.length;
      const availBeds = Math.max(0, cap - occ);

      const statusMap: Record<string, { ar: string; en: string }> = {
        available: { ar: "شاغرة (جاهزة)", en: "Vacant Clean" },
        dirty: { ar: "تحتاج تنظيف", en: "Vacant Dirty" },
        occupied: { ar: "مشغولة", en: "Occupied Clean" },
        occupied_dirty: { ar: "مشغولة (تحتاج تنظيف)", en: "Occupied Dirty" },
        occupied_vacation: { ar: "في إجازة", en: "On Vacation" },
        out_of_service: { ar: "خارج الخدمة", en: "Out of Service" },
        out_of_order: { ar: "معطلة", en: "Out of Order" },
        maintenance: { ar: "صيانة", en: "Maintenance" },
      };
      const stObj = statusMap[(r.status || "").toLowerCase()] || { ar: r.status || "", en: r.status || "" };

      return ar ? {
        "رقم الغرفة": r.roomNumber ?? "",
        "المبنى": bld?.name || r.building || "",
        "كود المبنى": bld?.code || "",
        "الدور / الطابق": flr ? `${flr.floorNumber}` : (r.floor ?? ""),
        "تصنيف الغرفة": r.classification ?? "",
        "نوع الغرفة": r.roomType || r.type || "",
        "أقصى سعة استيعابية": cap,
        "الإشغال الفعلي": occ,
        "الأسرة الشاغرة": availBeds,
        "نوع الأسرة": r.bedType ?? "",
        "حالة الغرفة التشغيلية": stObj.ar,
        "حالة النظافة": r.cleanlinessStatus === "dirty" ? "تحتاج تنظيف" : "نظيفة",
        "تخصيص الجنس": (r.gender === "female" || r.gender === "F") ? "إناث" : (r.gender === "male" || r.gender === "M") ? "ذكور" : "مشترك / غير محدد",
        "إطلالة الغرفة": r.view ?? "",
        "باب فاصل / متصلة": r.separatorDoor ? "نعم" : "لا",
        "المساحة (م2)": r.size || (r.sizeSqm ? `${r.sizeSqm}m²` : ""),
        "التجهيزات والمميزات": Array.isArray(r.featuresList)
          ? r.featuresList.join(", ")
          : (typeof r.features === "string" ? r.features : ""),
        "ملاحظات": r.notes ?? "",
      } : {
        "Room Number": r.roomNumber ?? "",
        "Building": bld?.name || r.building || "",
        "Building Code": bld?.code || "",
        "Floor": flr ? `${flr.floorNumber}` : (r.floor ?? ""),
        "Room Classification": r.classification ?? "",
        "Room Type": r.roomType || r.type || "",
        "Max Capacity": cap,
        "Current Occupancy": occ,
        "Available Beds": availBeds,
        "Bed Type": r.bedType ?? "",
        "Operational Status": stObj.en,
        "Cleanliness": r.cleanlinessStatus || "clean",
        "Gender Policy": r.gender || "Any",
        "View": r.view ?? "",
        "Connecting Door": r.separatorDoor ? "Yes" : "No",
        "Size (Sqm)": r.size || (r.sizeSqm ? `${r.sizeSqm}m²` : ""),
        "Features & Amenities": Array.isArray(r.featuresList)
          ? r.featuresList.join(", ")
          : (typeof r.features === "string" ? r.features : ""),
        "Notes": r.notes ?? "",
      };
    });

    // 2. Buildings Configuration Sheet
    const buildingRows = buildings.map((b: any) => {
      const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
      const bCapacity = bRooms.reduce((acc: number, r: any) => acc + (r.capacity || 1), 0);
      const bActiveAssignments = activeAssignments.filter((a: any) => {
        const room = rooms.find((r: any) => r.id === a.roomId);
        return room && room.buildingId === b.id;
      });
      const bOcc = bActiveAssignments.length;
      const bRate = bCapacity > 0 ? Math.round((bOcc / bCapacity) * 100) : 0;

      return ar ? {
        "اسم المبنى": b.name ?? "",
        "كود المبنى": b.code ?? "",
        "عدد الطوابق": b.floorsCount ?? floors.filter((f: any) => f.buildingId === b.id).length,
        "إجمالي الغرف": bRooms.length,
        "إجمالي الطاقة الاستيعابية": bCapacity,
        "الإشغال الفعلي": bOcc,
        "نسبة الإشغال": `${bRate}%`,
        "التخصيص": (b.gender === "female" || b.gender === "F") ? "إناث" : (b.gender === "male" || b.gender === "M") ? "ذكور" : "مشترك",
        "ملاحظات": b.notes ?? b.description ?? "",
      } : {
        "Building Name": b.name ?? "",
        "Building Code": b.code ?? "",
        "Floors Count": b.floorsCount ?? floors.filter((f: any) => f.buildingId === b.id).length,
        "Total Rooms": bRooms.length,
        "Total Capacity": bCapacity,
        "Current Occupancy": bOcc,
        "Occupancy Rate": `${bRate}%`,
        "Gender": b.gender ?? "Mixed",
        "Notes": b.notes ?? b.description ?? "",
      };
    });

    // 3. Beds Inventory & Detailed Occupancy Sheet
    const bedRows: any[] = [];
    rooms.forEach((r: any) => {
      const bld = buildings.find((b: any) => b.id === r.buildingId);
      const flr = floors.find((f: any) => f.id === r.floorId);
      const roomAssignments = activeAssignments.filter((a: any) => a.roomId === r.id);
      const cap = r.capacity || 1;

      for (let b = 1; b <= cap; b++) {
        const asgn = roomAssignments.find((a: any) => a.bedNumber === b || (cap === 1 && !a.bedNumber));
        const emp = asgn ? profiles.find((p: any) => p.id === asgn.profileId) : null;
        const occName = emp
          ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.firstNameAr || ""
          : (asgn?.profileName || "");
        const occCode = emp?.profileId || asgn?.profileCode || "";
        const isVac = asgn?.profileStatus === "VACATION" || emp?.status === "VACATION";

        bedRows.push(ar ? {
          "رقم الغرفة": r.roomNumber ?? "",
          "المبنى": bld?.name || r.building || "",
          "الطابق": flr ? `${flr.floorNumber}` : (r.floor ?? ""),
          "رقم السرير": `سرير ${b}`,
          "نوع السرير": r.bedType ?? "",
          "حالة السرير": !asgn ? "شاغر" : isVac ? "مقيم (في إجازة)" : "مشغول",
          "كود الموظف المقيم": occCode,
          "اسم الموظف المقيم": occName,
          "المسمى الوظيفي": emp?.jobTitle || emp?.jobTitleAr || asgn?.jobTitle || "",
          "القسم": emp?.department || emp?.departmentAr || asgn?.department || "",
          "تاريخ التسكين": asgn?.checkInDate ? String(asgn.checkInDate).split("T")[0] : "",
          "تاريخ الخروج المتوقع": asgn?.expectedCheckOutDate ? String(asgn.expectedCheckOutDate).split("T")[0] : "",
        } : {
          "Room Number": r.roomNumber ?? "",
          "Building": bld?.name || r.building || "",
          "Floor": flr ? `${flr.floorNumber}` : (r.floor ?? ""),
          "Bed Number": `Bed ${b}`,
          "Bed Type": r.bedType ?? "",
          "Bed Status": !asgn ? "Available" : isVac ? "Occupied (Vacation)" : "Occupied",
          "Occupant Code": occCode,
          "Occupant Name": occName,
          "Job Title": emp?.jobTitle || asgn?.jobTitle || "",
          "Department": emp?.department || asgn?.department || "",
          "Check-In Date": asgn?.checkInDate ? String(asgn.checkInDate).split("T")[0] : "",
          "Expected Check-Out": asgn?.expectedCheckOutDate ? String(asgn.expectedCheckOutDate).split("T")[0] : "",
        });
      }
    });

    const wsRooms = XLSX.utils.json_to_sheet(roomRows);
    const wsBuildings = XLSX.utils.json_to_sheet(buildingRows);
    const wsBeds = XLSX.utils.json_to_sheet(bedRows);

    XLSX.utils.book_append_sheet(wb, wsRooms, ar ? "كنفجريشن الغرف" : "Rooms");
    XLSX.utils.book_append_sheet(wb, wsBuildings, ar ? "كنفجريشن المباني" : "Buildings");
    XLSX.utils.book_append_sheet(wb, wsBeds, ar ? "جرد وتوزيع الأسرة" : "Beds Inventory");

    const fileName = getExportFileName(ar ? "تكوين_السكن_والغرف_الشامل" : "Housing_Configuration_Complete", "xlsx");
    XLSX.writeFile(wb, fileName);
    toast.success(ar ? "تم تصدير كنفجريشن السكن والغرف والأسرة بنجاح!" : "Housing configuration exported successfully!");
  };

  return (
    <div className="flex-1 w-full p-6 md:p-8 space-y-6">
      {/* ── HEADER & STATS ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar ? "إدارة السكن" : "Housing Management"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate module="housing" action="export">
            <Button
              variant="outline"
              onClick={exportHousingConfiguration}
              className="gap-1.5 text-xs font-semibold h-9 shadow-xs"
              title={ar ? "تصدير كنفجريشن المباني والغرف والأسرة بالكامل إلى Excel" : "Export Complete Housing & Rooms Configuration"}
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              {ar ? "تصدير كنفجريشن السكن (Excel)" : "Export Housing Config"}
            </Button>
          </PermissionGate>
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

      {/* Executive Command KPI Cards with Sparklines & Deltas */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardKpiCard
          title={ar ? "إجمالي المباني" : "Total Buildings"}
          value={isLoading ? "—" : buildings.length}
          sub={ar ? "مباني سكنية نشطة" : "Active residential buildings"}
          icon={Building}
          color="text-violet-600 dark:text-violet-400"
          bg="bg-violet-500/10"
          delta={{ value: "+1", isPositive: true }}
          sparklineData={[2, 3, 3, 4, 4, 5, buildings.length || 5]}
        />
        <DashboardKpiCard
          title={ar ? "إجمالي الغرف" : "Total Rooms"}
          value={isLoading ? "—" : totalRooms}
          sub={ar ? `سعة: ${totalBeds} سرير` : `Capacity: ${totalBeds} beds`}
          icon={MapPin}
          color="text-primary"
          bg="bg-primary/10"
          delta={{ value: "+2.4%", isPositive: true }}
          sparklineData={[65, 70, 72, 75, 78, 80, totalRooms || 80]}
        />
        <DashboardKpiCard
          title={ar ? "إشغال الغرف" : "Room Occupancy"}
          value={isLoading ? "—" : `${occPct}%`}
          sub={`${occupiedRooms} / ${totalRooms} ${ar ? "غرفة" : "rooms"} · ${occupiedBeds} ${ar ? "سرير" : "beds"}`}
          icon={Users}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          delta={{ value: `${occPct}%`, isPositive: occPct < 90, isNeutral: occPct === 0 }}
          sparklineData={[60, 62, 65, 68, 70, 72, occPct || 70]}
        />
        <DashboardKpiCard
          title={ar ? "الغرف المتاحة بالكامل" : "Available Rooms"}
          value={isLoading ? "—" : availableRooms}
          sub={`${freeBeds} ${ar ? "سرير شاغر للتسكين" : "vacant beds ready"}${partiallyOccupiedRooms > 0 ? ` · ${partiallyOccupiedRooms} ${ar ? "غرف بها أسرة" : "partial rooms"}` : ""}`}
          icon={BedDouble}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
          delta={{ value: "+3", isPositive: true }}
          sparklineData={[15, 18, 14, 16, 12, 10, availableRooms || 10]}
        />
      </div>

      {/* Live Room Readiness & Turnover Tracker */}
      <ReadinessTrackerBar
        totalRooms={totalRooms}
        available={availableRooms}
        occupied={occupiedRooms}
        dirty={dirtyRooms}
        maintenance={maintenanceRooms}
        cleanRate={cleanRate}
      />

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
