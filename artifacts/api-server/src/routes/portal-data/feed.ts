import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import { maintenanceTable, propertiesTable, settingsTable, portalDocumentsTable, portalContactsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  getActivityStatuses,
  getPortalCategories,
} from "../../lib/portal-catalog.js";
import { portalSession } from "../portal-auth/shared.js";

const router: Router = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  res.json({ items: [], unreadCount: 0 }); // Placeholder until notification table logic is mapped
});

router.get("/alerts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const maintenance = await tenantDb
      .select()
      .from(maintenanceTable)
      .where(
        and(
          eq(maintenanceTable.reportedBy, String(sess.profileDbId)),
          inArray(maintenanceTable.status, ["open", "in_progress"]),
        ),
      );
    return {
      items: maintenance.map((m) => ({
        id: m.id,
        title: m.problemType || m.description || "Maintenance",
        status: m.status,
        type: "maintenance",
      })),
    };
  });
  res.json(result || { items: [] });
});

// ─── Portal Contacts (Multi-contact list) ──────────────────────
router.get("/my-contacts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const contacts = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(portalContactsTable)
      .orderBy(portalContactsTable.createdAt);
  });

  // Fallback to settings-based single contact if none configured
  if (contacts.length === 0) {
    const settings = await withTenant(sess.propertyId, async (tenantDb) => {
      const [s] = await tenantDb.select().from(settingsTable).limit(1);
      return s;
    });
    if (settings?.portalContactEmail || settings?.portalContactPhone) {
      res.json({
        success: true,
        contacts: [
          {
            id: 0,
            nameAr: "الموارد البشرية",
            nameEn: "HR",
            roleAr: "موارد بشرية",
            roleEn: "Human Resources",
            email: settings.portalContactEmail ?? null,
            phone: settings.portalContactPhone ?? null,
            extension: settings.portalContactExt ?? null,
          },
        ],
      });
      return;
    }
  }

  res.json({ success: true, contacts });
});

// ─── Portal Contacts (from property settings) — legacy kept for compatibility
router.get("/contacts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const settings = await withTenant(sess.propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s;
  });

  res.json({
    success: true,
    email: settings?.portalContactEmail ?? "hr@sunrise-housing.com",
    phone: settings?.portalContactPhone ?? "",
    extension: settings?.portalContactExt ?? "#4055",
  });
});

// ─── Support Contacts (HR 1 & 2, Housing Manager 1 & 2) ──────
router.get("/support-contacts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const [prop] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, sess.propertyId))
    .limit(1);

  const settings = await withTenant(sess.propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s;
  });

  const contacts = [
    {
      id: "hr_1",
      category: "hr",
      roleAr: "مدير الموارد البشرية",
      roleEn: "HR Manager",
      name: prop?.hrContact1Name || settings?.hrContact1Name || "",
      title: prop?.hrContact1Title || settings?.hrContact1Title || "",
      phone: prop?.hrContact1Phone || settings?.hrContact1Phone || "",
      email: prop?.hrContact1Email || settings?.hrContact1Email || "",
    },
    {
      id: "hr_2",
      category: "hr",
      roleAr: "مساعد مدير الموارد البشرية",
      roleEn: "Assistant HR Manager",
      name: prop?.hrContact2Name || settings?.hrContact2Name || "",
      title: prop?.hrContact2Title || settings?.hrContact2Title || "",
      phone: prop?.hrContact2Phone || settings?.hrContact2Phone || "",
      email: prop?.hrContact2Email || settings?.hrContact2Email || "",
    },
    {
      id: "mgr_1",
      category: "housing",
      roleAr: "مدير السكن",
      roleEn: "Housing Manager",
      name: prop?.housingManager1Name || settings?.housingManager1Name || "",
      title: prop?.housingManager1Title || settings?.housingManager1Title || "",
      phone: prop?.housingManager1Phone || settings?.housingManager1Phone || "",
      email: prop?.housingManager1Email || settings?.housingManager1Email || "",
    },
    {
      id: "mgr_2",
      category: "housing",
      roleAr: "مساعد مدير السكن",
      roleEn: "Assistant Housing Manager",
      name: prop?.housingManager2Name || settings?.housingManager2Name || "",
      title: prop?.housingManager2Title || settings?.housingManager2Title || "",
      phone: prop?.housingManager2Phone || settings?.housingManager2Phone || "",
      email: prop?.housingManager2Email || settings?.housingManager2Email || "",
    },
  ];

  res.json({
    success: true,
    contacts,
  });
});

// ─── Portal Documents ──────────────────────────
router.get("/documents", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const documents = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(portalDocumentsTable)
      .orderBy(desc(portalDocumentsTable.createdAt));
  });

  res.json({
    success: true,
    documents: documents.map((d) => ({
      id: d.id,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      fileName: d.fileName,
      fileType: d.fileType,
      fileData: d.fileData,
      category: d.category,
      createdAt:
        d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    })),
  });
});

// ─── Portal catalog (categories + activity statuses) ─────────
router.get("/catalog", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  res.json({
    success: true,
    activityCategories: getPortalCategories(sess.propertyId, "activities"),
    evaluationCategories: getPortalCategories(sess.propertyId, "evaluations"),
    activityStatuses: getActivityStatuses(),
  });
});

export default router;
