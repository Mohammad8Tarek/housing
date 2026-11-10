import { Router } from "express";
import { withTenant } from "@workspace/db";
import { profilesTable, profilePortalAccountsTable } from "@workspace/db";
import { eq, and, not, sql, or, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logActivity } from "../../lib/activity-logger.js";
import { ensureProfilePortalAccount } from "../../lib/portal-accounts.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { portalSession, requirePortalAuth } from "./shared.js";

const router: Router = Router();

// GET /profiles — دليل الموظفين (للمحادثة)
router.get("/profiles", requirePortalAuth, async (req, res, next): Promise<any> => {
  try {
    const sess = portalSession(req)!;
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const profiles = await withTenant(sess.propertyId, async (tenantDb) => {
      let query = tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
          photoUrl: profilesTable.photoUrl,
        })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.status, "ACTIVE"),
            not(eq(profilesTable.id, sess.profileDbId)),
          ),
        )
        .orderBy(profilesTable.firstName)
        .limit(50);

      return await query;
    });

    if (search) {
      return res.json({
        success: true,
        profiles: profiles.filter(
          (p: any) =>
            p.firstName?.toLowerCase().includes(search) ||
            p.lastName?.toLowerCase().includes(search) ||
            p.profileId?.toLowerCase().includes(search) ||
            p.department?.toLowerCase().includes(search),
        ),
      });
    }

    res.json({ success: true, profiles });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/reset-password",
  requirePermission("profiles", "reset_password"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        propertyId: z.number().int().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, propertyId } = parsed.data;
    const temporaryPassword = "1234";

    const profile = await withTenant(propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .limit(1);
      const temporaryHash = await bcrypt.hash(temporaryPassword, 12);

      if (!account) {
        await tenantDb.insert(profilePortalAccountsTable).values({
          profileId,
          passwordHash: temporaryHash,
          mustChangePassword: false,
        } as any);
      } else {
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            passwordHash: temporaryHash,
            mustChangePassword: false,
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      }
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, profileId))
        .limit(1);
      return emp;
    });

    if (profile) {
      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: adminUserId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `إعادة تعيين كلمة مرور الموظف: ${profile.firstName} ${profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: profile.id,
        details: "Temporary profile portal password generated",
      });
    }

    res.json({
      success: true,
      message: "Temporary password generated",
      temporaryPassword,
    });
  },
);

router.post(
  "/set-password",
  requirePermission("profiles", "reset_password"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        propertyId: z.number().int().positive(),
        newPassword: z.string().min(4),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, propertyId, newPassword } = parsed.data;

    const profile = await withTenant(propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .limit(1);
      const newHash = await bcrypt.hash(newPassword, 12);

      if (!account) {
        await tenantDb.insert(profilePortalAccountsTable).values({
          profileId,
          passwordHash: newHash,
          mustChangePassword: false,
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        } as any);
      } else {
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            passwordHash: newHash,
            mustChangePassword: false,
            failedAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      }
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, profileId))
        .limit(1);
      return emp;
    });

    if (profile) {
      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: adminUserId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `تعيين كلمة مرور جديدة للموظف: ${profile.firstName} ${profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: profile.id,
      });
    }

    res.json({ success: true, message: "Password set successfully" });
  },
);

