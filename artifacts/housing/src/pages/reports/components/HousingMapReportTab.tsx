import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Building2,
  Layers,
  BedDouble,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  User,
  Home,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wrench,
  DoorOpen,
  LayoutGrid,
  ListTree,
  Table as TableIcon,
  Printer,
  Download,
  Filter,
  Sparkles,
  MapPin,
  Bed,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/loader";
import { printLuxuryReport } from "../utils/luxury-report-engine";

interface HousingMapReportTabProps {
  ar: boolean;
  activePropertyId?: number | null | string;
  properties?: any[];
  settings?: any;
  onRegisterExport?: (actions: { exportExcel?: () => void; exportPDF?: () => void }) => void;
}

export function HousingMapReportTab({
  ar,
  activePropertyId,
  properties = [],
  settings,
  onRegisterExport,
}: HousingMapReportTabProps) {
  const initialPropId =
    activePropertyId && activePropertyId !== "all"
      ? Number(activePropertyId)
      : properties[0]?.id || 1;

  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(initialPropId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"map" | "table">("map");
  const [expandedBuildings, setExpandedBuildings] = useState<Record<number, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState<string>("roomNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const getResidentInfo = (res: any, idx?: number) => {
    const name =
      res?.name ||
      res?.fullName ||
      res?.profile?.fullName ||
      res?.profile?.name ||
      (ar ? "مقيم" : "Resident");
    const code =
      res?.employeeNumber ||
      res?.profileCode ||
      res?.profile?.profileId ||
      res?.profile?.employeeNumber ||
      "-";
    const dept = res?.department || res?.profile?.department || "-";
    const job = res?.jobTitle || res?.profile?.jobTitle || "-";
    const gender = res?.gender || res?.profile?.gender || "-";
    const nationality = res?.nationality || res?.profile?.nationality || "-";
    const bedNum = res?.bedNumber ? String(res.bedNumber) : idx !== undefined ? String(idx + 1) : "1";
    return { name, code, dept, job, gender, nationality, bedNum };
  };

  const compareRooms = (a: any, b: any) => {
    let diff = 0;
    switch (sortBy) {
      case "roomNumber":
        diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
        break;
      case "buildingName":
        diff = String(a.buildingName || "").localeCompare(String(b.buildingName || ""));
        if (diff === 0) {
          diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
        }
        break;
      case "floor":
        diff = Number(a.floorNumber ?? 0) - Number(b.floorNumber ?? 0);
        if (diff === 0) {
          diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
        }
        break;
      case "occupancy": {
        const occA = a.occupiedCount ?? a.occupiedBeds ?? (a.residents?.length || 0);
        const occB = b.occupiedCount ?? b.occupiedBeds ?? (b.residents?.length || 0);
        diff = occA - occB;
        if (diff === 0) {
          diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
        }
        break;
      }
      case "status": {
        const stA = String(a.statusCategory || a.status || "");
        const stB = String(b.statusCategory || b.status || "");
        diff = stA.localeCompare(stB);
        if (diff === 0) {
          diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
        }
        break;
      }
      case "cleanliness": {
        const clA = String(a.cleanlinessStatus || "");
        const clB = String(b.cleanlinessStatus || "");
        diff = clA.localeCompare(clB);
        break;
      }
      case "residents": {
        const firstA = a.residents?.[0] ? getResidentInfo(a.residents[0]).name : "";
        const firstB = b.residents?.[0] ? getResidentInfo(b.residents[0]).name : "";
        diff = firstA.localeCompare(firstB);
        break;
      }
      default:
        diff = String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true });
    }
    return sortDir === "desc" ? -diff : diff;
  };

  // Sync selectedPropertyId if parent activePropertyId changes
  React.useEffect(() => {
    if (activePropertyId && activePropertyId !== "all") {
      setSelectedPropertyId(Number(activePropertyId));
    }
  }, [activePropertyId]);

  // Live Query
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["/api/dashboard/housing-breakdown", selectedPropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/housing-breakdown?propertyId=${selectedPropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch housing breakdown");
      return res.json();
    },
    refetchInterval: 20000,
    staleTime: 15000,
  });

  const housing = data?.housing;
  const rawBuildings = data?.buildings || [];
  const summary = data?.summary || {
    totalBuildings: rawBuildings.length,
    totalFloors: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    bedOccupancyRate: 0,
    roomOccupancyRate: 0,
  };

  // Expand all buildings by default when loaded
  React.useEffect(() => {
    if (rawBuildings.length > 0 && Object.keys(expandedBuildings).length === 0) {
      const bInit: Record<number, boolean> = {};
      const fInit: Record<number, boolean> = {};
      rawBuildings.forEach((b: any) => {
        bInit[b.id] = true;
        (b.floors || []).forEach((f: any) => {
          fInit[f.id] = true;
        });
      });
      setExpandedBuildings(bInit);
      setExpandedFloors(fInit);
    }
  }, [rawBuildings]);

  const toggleBuilding = (bId: number) => {
    setExpandedBuildings((prev) => ({ ...prev, [bId]: !prev[bId] }));
  };

  const toggleFloor = (fId: number) => {
    setExpandedFloors((prev) => ({ ...prev, [fId]: !prev[fId] }));
  };

  // Available floors based on selected building
  const availableFloors = useMemo(() => {
    if (selectedBuildingId === "all") {
      return rawBuildings.flatMap((b: any) =>
        (b.floors || []).map((f: any) => ({
          ...f,
          displayName: `${b.name} - ${f.name || `Floor ${f.floorNumber}`}`,
        })),
      );
    }
    const b = rawBuildings.find((x: any) => String(x.id) === selectedBuildingId);
    return (b?.floors || []).map((f: any) => ({
      ...f,
      displayName: f.name || `Floor ${f.floorNumber}`,
    }));
  }, [rawBuildings, selectedBuildingId]);

  // Filtered Buildings & Rooms
  const filteredBuildings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rawBuildings
      .filter((b: any) => {
        if (selectedBuildingId !== "all" && String(b.id) !== selectedBuildingId) return false;
        return true;
      })
      .map((b: any) => {
        const filteredFloors = (b.floors || [])
          .filter((f: any) => {
            if (selectedFloorId !== "all" && String(f.id) !== selectedFloorId) return false;
            return true;
          })
          .map((f: any) => {
            const filteredRooms = (f.rooms || []).filter((r: any) => {
              const occ = r.occupiedCount ?? r.occupiedBeds ?? (r.residents?.length || 0);
              const cap = r.capacity || 1;
              const avail = r.availableBeds ?? r.vacantBeds ?? Math.max(0, cap - occ);
              const stCat = r.statusCategory || (occ === 0 ? "available" : occ >= cap ? "occupied" : "partial");
              const clnSt = r.cleanlinessStatus || (String(r.status || "").includes("dirty") ? "dirty" : "clean");

              // Status filter
              if (statusFilter !== "all") {
                if ((statusFilter === "available" || statusFilter === "vacant") && stCat !== "available") return false;
                if (statusFilter === "occupied" && stCat !== "occupied") return false;
                if ((statusFilter === "partial" || statusFilter === "vacant_beds") && stCat !== "partial") return false;
                if (statusFilter === "dirty" && clnSt !== "dirty") return false;
                if (statusFilter === "maintenance" && stCat !== "maintenance") return false;
              }

              // Search query
              if (q) {
                const matchRoom = (r.roomNumber || "").toLowerCase().includes(q);
                const matchType = (r.roomType || "").toLowerCase().includes(q);
                const matchResident = (r.residents || []).some((res: any) => {
                  const info = getResidentInfo(res);
                  return (
                    info.name.toLowerCase().includes(q) ||
                    info.dept.toLowerCase().includes(q) ||
                    info.job.toLowerCase().includes(q) ||
                    info.code.toLowerCase().includes(q) ||
                    info.nationality.toLowerCase().includes(q)
                  );
                });
                if (!matchRoom && !matchType && !matchResident) return false;
              }

              return true;
            }).map((r: any) => {
              const occ = r.occupiedCount ?? r.occupiedBeds ?? (r.residents?.length || 0);
              const cap = r.capacity || 1;
              const avail = r.availableBeds ?? r.vacantBeds ?? Math.max(0, cap - occ);
              const stCat = r.statusCategory || (occ === 0 ? "available" : occ >= cap ? "occupied" : "partial");
              const clnSt = r.cleanlinessStatus || (String(r.status || "").includes("dirty") ? "dirty" : "clean");

              return {
                ...r,
                occupiedCount: occ,
                availableBeds: avail,
                statusCategory: stCat,
                cleanlinessStatus: clnSt,
                buildingName: b.name,
                buildingCode: b.code,
                floorName: f.name || `Floor ${f.floorNumber}`,
                floorNumber: f.floorNumber,
              };
            });

            // Sort rooms within each floor according to active sort settings
            const sortedRooms = [...filteredRooms].sort(compareRooms);

            return {
              ...f,
              rooms: sortedRooms,
              roomCount: sortedRooms.length,
            };
          })
          .filter((f: any) => f.rooms.length > 0 || (!q && statusFilter === "all"));

        return {
          ...b,
          floors: filteredFloors,
          totalFilteredRooms: filteredFloors.reduce((sum: number, f: any) => sum + f.rooms.length, 0),
        };
      })
      .filter((b: any) => b.totalFilteredRooms > 0 || (!q && statusFilter === "all" && selectedBuildingId === "all"));
  }, [rawBuildings, selectedBuildingId, selectedFloorId, statusFilter, searchQuery, sortBy, sortDir]);

  // Flat list of rooms for table view and export (sorted according to user selection)
  const flatRooms = useMemo(() => {
    const list: any[] = [];
    filteredBuildings.forEach((b: any) => {
      (b.floors || []).forEach((f: any) => {
        (f.rooms || []).forEach((r: any) => {
          list.push({
            ...r,
            buildingName: b.name,
            buildingCode: b.code,
            floorName: f.name || `Floor ${f.floorNumber}`,
            floorNumber: f.floorNumber,
          });
        });
      });
    });
    list.sort(compareRooms);
    return list;
  }, [filteredBuildings, sortBy, sortDir]);

  // Excel Export Handler
  const handleExportExcel = () => {
    const rows: any[] = [];

    flatRooms.forEach((r) => {
      const residents = r.residents || [];
      if (residents.length > 0) {
        residents.forEach((res: any, idx: number) => {
          const info = getResidentInfo(res, idx);
          rows.push({
            [ar ? "المبنى" : "Building"]: r.buildingName,
            [ar ? "الدور" : "Floor"]: r.floorName,
            [ar ? "رقم الغرفة" : "Room Number"]: r.roomNumber,
            [ar ? "نوع الغرفة" : "Room Type"]: r.roomType || (ar ? "عادية" : "Standard"),
            [ar ? "حالة الإشغال" : "Occupancy Status"]:
              r.statusCategory === "available"
                ? (ar ? "شاغرة" : "Vacant")
                : r.statusCategory === "occupied"
                ? (ar ? "مشغولة" : "Occupied")
                : r.statusCategory === "partial"
                ? (ar ? "إشغال جزئي" : "Partial")
                : (ar ? "صيانة" : "Out of Service"),
            [ar ? "حالة النظافة" : "Cleanliness"]:
              r.cleanlinessStatus === "clean"
                ? (ar ? "نظيفة" : "Clean")
                : r.cleanlinessStatus === "dirty"
                ? (ar ? "متسخة" : "Dirty")
                : (ar ? "مفتشة" : "Inspected"),
            [ar ? "سعة الأسرة" : "Bed Capacity"]: r.capacity,
            [ar ? "الأسرة المشغولة" : "Occupied Beds"]: r.occupiedCount,
            [ar ? "الأسرة الشاغرة" : "Available Beds"]: r.availableBeds,
            [ar ? "رقم السرير" : "Bed #"]: ar ? `سرير ${info.bedNum}` : `Bed ${info.bedNum}`,
            [ar ? "اسم الموظف / المقيم" : "Resident Name"]: info.name,
            [ar ? "كود الموظف" : "Employee Code"]: info.code,
            [ar ? "القسم" : "Department"]: info.dept,
            [ar ? "المسمى الوظيفي" : "Job Title"]: info.job,
            [ar ? "النوع" : "Gender"]: info.gender,
            [ar ? "الجنسية" : "Nationality"]: info.nationality,
          });
        });
      } else {
        rows.push({
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الدور" : "Floor"]: r.floorName,
          [ar ? "رقم الغرفة" : "Room Number"]: r.roomNumber,
          [ar ? "نوع الغرفة" : "Room Type"]: r.roomType || (ar ? "عادية" : "Standard"),
          [ar ? "حالة الإشغال" : "Occupancy Status"]: ar ? "شاغرة" : "Vacant",
          [ar ? "حالة النظافة" : "Cleanliness"]:
            r.cleanlinessStatus === "clean"
              ? (ar ? "نظيفة" : "Clean")
              : r.cleanlinessStatus === "dirty"
              ? (ar ? "متسخة" : "Dirty")
              : (ar ? "مفتشة" : "Inspected"),
          [ar ? "سعة الأسرة" : "Bed Capacity"]: r.capacity,
          [ar ? "الأسرة المشغولة" : "Occupied Beds"]: 0,
          [ar ? "الأسرة الشاغرة" : "Available Beds"]: r.capacity,
          [ar ? "رقم السرير" : "Bed #"]: "—",
          [ar ? "اسم الموظف / المقيم" : "Resident Name"]: ar ? "شاغر (لا يوجد مقيم)" : "Vacant",
          [ar ? "كود الموظف" : "Employee Code"]: "—",
          [ar ? "القسم" : "Department"]: "—",
          [ar ? "المسمى الوظيفي" : "Job Title"]: "—",
          [ar ? "النوع" : "Gender"]: "—",
          [ar ? "الجنسية" : "Nationality"]: "—",
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, ar ? "خريطة السكن" : "Housing Map");

    const currentPropName = properties.find((p) => p.id === selectedPropertyId)?.name || "Housing";
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Housing_Map_Report_${currentPropName}_${dateStr}.xlsx`);
  };

  // Print Luxury Opera PMS Report Handler
  const handlePrint = async (targetMode: "table" | "map" = viewMode) => {
    // Generate Rows for Opera PMS Data Table
    const tableRows: any[] = [];
    flatRooms.forEach((r) => {
      const residentsSummary =
        r.residents && r.residents.length > 0
          ? r.residents
              .map((res: any, idx: number) => {
                const info = getResidentInfo(res, idx);
                const codeStr = info.code !== "-" ? ` [${info.code}]` : "";
                const deptStr = info.dept !== "-" ? ` (${info.dept})` : "";
                return `${info.name}${codeStr}${deptStr} - سرير #${info.bedNum}`;
              })
              .join(" | ")
          : (ar ? "شاغرة بالكامل" : "Fully Vacant");

      const statusText =
        r.statusCategory === "available"
          ? (ar ? "شاغرة" : "Vacant")
          : r.statusCategory === "occupied"
          ? (ar ? "مشغولة" : "Occupied")
          : r.statusCategory === "partial"
          ? (ar ? "إشغال جزئي" : "Partial")
          : (ar ? "صيانة" : "Out of Service");

      const cleanlinessText =
        r.cleanlinessStatus === "clean"
          ? (ar ? "نظيفة" : "Clean")
          : r.cleanlinessStatus === "dirty"
          ? (ar ? "متسخة" : "Dirty")
          : (ar ? "مفتشة" : "Inspected");

      tableRows.push({
        [ar ? "المبنى" : "Building"]: r.buildingName,
        [ar ? "الدور" : "Floor"]: r.floorName,
        [ar ? "رقم الغرفة" : "Room Number"]: r.roomNumber,
        [ar ? "نوع الغرفة" : "Room Type"]: r.roomType || (ar ? "عادية" : "Standard"),
        [ar ? "حالة الإشغال" : "Occupancy Status"]: statusText,
        [ar ? "حالة النظافة" : "Cleanliness"]: cleanlinessText,
        [ar ? "سعة الأسرة" : "Capacity"]: r.capacity,
        [ar ? "الأسرة المشغولة" : "Occupied"]: r.occupiedCount,
        [ar ? "الأسرة الشاغرة" : "Available"]: r.availableBeds,
        [ar ? "المقيمين والنزلاء بالأسرة" : "Residents & Beds"]: residentsSummary,
      });
    });

    // If map mode: generate visual architectural HTML for customSectionsHtml
    let customSectionsHtml = "";
    if (targetMode === "map") {
      customSectionsHtml = `
        <div style="margin-bottom: 24px; font-family: inherit;">
          ${filteredBuildings
            .map((b: any) => {
              return `
                <div style="margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: #1e293b; color: #ffffff; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; font-weight: 700;">
                    <div>🏢 ${b.name} <span style="font-family: monospace; font-size: 7.5pt; opacity: 0.85;">(${b.code})</span></div>
                    <div style="font-size: 7.8pt; font-weight: 500;">
                      ${b.floors?.length || 0} ${ar ? "أدوار" : "Floors"} · 
                      ${b.totalFilteredRooms} ${ar ? "غرفة" : "Rooms"} · 
                      ${ar ? "الإشغال:" : "Occ:"} <span style="font-weight: 700; color: #38bdf8;">${b.occupancyRate || 0}%</span>
                    </div>
                  </div>
                  <div style="padding: 8px; background: #f8fafc;">
                    ${(b.floors || [])
                      .map((f: any) => {
                        return `
                          <div style="margin-bottom: 10px; border: 1px solid #e2e8f0; border-radius: 4px; background: #ffffff; overflow: hidden; page-break-inside: avoid;">
                            <div style="background: #f1f5f9; padding: 4px 8px; font-size: 7.8pt; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                              <span>📍 ${f.name || (ar ? `الدور ${f.floorNumber}` : `Floor ${f.floorNumber}`)}</span>
                              <span style="font-size: 7.2pt; color: #64748b;">${f.rooms?.length || 0} ${ar ? "غرف" : "rooms"}</span>
                            </div>
                            <div style="padding: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                              ${(f.rooms || [])
                                .map((room: any) => {
                                  const residents = room.residents || [];
                                  const isAvailable = room.statusCategory === "available";
                                  const isOccupied = room.statusCategory === "occupied";
                                  const isPartial = room.statusCategory === "partial";
                                  const bg = isAvailable ? "#f0fdf4" : isOccupied ? "#fefce8" : isPartial ? "#eff6ff" : "#fef2f2";
                                  const borderColor = isAvailable ? "#bbf7d0" : isOccupied ? "#fef08a" : isPartial ? "#bfdbfe" : "#fecaca";
                                  const statusName = isAvailable ? (ar ? "شاغرة" : "Vacant") : isOccupied ? (ar ? "مشغولة" : "Occupied") : isPartial ? (ar ? "جزئي" : "Partial") : (ar ? "صيانة" : "Maint");
                                  const cleanName = room.cleanlinessStatus === "clean" ? (ar ? "نظيفة" : "Clean") : room.cleanlinessStatus === "dirty" ? (ar ? "متسخة" : "Dirty") : (ar ? "مفتشة" : "Inspected");

                                  return `
                                    <div style="border: 1px solid ${borderColor}; background: ${bg}; border-radius: 4px; padding: 5px; font-size: 7pt; page-break-inside: avoid;">
                                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 0.5px solid rgba(0,0,0,0.08); padding-bottom: 2px;">
                                        <strong style="font-size: 7.8pt; font-family: monospace;">${room.roomNumber}</strong>
                                        <div style="display: flex; gap: 2px;">
                                          <span style="background: rgba(0,0,0,0.06); padding: 1px 3px; border-radius: 2px; font-size: 6.2pt; font-weight: 700;">${statusName}</span>
                                          <span style="background: rgba(0,0,0,0.06); padding: 1px 3px; border-radius: 2px; font-size: 6.2pt;">${cleanName}</span>
                                        </div>
                                      </div>
                                      <div style="font-size: 6.5pt; color: #475569; margin-bottom: 3px; display: flex; justify-content: space-between;">
                                        <span>${room.roomType || (ar ? "عادية" : "Standard")}</span>
                                        <span>${room.occupiedCount}/${room.capacity} ${ar ? "سرير" : "beds"}</span>
                                      </div>
                                      <div style="display: flex; flex-direction: column; gap: 2px;">
                                        ${residents.length > 0
                                          ? residents.map((res: any, rIdx: number) => {
                                              const info = getResidentInfo(res, rIdx);
                                              return `
                                                <div style="background: rgba(255,255,255,0.85); border: 0.5px solid rgba(0,0,0,0.1); border-radius: 3px; padding: 2px 4px; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">
                                                  <strong style="color: #0369a1;">#${info.bedNum}:</strong> 
                                                  <strong style="color: #0f172a;">${info.name}</strong> 
                                                  ${info.code !== "-" ? `<span style="color: #64748b; font-family: monospace;">[${info.code}]</span>` : ""}
                                                  ${info.dept !== "-" ? `<span style="color: #475569;">(${info.dept})</span>` : ""}
                                                </div>
                                              `;
                                            }).join("")
                                          : `<div style="font-style: italic; color: #94a3b8; font-size: 6.5pt; text-align: center; padding: 2px;">${ar ? "شاغرة (متاح للتسكين)" : "Vacant"}</div>`
                                        }
                                      </div>
                                    </div>
                                  `;
                                })
                                .join("")}
                            </div>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    const kpiCards = [
      { label: ar ? "إجمالي المباني" : "Buildings", labelAr: "إجمالي المباني", value: summary.totalBuildings, color: "blue" as const },
      { label: ar ? "إجمالي الأدوار" : "Floors", labelAr: "إجمالي الأدوار", value: summary.totalFloors, color: "blue" as const },
      { label: ar ? "إجمالي الغرف" : "Rooms", labelAr: "إجمالي الغرف", value: summary.totalRooms, color: "blue" as const },
      { label: ar ? "الغرف المشغولة" : "Occupied", labelAr: "الغرف المشغولة", value: summary.occupiedRooms, color: "orange" as const },
      { label: ar ? "الغرف الشاغرة" : "Vacant", labelAr: "الغرف الشاغرة", value: summary.availableRooms, color: "green" as const },
      { label: ar ? "نسبة إشغال الأسرة" : "Bed Occ.", labelAr: "نسبة إشغال الأسرة", value: `${summary.bedOccupancyRate}%`, color: "purple" as const },
    ];

    await printLuxuryReport({
      activeTab: "housing_map",
      titleAr: targetMode === "map" ? "تقرير خريطة السكن والمخطط المعماري" : "تقرير خريطة السكن وتوزيع الغرف والأسرة",
      title: targetMode === "map" ? "Housing Map & Architectural Layout Report" : "Housing Map & Room Structure Report",
      properties,
      propId: selectedPropertyId,
      activePropertyId: selectedPropertyId,
      settings,
      language: ar ? "ar" : "en",
      orientation: "landscape",
      showKpis: true,
      showSignatures: true,
      kpiCards,
      headers: [
        ar ? "المبنى" : "Building",
        ar ? "الدور" : "Floor",
        ar ? "رقم الغرفة" : "Room Number",
        ar ? "نوع الغرفة" : "Room Type",
        ar ? "حالة الإشغال" : "Occupancy Status",
        ar ? "حالة النظافة" : "Cleanliness",
        ar ? "سعة الأسرة" : "Capacity",
        ar ? "الأسرة المشغولة" : "Occupied",
        ar ? "الأسرة الشاغرة" : "Available",
        ar ? "المقيمين والنزلاء بالأسرة" : "Residents & Beds",
      ],
      rows: targetMode === "table" ? tableRows : [],
      customSectionsHtml: targetMode === "map" ? customSectionsHtml : undefined,
    });
  };

  React.useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport({
        exportExcel: handleExportExcel,
        exportPDF: () => handlePrint(viewMode === "table" ? "table" : "map"),
      });
    }
  }, [onRegisterExport, flatRooms, selectedPropertyId, ar, viewMode]);

  const getStatusBadge = (statusCategory: string, cleanlinessStatus?: string) => {
    switch (statusCategory) {
      case "available":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            {ar ? "شاغرة بالكامل" : "Vacant"}
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[10px] font-bold">
            {ar ? "إشغال جزئي" : "Partially Occupied"}
          </Badge>
        );
      case "occupied":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
            {ar ? "مشغولة بالكامل" : "Fully Occupied"}
          </Badge>
        );
      case "maintenance":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold">
            {ar ? "صيانة / خارج الخدمة" : "Out of Service"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {statusCategory}
          </Badge>
        );
    }
  };

  const getCleanlinessBadge = (cleanlinessStatus: string) => {
    switch (cleanlinessStatus) {
      case "clean":
        return (
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            {ar ? "نظيفة" : "Clean"}
          </Badge>
        );
      case "dirty":
        return (
          <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/30">
            {ar ? "متسخة" : "Dirty"}
          </Badge>
        );
      case "inspected":
        return (
          <Badge variant="outline" className="text-[9px] bg-sky-500/10 text-sky-600 border-sky-500/30">
            {ar ? "مفتشة" : "Inspected"}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Printable Header (Visible during Print only) */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">
              {ar ? "تقرير خريطة السكن وتوزيع الغرف والأسرة" : "Housing Map & Room Structure Report"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {properties.find((p) => p.id === selectedPropertyId)?.name || ""} · {ar ? "تاريخ الإصدار:" : "Generated on:"}{" "}
              {new Date().toLocaleString(ar ? "ar-EG" : "en-US")}
            </p>
          </div>
          <div className="text-right font-mono text-xs">
            <p>{ar ? "إجمالي الغرف:" : "Total Rooms:"} {summary.totalRooms}</p>
            <p>{ar ? "إجمالي الأسرة:" : "Total Beds:"} {summary.totalBeds} ({summary.occupiedBeds} {ar ? "مشغول" : "occ"})</p>
          </div>
        </div>
      </div>

      {/* Screen Header & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>{ar ? "خريطة وتفصيل السكن والمباني" : "Housing Map & Structure Report"}</span>
                {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "تقرير مرئي ومفصل لجميع المباني، الأدوار، الغرف، والأسرة مع تفاصيل المقيمين وحالات الإشغال"
                  : "Comprehensive visual directory and detailed map of all buildings, floors, rooms, and bed slots"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: View Toggle + Export + Print */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Property Selector for Super Admin */}
          {properties && properties.length > 1 && (
            <Select
              value={String(selectedPropertyId)}
              onValueChange={(val) => setSelectedPropertyId(Number(val))}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs font-semibold rounded-xl">
                <SelectValue placeholder={ar ? "اختر الفرع" : "Select Property"} />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
                viewMode === "map"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{ar ? "خريطة مرئية" : "Visual Map"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>{ar ? "جدول مفصل" : "Detailed Table"}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-9 w-9 p-0 rounded-xl"
            title={ar ? "تحديث البيانات" : "Refresh"}
          >
            <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin text-primary")} />
          </Button>
        </div>
      </div>

      {/* 6-Card Capacity Ribbon (Matching design) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Buildings */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "المباني" : "BUILDINGS"}
            </span>
            <span className="text-xl font-black text-foreground font-mono leading-tight">
              {summary.totalBuildings}
            </span>
          </div>
        </div>

        {/* 2. Floors */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "الأدوار" : "FLOORS"}
            </span>
            <span className="text-xl font-black text-foreground font-mono leading-tight">
              {summary.totalFloors}
            </span>
          </div>
        </div>

        {/* 3. Total Rooms */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Home className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "إجمالي الغرف" : "TOTAL ROOMS"}
            </span>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-xl font-black text-foreground font-mono">
                {summary.totalRooms}
              </span>
              <span className="text-xs font-semibold text-muted-foreground font-mono">
                ({summary.occupiedRooms} {ar ? "مشغولة" : "occ"})
              </span>
            </div>
          </div>
        </div>

        {/* 4. Bed Capacity */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <BedDouble className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "سعة الأسرة" : "BED CAPACITY"}
            </span>
            <span className="text-xl font-black text-foreground font-mono leading-tight">
              {summary.totalBeds}
            </span>
          </div>
        </div>

        {/* 5. Occupied Beds */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "الأسرة المشغولة" : "OCCUPIED BEDS"}
            </span>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {summary.occupiedBeds}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                ({summary.bedOccupancyRate}%)
              </span>
            </div>
          </div>
        </div>

        {/* 6. Vacant Beds */}
        <div className="bg-card border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {ar ? "الأسرة الشاغرة" : "VACANT BEDS"}
            </span>
            <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono leading-tight">
              {summary.availableBeds}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Hidden in Print) */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={ar ? "ابحث برقم الغرفة، اسم الموظف، القسم..." : "Search room, resident, department..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Building Filter */}
            <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl">
                <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {ar ? "جميع المباني" : "All Buildings"}
                </SelectItem>
                {rawBuildings.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Floor Filter */}
            <Select value={selectedFloorId} onValueChange={setSelectedFloorId}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl">
                <SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {ar ? "جميع الأدوار" : "All Floors"}
                </SelectItem>
                {availableFloors.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)} className="text-xs">
                    {f.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl">
                <SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{ar ? "جميع الحالات" : "All Statuses"}</SelectItem>
                <SelectItem value="available" className="text-xs">{ar ? "شاغرة بالكامل (جاهزة)" : "Fully Vacant Clean"}</SelectItem>
                <SelectItem value="partial" className="text-xs">{ar ? "أسِرّة شاغرة (مشغولة جزئياً)" : "Vacant Beds (Partially Occupied)"}</SelectItem>
                <SelectItem value="occupied" className="text-xs">{ar ? "مشغولة بالكامل" : "Fully Occupied"}</SelectItem>
                <SelectItem value="dirty" className="text-xs">{ar ? "تحتاج تنظيف" : "Dirty"}</SelectItem>
                <SelectItem value="maintenance" className="text-xs">{ar ? "صيانة / خارج الخدمة" : "Maintenance"}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sorting Controls */}
            <div className="flex items-center gap-1.5 ms-auto">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] h-9 text-xs rounded-xl bg-background font-semibold">
                  <ArrowUpDown className="w-3.5 h-3.5 me-1 text-muted-foreground" />
                  <SelectValue placeholder={ar ? "ترتيب حسب" : "Sort by"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roomNumber" className="text-xs">
                    {ar ? "رقم الغرفة" : "Room Number"}
                  </SelectItem>
                  <SelectItem value="buildingName" className="text-xs">
                    {ar ? "المبنى" : "Building"}
                  </SelectItem>
                  <SelectItem value="floor" className="text-xs">
                    {ar ? "الدور / الطابق" : "Floor"}
                  </SelectItem>
                  <SelectItem value="occupancy" className="text-xs">
                    {ar ? "نسبة / عدد الإشغال" : "Occupancy Rate"}
                  </SelectItem>
                  <SelectItem value="status" className="text-xs">
                    {ar ? "حالة الإشغال" : "Occupancy Status"}
                  </SelectItem>
                  <SelectItem value="cleanliness" className="text-xs">
                    {ar ? "حالة النظافة" : "Cleanliness"}
                  </SelectItem>
                  <SelectItem value="residents" className="text-xs">
                    {ar ? "اسم المقيم" : "Resident Name"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="h-9 px-2.5 rounded-xl border-border/60 hover:bg-muted font-bold text-xs"
                title={sortDir === "asc" ? (ar ? "ترتيب تصاعدي (اضغط للتنازلي)" : "Ascending (Click for DESC)") : (ar ? "ترتيب تنازلي (اضغط للتصاعدي)" : "Descending (Click for ASC)")}
              >
                {sortDir === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="text-[10px] font-mono ms-1">
                  {sortDir === "asc" ? (ar ? "تصاعدي" : "ASC") : (ar ? "تنازلي" : "DESC")}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <PageLoader />
        </div>
      ) : filteredBuildings.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold text-base text-foreground">
            {ar ? "لا توجد غرف تطابق شروط التصفية" : "No rooms match your filter criteria"}
          </p>
          <p className="text-xs mt-1">
            {ar ? "جرب تغيير مصطلح البحث أو اختيار مبنى/دور آخر" : "Try modifying your search query or building selection"}
          </p>
        </Card>
      ) : viewMode === "map" ? (
        /* Visual Map Hierarchy Mode */
        <div id="housing-map-visual" className="space-y-6">
          {filteredBuildings.map((building: any) => {
            const isBExpanded = expandedBuildings[building.id] !== false;

            return (
              <Card
                key={building.id}
                className="overflow-hidden border-border/70 shadow-sm bg-card/75 backdrop-blur-xs print:border print:shadow-none print:break-inside-avoid"
              >
                {/* Building Header */}
                <div
                  onClick={() => toggleBuilding(building.id)}
                  className="px-5 py-4 bg-muted/40 border-b border-border/60 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">{building.name}</h3>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {building.code}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {building.floors?.length || 0} {ar ? "أدوار" : "floors"} ·{" "}
                        {building.totalFilteredRooms} {ar ? "غرف مطابقة" : "matching rooms"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                      <span className="text-muted-foreground">
                        {ar ? "إشغال المبنى:" : "Occupancy:"}
                      </span>
                      <strong className="text-primary font-bold">{building.occupancyRate || 0}%</strong>
                    </div>
                    {isBExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Building Floors */}
                {isBExpanded && (
                  <CardContent className="p-5 space-y-6">
                    {(building.floors || []).map((floor: any) => {
                      const isFExpanded = expandedFloors[floor.id] !== false;

                      return (
                        <div
                          key={floor.id}
                          className="rounded-xl border border-border/50 bg-background/50 overflow-hidden print:border print:break-inside-avoid"
                        >
                          {/* Floor Sub-Header */}
                          <div
                            onClick={() => toggleFloor(floor.id)}
                            className="px-4 py-2.5 bg-muted/20 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-500" />
                              <span className="text-xs font-bold text-foreground">
                                {floor.name || `${ar ? "الدور" : "Floor"} ${floor.floorNumber}`}
                              </span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                                {floor.rooms?.length || 0} {ar ? "غرفة" : "rooms"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              {isFExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Room Cards Grid */}
                          {isFExpanded && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                              {(floor.rooms || []).map((room: any) => {
                                const residents = room.residents || [];

                                return (
                                  <div
                                    key={room.id}
                                    className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all space-y-2.5 print:break-inside-avoid"
                                  >
                                    {/* Room Card Header */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-mono font-bold text-xs">
                                          {room.roomNumber}
                                        </div>
                                        <div>
                                          <span className="text-xs font-bold text-foreground block leading-none">
                                            {room.roomNumber}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {room.roomType || (ar ? "عادية" : "Standard")}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        {getStatusBadge(room.statusCategory)}
                                        {getCleanlinessBadge(room.cleanlinessStatus)}
                                      </div>
                                    </div>

                                    {/* Bed Capacity Indicator */}
                                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-1.5">
                                      <span>{ar ? "سعة الأسرة:" : "Beds:"}</span>
                                      <span className="font-bold text-foreground">
                                        {room.occupiedCount} / {room.capacity} {ar ? "مشغول" : "occ"}
                                      </span>
                                    </div>

                                    {/* Bed Slots List */}
                                    <div className="space-y-1.5 pt-0.5">
                                      {Array.from({ length: room.capacity || 2 }).map((_, slotIdx) => {
                                        const resident = residents[slotIdx];

                                        if (resident) {
                                          const info = getResidentInfo(resident, slotIdx);
                                          return (
                                            <div
                                              key={slotIdx}
                                              className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 text-xs"
                                            >
                                              <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                <Bed className="w-3 h-3" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1">
                                                  <span className="font-bold text-foreground truncate text-[11px]">
                                                    {info.name}
                                                  </span>
                                                  <span className="text-[10px] font-mono text-muted-foreground font-semibold shrink-0">
                                                    #{info.bedNum}
                                                  </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                  {info.code !== "-" && <span className="font-mono me-1">[{info.code}]</span>}
                                                  {info.dept} {info.job !== "-" ? `· ${info.job}` : ""}
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div
                                            key={slotIdx}
                                            className="flex items-center gap-2 p-1.5 rounded-lg bg-background border border-dashed border-border/60 text-xs text-muted-foreground/60"
                                          >
                                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                                              <DoorOpen className="w-3 h-3 opacity-40" />
                                            </div>
                                            <span className="text-[11px] font-medium">
                                              {ar ? `سرير ${slotIdx + 1}: شاغر` : `Bed ${slotIdx + 1}: Vacant`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* Detailed Tabular View Mode */
        <div className="border border-border/70 rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th
                    onClick={() => toggleSort("buildingName")}
                    className="py-3 px-3 text-start cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "المبنى" : "Building"}</span>
                    {sortBy === "buildingName" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th
                    onClick={() => toggleSort("floor")}
                    className="py-3 px-3 text-start cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "الدور" : "Floor"}</span>
                    {sortBy === "floor" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th
                    onClick={() => toggleSort("roomNumber")}
                    className="py-3 px-3 text-start cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "رقم الغرفة" : "Room"}</span>
                    {sortBy === "roomNumber" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th className="py-3 px-3 text-start">{ar ? "النوع" : "Type"}</th>
                  <th
                    onClick={() => toggleSort("status")}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "الحالة" : "Status"}</span>
                    {sortBy === "status" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th
                    onClick={() => toggleSort("cleanliness")}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "النظافة" : "Clean"}</span>
                    {sortBy === "cleanliness" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th
                    onClick={() => toggleSort("occupancy")}
                    className="py-3 px-3 text-center cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "الأسرة" : "Beds"}</span>
                    {sortBy === "occupancy" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                  <th
                    onClick={() => toggleSort("residents")}
                    className="py-3 px-3 text-start cursor-pointer select-none hover:text-foreground transition-colors group"
                  >
                    <span>{ar ? "المقيمين والنزلاء بالأسرة" : "Residents & Beds"}</span>
                    {sortBy === "residents" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary inline ms-1" /> : <ArrowDown className="w-3 h-3 text-primary inline ms-1" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70 inline ms-1" />
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {flatRooms.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{r.buildingName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{r.floorName}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">{r.roomNumber}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{r.roomType || "-"}</td>
                    <td className="py-2.5 px-3 text-center">{getStatusBadge(r.statusCategory)}</td>
                    <td className="py-2.5 px-3 text-center">{getCleanlinessBadge(r.cleanlinessStatus)}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {r.occupiedCount} / {r.capacity}
                    </td>
                    <td className="py-2.5 px-3">
                      {r.residents && r.residents.length > 0 ? (
                        <div className="space-y-1">
                          {r.residents.map((res: any, idx: number) => {
                            const info = getResidentInfo(res, idx);
                            return (
                              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs">{info.name}</span>
                                {info.code !== "-" && (
                                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 rounded">
                                    [{info.code}]
                                  </span>
                                )}
                                {info.dept !== "-" && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 bg-slate-50 dark:bg-slate-900">
                                    {info.dept}
                                  </Badge>
                                )}
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                                  (سرير {info.bedNum})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic">{ar ? "شاغرة (لا يوجد مقيمين)" : "Vacant"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
