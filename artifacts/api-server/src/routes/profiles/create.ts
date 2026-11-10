import { Router } from "express";
import { withTenant, profilesTable, profileDocumentsTable } from "@workspace/db";
import { eq, or, SQL } from "drizzle-orm";
import { CreateProfileBody, GetProfileResponse } from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { ensureProfilePortalAccount } from "../../lib/portal-accounts.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { enrichProfileBilingual } from "../../lib/bilingual-translator.js";

const router: Router = Router();

router.post(
  "/profiles",
  requirePermission("profiles", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    if (req.body) {
      if (typeof req.body.propertyId === "string" && !isNaN(Number(req.body.propertyId))) {
        req.body.propertyId = Number(req.body.propertyId);
      } else if (!req.body.propertyId && propertyId) {
        req.body.propertyId = propertyId;
      }
      if (req.body.address === undefined || req.body.address === null) req.body.address = "";
      if (req.body.nationality === undefined || req.body.nationality === null) req.body.nationality = "";
      if (req.body.phone === undefined || req.body.phone === null) req.body.phone = "";
      if (typeof req.body.phone === "string") req.body.phone = req.body.phone.trim();
      if (req.body.level === undefined || req.body.level === null) {
        req.body.level = req.body.employmentType === "THIRD_PARTY" ? "طرف ثالث" : "";
      }
      if (req.body.department === undefined || req.body.department === null) {
        req.body.department = req.body.employmentType === "THIRD_PARTY" ? "Third Party" : "";
      }
      if (!req.body.gender) req.body.gender = "M";
      if (!req.body.hireDate) req.body.hireDate = new Date().toISOString().split("T")[0];
      if (req.body.contractEndDate === "") req.body.contractEndDate = null;
      if (req.body.dateOfBirth === "") delete req.body.dateOfBirth;
      if (!req.body.firstName && req.body.firstNameAr) req.body.firstName = req.body.firstNameAr;
      if (!req.body.lastName && req.body.lastNameAr) req.body.lastName = req.body.lastNameAr;
      if (req.body.employmentType === "THIRD_PARTY") {
        if (!req.body.department) req.body.department = "Third Party";
        if (!req.body.level) req.body.level = "طرف ثالث";
      }
    }

    const parsed = CreateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate profile ID, national ID, or phone ─────────────
    const existingEmp = await withTenant(propertyId, async (tenantDb) => {
      const conditions: SQL[] = [];
      if (parsed.data.profileId)
        conditions.push(eq(profilesTable.profileId, parsed.data.profileId));
      if (parsed.data.nationalId)
        conditions.push(eq(profilesTable.nationalId, parsed.data.nationalId));
      if (parsed.data.phone && parsed.data.phone.trim())
        conditions.push(eq(profilesTable.phone, parsed.data.phone.trim()));
      if (conditions.length === 0) return [];
      return await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
        })
        .from(profilesTable)
        .where(or(...conditions));
    });
    if (existingEmp.length > 0) {
      const existing = existingEmp[0];
      let reason = "Profile already exists";
      if (existing.profileId === parsed.data.profileId)
        reason = `كود الملف ${parsed.data.profileId} مسجل مسبقاً (Profile ID already exists)`;
      else if (existing.nationalId === parsed.data.nationalId)
        reason = `رقم الهوية ${parsed.data.nationalId} مسجل مسبقاً (National ID already exists)`;
      else if (parsed.data.phone && parsed.data.phone.trim() && existing.phone === parsed.data.phone.trim())
        reason = `رقم الهاتف ${parsed.data.phone} مسجل مسبقاً (Phone number already exists)`;
      res.status(409).json({ error: reason, code: "PROFILE_DUPLICATE" });
      return;
    }

    // ✅ الإضافة في الـ Schema الصحيح (الحالة تبدأ بـ UNASSIGNED وتتحدد بناءً على عمليات التسكين)
    const { idDocuments, status, ...profileData } = parsed.data as any;
    const enrichedData = enrichProfileBilingual(profileData);
    const [profile] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(profilesTable)
        .values({
          ...enrichedData,
          status: "UNASSIGNED",
        } as any)
        .returning();
    });

    if (idDocuments && idDocuments.length > 0) {
      await withTenant(propertyId, async (tenantDb) => {
        await tenantDb.insert(profileDocumentsTable).values(
          idDocuments.map((doc: any) => ({
            profileId: profile.id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileData: doc.fileData,
          }))
        );
      });
    }
    await ensureProfilePortalAccount(propertyId, profile.profileId);

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة موظف جديد: ${profile.firstName} ${profile.lastName}`,
      actionType: "CREATE",
      module: "profiles",
      entityType: "profile",
      entityId: profile.id,
      details: `ID: ${profile.profileId}, Dept: ${profile.department}`,
    });

    broadcastToProperty(propertyId, { module: "profiles", action: "created", entityId: profile.id });
    const safeCreated = {
      ...profile,
      propertyId,
      profileId: profile.profileId ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      nationalId: profile.nationalId ?? "",
      nationality: profile.nationality ?? "",
      address: profile.address ?? "",
      jobTitle: profile.jobTitle ?? "",
      level: profile.level ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      status: profile.status ?? "UNASSIGNED",
      hireDate: profile.hireDate ?? "",
      gender: profile.gender ?? "M",
    };
    const createdParse = GetProfileResponse.safeParse(safeCreated);
    res
      .status(201)
      .json(createdParse.success ? createdParse.data : safeCreated);
  },
);

export default router;
