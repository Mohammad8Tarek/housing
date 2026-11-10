import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import { roomsTable, profilesTable, assignmentsTable, maintenanceTable, reservationsTable, hostingsTable, hostingCompanionsTable, workersTable, profileVacationsTable, buildingsTable, floorsTable, customReportTemplatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import { IdParams } from "../../validation/common.js";
import { CreateReportTemplateBody, CustomReportQueryBody, UpdateReportTemplateBody } from "../../validation/schemas.js";
import { getTenantId } from "../../lib/request-utils.js";
import { withTableFallback } from "../../lib/with-table-fallback.js";

const router: Router = Router();

// ─── CUSTOM REPORT BUILDER & CONFIGURATION ────────────────────────────────

// 1. GET /custom/templates - List saved templates
router.get("/custom/templates", requirePermission("reports", "view"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            return await tenantDb
              .select()
              .from(customReportTemplatesTable)
              .orderBy(desc(customReportTemplatesTable.updatedAt), desc(customReportTemplatesTable.id));
          });
        } else {
          return await db
            .select()
            .from(customReportTemplatesTable)
            .orderBy(desc(customReportTemplatesTable.updatedAt), desc(customReportTemplatesTable.id));
        }
      },
      []
    );
    res.json({ success: true, templates: result || [] });
  } catch (err) {
    next(err);
  }
});

// 2. POST /custom/templates - Create template
router.post("/custom/templates", requirePermission("reports", "create"), validate({ body: CreateReportTemplateBody }), async (req, res, next): Promise<any> => {
  try {
    const propertyId = getTenantId(req);
    const { name, nameEn, dataSource, columns, filters, layoutOptions } = req.body;
    if (!name || !dataSource) {
      return res.status(400).json({ success: false, message: "Name and dataSource are required" });
    }

    const payload = {
      propertyId: propertyId ? Number(propertyId) : null,
      name,
      nameEn: nameEn || null,
      dataSource,
      columns: columns || [],
      filters: filters || {},
      layoutOptions: layoutOptions || {},
      createdBy: (req as any).user?.id || null,
    };

    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            const [inserted] = await tenantDb
              .insert(customReportTemplatesTable)
              .values(payload)
              .returning();
            return inserted;
          });
        } else {
          const [inserted] = await db
            .insert(customReportTemplatesTable)
            .values(payload)
            .returning();
          return inserted;
        }
      },
      null
    );

    res.json({ success: true, template: result });
  } catch (err) {
    next(err);
  }
});

// 3. PUT /custom/templates/:id - Update template
router.put("/custom/templates/:id", requirePermission("reports", "edit"), validate({ params: IdParams, body: UpdateReportTemplateBody }), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    const { name, nameEn, dataSource, columns, filters, layoutOptions } = req.body;

    const payload: any = {
      updatedAt: new Date(),
    };
    if (name !== undefined) payload.name = name;
    if (nameEn !== undefined) payload.nameEn = nameEn;
    if (dataSource !== undefined) payload.dataSource = dataSource;
    if (columns !== undefined) payload.columns = columns;
    if (filters !== undefined) payload.filters = filters;
    if (layoutOptions !== undefined) payload.layoutOptions = layoutOptions;

    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            const [updated] = await tenantDb
              .update(customReportTemplatesTable)
              .set(payload)
              .where(eq(customReportTemplatesTable.id, id))
              .returning();
            return updated;
          });
        } else {
          const [updated] = await db
            .update(customReportTemplatesTable)
            .set(payload)
            .where(eq(customReportTemplatesTable.id, id))
            .returning();
          return updated;
        }
      },
      null
    );

    res.json({ success: true, template: result });
  } catch (err) {
    next(err);
  }
});

// 4. DELETE /custom/templates/:id - Delete template
router.delete("/custom/templates/:id", requirePermission("reports", "delete"), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);

    await withTableFallback(
      async () => {
        if (propertyId) {
          await withTenant(propertyId, async (tenantDb) => {
            await tenantDb
              .delete(customReportTemplatesTable)
              .where(eq(customReportTemplatesTable.id, id));
          });
        } else {
          await db
            .delete(customReportTemplatesTable)
            .where(eq(customReportTemplatesTable.id, id));
        }
      },
      null
    );

    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    next(err);
  }
});