// ─── GET /accounts — Admin: list all portal accounts with profile info ───────
router.get(
  "/accounts",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const propertyId =
      Number(req.query?.propertyId) || Number((req.session as any)?.propertyId);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId required" });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query?.limit || "15"), 10)));
    const search = req.query?.search ? String(req.query.search).trim() : "";
    const status = req.query?.status ? String(req.query.status).trim() : "";
    const profileIdParam = req.query?.profileId ? String(req.query.profileId).trim() : "";
    const isPaginated =
      req.query?.paginate === "true" ||
      req.query?.page !== undefined ||
      req.query?.limit !== undefined;

    const conditions: any[] = [];

    if (profileIdParam) {
      conditions.push(eq(profilesTable.profileId, profileIdParam));
    }

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(profilesTable.profileId, term),
          ilike(profilesTable.firstName, term),
          ilike(profilesTable.lastName, term),
          ilike(sql`CONCAT(${profilesTable.firstName}, ' ', ${profilesTable.lastName})`, term),
          ilike(profilesTable.department, term),
          ilike(profilesTable.jobTitle, term),
          ilike(profilesTable.phone, term),
          ilike(profilesTable.nationalId, term),
        ),
      );
    }

    if (status === "active") {
      conditions.push(eq(profilePortalAccountsTable.isActive, true));
    } else if (status === "inactive" || status === "disabled") {
      conditions.push(
        and(
          eq(profilePortalAccountsTable.isActive, false),
          sql`${profilePortalAccountsTable.id} IS NOT NULL`,
        ),
      );
    } else if (status === "no_account") {
      conditions.push(sql`${profilePortalAccountsTable.id} IS NULL`);
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      // 1. Total matching current filters
      let countQuery = tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(profilesTable)
        .leftJoin(
          profilePortalAccountsTable,
          eq(profilesTable.profileId, profilePortalAccountsTable.profileId),
        );

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as any;
      }
      const countRes = await countQuery;
      const total = Number(countRes[0]?.count ?? 0);

      // 2. Total active accounts overall for this property
      const [activeRes] = await tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(profilesTable)
        .innerJoin(
          profilePortalAccountsTable,
          eq(profilesTable.profileId, profilePortalAccountsTable.profileId),
        )
        .where(eq(profilePortalAccountsTable.isActive, true));
      const activeCount = Number(activeRes?.count ?? 0);

      // 3. Paginated Data Query
      let dataQuery = tenantDb
        .select({
          profileId: profilesTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
          status: profilesTable.status,
          isActive: profilePortalAccountsTable.isActive,
          lastLoginAt: profilePortalAccountsTable.lastLoginAt,
          mustChangePassword: profilePortalAccountsTable.mustChangePassword,
          failedAttempts: profilePortalAccountsTable.failedAttempts,
          lockedUntil: profilePortalAccountsTable.lockedUntil,
          hasAccount: profilePortalAccountsTable.id,
        })
        .from(profilesTable)
        .leftJoin(
          profilePortalAccountsTable,
          eq(profilesTable.profileId, profilePortalAccountsTable.profileId),
        );

      if (conditions.length > 0) {
        dataQuery = dataQuery.where(and(...conditions)) as any;
      }

      dataQuery = dataQuery.orderBy(profilesTable.firstName, profilesTable.lastName) as any;

      if (isPaginated) {
        dataQuery = dataQuery.limit(limit).offset((page - 1) * limit) as any;
      }

      const rows = await dataQuery;

      const accounts = rows.map((r) => ({
        profileId: r.profileId,
        profileName:
          r.firstName && r.lastName
            ? `${r.firstName} ${r.lastName}`
            : r.profileId,
        department: r.department ?? "",
        jobTitle: r.jobTitle ?? "",
        profileStatus: r.status ?? "",
        hasAccount: Boolean(r.hasAccount),
        isActive: r.hasAccount ? (r.isActive ?? false) : false,
        lastLoginAt:
          r.lastLoginAt instanceof Date
            ? r.lastLoginAt.toISOString()
            : (r.lastLoginAt ?? null),
        mustChangePassword: r.mustChangePassword ?? false,
        failedAttempts: r.failedAttempts ?? 0,
        isLocked: r.lockedUntil ? new Date(r.lockedUntil) > new Date() : false,
      }));

      return {
        accounts,
        total,
        activeCount,
        page: isPaginated ? page : 1,
        limit: isPaginated ? limit : total,
        totalPages: isPaginated ? Math.ceil(total / limit) : 1,
      };
    });

    res.json(result);
  },
);

// ─── POST /toggle-access — Admin: enable or disable an profile's portal access ─
router.post(
  "/toggle-access",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        isActive: z.boolean(),
        propertyId: z.number().int().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, isActive, propertyId: bodyPropertyId } = parsed.data;

    const propertyId =
      bodyPropertyId || Number((req.session as any)?.propertyId);

    if (isActive) {
      await ensureProfilePortalAccount(propertyId, profileId);
    }

    const [account] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(profilePortalAccountsTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .returning();
    });

    if (!account) {
      res
        .status(404)
        .json({ success: false, message: "Portal account not found" });
      return;
    }

    await logActivity({
      req,
      propertyId,
      username: (req.session as any)?.username ?? "admin",
      userId: adminUserId,
      userRole: (req.session as any)?.userRole ?? "admin",
      action: `${isActive ? "تفعيل" : "تعطيل"} صلاحية بوابة الموظف: ${profileId}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: account.id,
    });

    res.json({ success: true, isActive, profileId });
  },
);

/**
 * GET /portal-auth/employees
 * Search colleagues for chat & employee directory
 */
router.get("/employees", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const search = ((req.query.search as string) || "").trim();

    const employees = await withTenant(sess.propertyId, async (tenantDb) => {
      const baseSelect = tenantDb
        .select({
          id: profilesTable.id,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
          photoUrl: profilesTable.photoUrl,
          profileId: profilesTable.profileId,
          status: profilesTable.status,
        })
        .from(profilesTable);

      const excludeSelfAndLeft = and(
        not(eq(profilesTable.id, sess.profileDbId)),
        not(sql`UPPER(${profilesTable.status}) IN ('LEFT', 'TERMINATED', 'DEPARTED')`),
      );

      if (search) {
        const term = `%${search}%`;
        return await baseSelect
          .where(
            and(
              excludeSelfAndLeft,
              or(
                ilike(profilesTable.firstName, term),
                ilike(profilesTable.lastName, term),
                ilike(profilesTable.profileId, term),
                ilike(profilesTable.nationalId, term),
                ilike(profilesTable.department, term),
                ilike(profilesTable.jobTitle, term),
                sql`CONCAT(${profilesTable.firstName}, ' ', ${profilesTable.lastName}) ILIKE ${term}`,
                sql`CONCAT(${profilesTable.firstName}, ' ', ${profilesTable.thirdName}, ' ', ${profilesTable.lastName}) ILIKE ${term}`,
              ),
            ),
          )
          .limit(50);
      }

      // Default: list active colleagues in the same property
      return await baseSelect
        .where(excludeSelfAndLeft)
        .limit(50);
    });

    res.json({ success: true, employees });
  } catch (err: any) {
    console.error("[portal-auth/employees] Error:", err);
    res.status(500).json({ success: false, message: "Internal error" });
  }
});

export default router;