// 5. POST /custom/query - Dynamic Report Query Engine
router.post("/custom/query", requirePermission("reports", "view"), validate({ body: CustomReportQueryBody }), async (req, res, next): Promise<any> => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      return res.status(400).json({ success: false, message: "propertyId required" });
    }

    const {
      dataSource = "in_house",
      columns = [],
      filters = {},
      page = 1,
      limit = 20,
      sortBy,
      sortOrder = "asc",
      fetchAll = false,
    } = req.body;

    const result = await withTableFallback(
      async () => {
        try {
          return await withTenant(propertyId, async (tenantDb) => {
            let rows: any[] = [];
          let totalCount = 0;
          let stats: any = {};

          const search = ((filters.search as string) || "").trim().toLowerCase();
          const buildingId = filters.buildingId && filters.buildingId !== "all" ? Number(filters.buildingId) : undefined;
          const floorId = filters.floorId && filters.floorId !== "all" ? Number(filters.floorId) : undefined;
          const department = filters.department && filters.department !== "all" ? String(filters.department).trim() : undefined;
          const jobLevel = filters.jobLevel && filters.jobLevel !== "all" ? String(filters.jobLevel).trim() : undefined;
          const gender = filters.gender && filters.gender !== "all" ? String(filters.gender).trim().toUpperCase() : undefined;
          const status = filters.status && filters.status !== "all" ? String(filters.status).trim() : undefined;
          const dateFrom = filters.dateFrom ? String(filters.dateFrom).trim() : undefined;
          const dateTo = filters.dateTo ? String(filters.dateTo).trim() : undefined;

          // ─── SOURCE: IN-HOUSE ───────────────────────────────────────────
          if (dataSource === "in_house") {
            const rawRows = await tenantDb
              .select({
                id: assignmentsTable.id,
                assignmentId: assignmentsTable.id,
                profileId: profilesTable.id,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                jobLevel: profilesTable.level,
                gender: profilesTable.gender,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
                company: profilesTable.companyName,
                nationality: profilesTable.nationality,
                profileStatus: profilesTable.status,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
                roomId: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                roomType: roomsTable.roomType,
                bedNumber: assignmentsTable.bedNumber,
                isEntireRoom: assignmentsTable.isEntireRoom,
                status: assignmentsTable.status,
                checkInDate: assignmentsTable.checkInDate,
                expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
                checkOutDate: assignmentsTable.checkOutDate,
                notes: assignmentsTable.notes,
                createdAt: assignmentsTable.createdAt,
              })
              .from(assignmentsTable)
              .innerJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .orderBy(desc(assignmentsTable.id));

            let filtered = rawRows.filter((r) => {
              if (status && status !== "all") {
                if ((r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              } else if (!filters.status || filters.status === "active") {
                if ((r.status || "").toUpperCase() !== "ACTIVE") return false;
              }
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(r.jobLevel ?? "").toLowerCase() !== String(jobLevel).toLowerCase()) return false;
              if (gender && (r.gender || "").toUpperCase() !== gender) return false;

              if (dateFrom) {
                const itemDate = r.checkInDate;
                if (itemDate && new Date(itemDate) < new Date(dateFrom)) return false;
              }
              if (dateTo) {
                const itemDate = r.checkInDate;
                if (itemDate && new Date(itemDate) > new Date(dateTo)) return false;
              }

              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  r.firstNameAr,
                  r.lastNameAr,
                  r.employeeId,
                  r.nationalId,
                  r.phone,
                  r.roomNumber,
                  r.buildingName,
                  r.department,
                  r.jobTitle,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            // Map computed fields
            rows = filtered.map((r, idx) => {
              const checkIn = r.checkInDate;
              let days = 0;
              if (checkIn) {
                const start = new Date(checkIn).getTime();
                const outDate = r.checkOutDate || r.expectedCheckOutDate;
                const end = outDate ? new Date(outDate).getTime() : Date.now();
                days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
              }
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                name: fullName,
                startDate: r.checkInDate,
                endDate: r.checkOutDate || r.expectedCheckOutDate,
                daysInHouse: days,
                stayDuration: `${days} يوم`,
              };
            });

            stats = {
              totalRecords: rows.length,
              activeCount: rows.filter((r) => r.status === "ACTIVE").length,
              distinctBuildings: new Set(rows.map((r) => r.buildingName).filter(Boolean)).size,
              distinctRooms: new Set(rows.map((r) => r.roomNumber).filter(Boolean)).size,
              distinctDepartments: new Set(rows.map((r) => r.department).filter(Boolean)).size,
            };
          }

          // ─── SOURCE: PROFILES ───────────────────────────────────────────
          else if (dataSource === "profiles") {
            const rawProfiles = await tenantDb
              .select({
                id: profilesTable.id,
                profileId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                level: profilesTable.level,
                gender: profilesTable.gender,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
                companyName: profilesTable.companyName,
                nationality: profilesTable.nationality,
                status: profilesTable.status,
                hireDate: profilesTable.hireDate,
                contractEndDate: profilesTable.contractEndDate,
                createdAt: profilesTable.createdAt,
              })
              .from(profilesTable)
              .orderBy(desc(profilesTable.id));

            // Fetch active assignments for profiles to display their room
            const activeAssignments = await tenantDb
              .select({
                profileId: assignmentsTable.profileId,
                roomNumber: roomsTable.roomNumber,
                buildingName: buildingsTable.name,
                buildingId: roomsTable.buildingId,
                floorId: roomsTable.floorId,
                bedNumber: assignmentsTable.bedNumber,
              })
              .from(assignmentsTable)
              .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .where(eq(assignmentsTable.status, "ACTIVE"));

            const assignmentMap = new Map<number, any>();
            activeAssignments.forEach((a) => {
              if (a.profileId) assignmentMap.set(a.profileId, a);
            });

            let filtered = rawProfiles.filter((p) => {
              const currentAssign = assignmentMap.get(p.id);
              if (status && status !== "all" && (p.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (p.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(p.level ?? "").toLowerCase() !== String(jobLevel).toLowerCase()) return false;
              if (gender && (p.gender || "").toUpperCase() !== gender) return false;
              if (buildingId && currentAssign?.buildingId !== buildingId) return false;
              if (floorId && currentAssign?.floorId !== floorId) return false;

              const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  p.firstNameAr,
                  p.lastNameAr,
                  p.profileId,
                  p.nationalId,
                  p.phone,
                  p.department,
                  p.jobTitle,
                  p.companyName,
                  currentAssign?.roomNumber,
                  currentAssign?.buildingName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((p, idx) => {
              const currentAssign = assignmentMap.get(p.id);
              const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...p,
                name: fullName,
                employeeId: p.profileId,
                jobLevel: p.level,
                company: p.companyName,
                roomNumber: currentAssign?.roomNumber || "غير مسكن",
                buildingName: currentAssign?.buildingName || "—",
                bedNumber: currentAssign?.bedNumber || "—",
                isHoused: !!currentAssign,
              };
            });

            stats = {
              totalRecords: rows.length,
              housedCount: rows.filter((r) => r.isHoused).length,
              unhousedCount: rows.filter((r) => !r.isHoused).length,
              distinctDepartments: new Set(rows.map((r) => r.department).filter(Boolean)).size,
            };
          }

          // ─── SOURCE: ROOMS (with In-House Occupants Mix Data) ───────────
          else if (dataSource === "rooms") {
            const rawRooms = await tenantDb
              .select({
                id: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
                roomType: roomsTable.roomType,
                capacity: roomsTable.capacity,
                currentOccupancy: roomsTable.currentOccupancy,
                status: roomsTable.status,
                gender: roomsTable.gender,
                view: roomsTable.view,
                bedType: roomsTable.bedType,
                classification: roomsTable.classification,
                notes: roomsTable.notes,
              })
              .from(roomsTable)
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .orderBy(buildingsTable.name, roomsTable.roomNumber);

            // Fetch active assignments for in-house mix data
            const activeAssignments = await tenantDb
              .select({
                roomId: assignmentsTable.roomId,
                bedNumber: assignmentsTable.bedNumber,
                checkInDate: assignmentsTable.checkInDate,
                profileId: profilesTable.id,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                phone: profilesTable.phone,
                nationality: profilesTable.nationality,
              })
              .from(assignmentsTable)
              .innerJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .where(eq(assignmentsTable.status, "ACTIVE"));

            const roomAssignMap = new Map<number, any[]>();
            activeAssignments.forEach((a) => {
              if (a.roomId) {
                if (!roomAssignMap.has(a.roomId)) roomAssignMap.set(a.roomId, []);
                roomAssignMap.get(a.roomId)!.push(a);
              }
            });

            let filtered = rawRooms.filter((r) => {
              const assigns = roomAssignMap.get(r.id) || [];
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (status && status !== "all") {
                const st = status.toLowerCase().trim();
                const occ = assigns.length || r.currentOccupancy || 0;
                const cap = r.capacity || 1;
                const vac = Math.max(0, cap - occ);
                const isOoo = ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes((r.status || "").toLowerCase());

                if (st === "room_vacant" || st === "available" || st === "vacant") {
                  // Fully vacant only: 0 occupants AND available/clean status
                  if (occ > 0 || isOoo || (r.status || "").toLowerCase() === "dirty") return false;
                } else if (st === "bed_vacant" || st === "vacant_beds" || st === "partially") {
                  // Rooms with vacant beds (partially occupied)
                  if (occ === 0 || vac <= 0 || isOoo) return false;
                } else if (st === "room_and_bed_vacant" || st === "both") {
                  // Room & Bed Vacant: any available capacity, not ooo or dirty
                  if (vac <= 0 || isOoo || (r.status || "").toLowerCase() === "dirty") return false;
                } else if (st === "occupied") {
                  if (occ === 0 && (r.status || "").toLowerCase() !== "occupied") return false;
                } else if (st === "dirty") {
                  if ((r.status || "").toLowerCase() !== "dirty") return false;
                } else {
                  if ((r.status || "").toLowerCase() !== st) return false;
                }
              }
              if (filters.gender && filters.gender !== "all" && (r.gender || "").toLowerCase() !== String(filters.gender).toLowerCase()) return false;
              if (filters.roomType && filters.roomType !== "all" && (r.roomType || "").toLowerCase() !== String(filters.roomType).toLowerCase()) return false;
              if (department && department !== "all") {
                const hasDept = assigns.some((a) => (a.department || "").toLowerCase() === department.toLowerCase());
                if (!hasDept) return false;
              }

              if (search) {
                const occNames = assigns.map((a) => [a.firstName, a.lastName].filter(Boolean).join(" ")).join(" ");
                const occDepts = assigns.map((a) => a.department || "").join(" ");
                const occJobs = assigns.map((a) => a.jobTitle || "").join(" ");
                const occIds = assigns.map((a) => a.employeeId || "").join(" ");
                const occPhones = assigns.map((a) => a.phone || "").join(" ");

                const haystack = [
                  r.roomNumber,
                  r.buildingName,
                  r.roomType,
                  r.status,
                  r.gender,
                  r.bedType,
                  r.view,
                  occNames,
                  occDepts,
                  occJobs,
                  occIds,
                  occPhones,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const assigns = roomAssignMap.get(r.id) || [];
              const cap = r.capacity || 0;
              const occ = assigns.length || r.currentOccupancy || 0;
              const vac = Math.max(0, cap - occ);
              const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;

              const occupantNames = assigns
                .map((a) => [a.firstName, a.lastName].filter(Boolean).join(" "))
                .filter(Boolean)
                .join("، ") || "—";

              const occupantDetails = assigns
                .map((a) => {
                  const n = [a.firstName, a.lastName].filter(Boolean).join(" ");
                  return a.bedNumber ? `${n} (سرير ${a.bedNumber})` : n;
                })
                .filter(Boolean)
                .join(" | ") || "—";

              const occupantDepartments = Array.from(
                new Set(assigns.map((a) => a.department).filter(Boolean)),
              ).join("، ") || "—";

              const occupantJobTitles = Array.from(
                new Set(assigns.map((a) => a.jobTitle).filter(Boolean)),
              ).join("، ") || "—";

              const occupantEmployeeIds = assigns
                .map((a) => a.employeeId)
                .filter(Boolean)
                .join("، ") || "—";

              const occupantPhones = assigns
                .map((a) => a.phone)
                .filter(Boolean)
                .join("، ") || "—";

              const occupantNationalities = Array.from(
                new Set(assigns.map((a) => a.nationality).filter(Boolean)),
              ).join("، ") || "—";

              const formatDMYString = (d: any) => {
                if (!d) return "";
                try {
                  const dt = new Date(d);
                  if (isNaN(dt.getTime())) return String(d);
                  const day = String(dt.getDate()).padStart(2, "0");
                  const month = String(dt.getMonth() + 1).padStart(2, "0");
                  const year = dt.getFullYear();
                  return `${day}/${month}/${year}`;
                } catch {
                  return String(d);
                }
              };

              const occupantCheckInDates = assigns
                .map((a) => formatDMYString(a.checkInDate))
                .filter(Boolean)
                .join("، ") || "—";

              return {
                index: idx + 1,
                ...r,
                occupiedBeds: occ,
                vacantBeds: vac,
                occupancyPct: `${pct}%`,
                cleanlinessStatus: r.status === "dirty" ? "dirty" : "clean",
                genderPolicy: r.gender || "all",
                // Mixed Resident Data
                occupants: assigns,
                occupantCount: assigns.length,
                occupantNames,
                occupantDetails,
                occupantDepartments,
                occupantJobTitles,
                occupantEmployeeIds,
                occupantPhones,
                occupantNationalities,
                occupantCheckInDates,
              };
            });

            const totalCap = rows.reduce((acc, r) => acc + (r.capacity || 0), 0);
            const totalOcc = rows.reduce((acc, r) => acc + (r.occupiedBeds || 0), 0);
            const totalVac = rows.reduce((acc, r) => acc + (r.vacantBeds || 0), 0);

            stats = {
              totalRooms: rows.length,
              totalCapacity: totalCap,
              totalOccupied: totalOcc,
              totalVacant: totalVac,
              overallOccupancyPct: totalCap > 0 ? `${Math.round((totalOcc / totalCap) * 100)}%` : "0%",
              occupiedRoomsCount: rows.filter((r) => (r.occupiedBeds || 0) > 0).length,
              vacantRoomsCount: rows.filter((r) => (r.occupiedBeds || 0) === 0).length,
            };
          }

          // ─── SOURCE: RESERVATIONS ───────────────────────────────────────
          else if (dataSource === "reservations") {
            const rawRes = await tenantDb
              .select({
                id: reservationsTable.id,
                firstName: reservationsTable.firstName,
                lastName: reservationsTable.lastName,
                profileCode: reservationsTable.profileCode,
                guestIdCardNumber: reservationsTable.guestIdCardNumber,
                guestPhone: reservationsTable.guestPhone,
                department: reservationsTable.department,
                jobTitle: reservationsTable.jobTitle,
                level: reservationsTable.level,
                gender: reservationsTable.gender,
                nationality: reservationsTable.nationality,
                companyName: reservationsTable.companyName,
                checkInDate: reservationsTable.checkInDate,
                checkOutDate: reservationsTable.checkOutDate,
                status: reservationsTable.status,
                roomType: reservationsTable.roomType,
                bedNumber: reservationsTable.bedNumber,
                notes: reservationsTable.notes,
                roomId: reservationsTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                createdAt: reservationsTable.createdAt,
              })
              .from(reservationsTable)
              .leftJoin(roomsTable, eq(reservationsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .orderBy(desc(reservationsTable.id));

            let filtered = rawRes.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.checkInDate && new Date(r.checkInDate) < new Date(dateFrom)) return false;
              if (dateTo && r.checkInDate && new Date(r.checkInDate) > new Date(dateTo)) return false;

              const guestName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  guestName,
                  r.profileCode,
                  r.department,
                  r.jobTitle,
                  r.guestPhone,
                  r.guestIdCardNumber,
                  r.roomNumber,
                  r.buildingName,
                  r.status,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              let nights = 0;
              if (r.checkInDate && r.checkOutDate) {
                const s = new Date(r.checkInDate).getTime();
                const e = new Date(r.checkOutDate).getTime();
                nights = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
              }
              const guestName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                guestName,
                name: guestName,
                employeeId: r.profileCode,
                jobLevel: r.level,
                company: r.companyName,
                phone: r.guestPhone,
                nationalId: r.guestIdCardNumber,
                nights,
              };
            });

            stats = {
              totalReservations: rows.length,
              pendingCount: rows.filter((r) => (r.status || "").toLowerCase() === "pending").length,
              confirmedCount: rows.filter((r) => (r.status || "").toLowerCase() === "confirmed").length,
              cancelledCount: rows.filter((r) => (r.status || "").toLowerCase() === "cancelled").length,
            };
          }

          // ─── SOURCE: MAINTENANCE ────────────────────────────────────────
          else if (dataSource === "maintenance") {
            const rawMnt = await tenantDb
              .select({
                id: maintenanceTable.id,
                ticketNumber: maintenanceTable.id,
                category: maintenanceTable.category,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                status: maintenanceTable.status,
                priority: maintenanceTable.priority,
                reportedBy: maintenanceTable.reportedBy,
                reportedAt: maintenanceTable.reportedAt,
                assignedTo: maintenanceTable.assignedTo,
                workerId: maintenanceTable.workerId,
                workerName: workersTable.name,
                resolvedAt: maintenanceTable.resolvedAt,
                rating: maintenanceTable.rating,
                ratingComment: maintenanceTable.ratingComment,
                roomId: maintenanceTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(workersTable, eq(maintenanceTable.workerId, workersTable.id))
              .orderBy(desc(maintenanceTable.id));

            let filtered = rawMnt.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (filters.priority && filters.priority !== "all" && (r.priority || "").toLowerCase() !== String(filters.priority).toLowerCase()) return false;
              if (filters.category && filters.category !== "all" && (r.category || "").toLowerCase() !== String(filters.category).toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (dateFrom && r.reportedAt && new Date(r.reportedAt) < new Date(dateFrom)) return false;
              if (dateTo && r.reportedAt && new Date(r.reportedAt) > new Date(dateTo)) return false;

              if (search) {
                const haystack = [
                  String(r.id),
                  r.problemType,
                  r.description,
                  r.category,
                  r.roomNumber,
                  r.buildingName,
                  r.reportedBy,
                  r.workerName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => ({
              index: idx + 1,
              ...r,
            }));

            stats = {
              totalTickets: rows.length,
              pendingCount: rows.filter((r) => ["pending", "open", "in_progress"].includes((r.status || "").toLowerCase())).length,
              resolvedCount: rows.filter((r) => ["resolved", "closed", "completed"].includes((r.status || "").toLowerCase())).length,
              urgentCount: rows.filter((r) => (r.priority || "").toLowerCase() === "urgent").length,
            };
          }

          // ─── SOURCE: VACATIONS ──────────────────────────────────────────
          else if (dataSource === "vacations") {
            const rawVac = await tenantDb
              .select({
                id: profileVacationsTable.id,
                profileId: profileVacationsTable.profileId,
                startDate: profileVacationsTable.startDate,
                endDate: profileVacationsTable.endDate,
                actualReturnDate: profileVacationsTable.actualReturnDate,
                notes: profileVacationsTable.notes,
                status: profileVacationsTable.status,
                createdAt: profileVacationsTable.createdAt,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                department: profilesTable.department,
                jobTitle: profilesTable.jobTitle,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
              })
              .from(profileVacationsTable)
              .innerJoin(profilesTable, eq(profileVacationsTable.profileId, profilesTable.id))
              .orderBy(desc(profileVacationsTable.id));

            let filtered = rawVac.filter((r) => {
              if (status && status !== "all" && (r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  r.employeeId,
                  r.department,
                  r.jobTitle,
                  r.phone,
                  r.status,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                name: fullName,
              };
            });

            stats = {
              totalVacations: rows.length,
              activeVacations: rows.filter((r) => (r.status || "").toUpperCase() === "ACTIVE").length,
              returnedVacations: rows.filter((r) => (r.status || "").toUpperCase() === "RETURNED").length,
              overdueVacations: rows.filter((r) => (r.status || "").toUpperCase() === "OVERDUE").length,
            };
          }

          // ─── SOURCE: HOSTINGS ───────────────────────────────────────────
          else if (dataSource === "hostings") {
            const rawHost = await tenantDb
              .select({
                id: hostingsTable.id,
                profileId: hostingsTable.profileId,
                hostingType: hostingsTable.hostingType,
                guestsCount: hostingsTable.guestsCount,
                startDate: hostingsTable.expectedFrom,
                endDate: hostingsTable.expectedTo,
                actualCheckIn: hostingsTable.actualCheckIn,
                actualCheckOut: hostingsTable.actualCheckOut,
                status: hostingsTable.status,
                notes: hostingsTable.notes,
                roomId: hostingsTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingName: buildingsTable.name,
                buildingId: roomsTable.buildingId,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                department: profilesTable.department,
                createdAt: hostingsTable.createdAt,
              })
              .from(hostingsTable)
              .leftJoin(profilesTable, eq(hostingsTable.profileId, profilesTable.id))
              .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .orderBy(desc(hostingsTable.id));

            const companions = await tenantDb.select().from(hostingCompanionsTable);
            const compMap = new Map<number, any>();
            companions.forEach((c) => {
              if (!compMap.has(c.hostingId)) compMap.set(c.hostingId, c);
            });

            let filtered = rawHost.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              const hostName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              const comp = compMap.get(r.id);
              if (search) {
                const haystack = [
                  comp?.name,
                  hostName,
                  r.employeeId,
                  comp?.idNumber,
                  comp?.relation,
                  r.roomNumber,
                  r.buildingName,
                  r.department,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const comp = compMap.get(r.id);
              return {
                index: idx + 1,
                ...r,
                hostName: [r.firstName, r.lastName].filter(Boolean).join(" "),
                guestName: comp?.name || "ضيف",
                relation: comp?.relation || "—",
                nationalId: comp?.idNumber || "—",
              };
            });

            stats = {
              totalHostings: rows.length,
              activeCount: rows.filter((r) => (r.status || "").toLowerCase() === "active").length,
              approvedCount: rows.filter((r) => (r.status || "").toLowerCase() === "approved").length,
            };
          }

          // Optional sorting
          if (sortBy) {
            rows.sort((a, b) => {
              let valA = a[sortBy] ?? "";
              let valB = b[sortBy] ?? "";
              if (typeof valA === "string") valA = valA.toLowerCase();
              if (typeof valB === "string") valB = valB.toLowerCase();
              if (valA < valB) return sortOrder === "asc" ? -1 : 1;
              if (valA > valB) return sortOrder === "asc" ? 1 : -1;
              return 0;
            });
          }

          totalCount = rows.length;

          // Pagination
          let paginatedRows = rows;
          if (!fetchAll) {
            const offset = (Number(page) - 1) * Number(limit);
            paginatedRows = rows.slice(offset, offset + Number(limit));
          }

          return {
            success: true,
            data: paginatedRows,
            total: totalCount,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(totalCount / Number(limit)) || 1,
            stats,
          };
        });
      } catch (err) {
        console.error("[POST /api/reports/custom/query error]:", err);
        throw err;
      }
    },
      {
        success: false,
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        stats: {},
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
