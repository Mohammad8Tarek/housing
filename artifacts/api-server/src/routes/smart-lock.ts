import { Router, Request, Response } from "express";
import { z } from "zod/v4";
import {
  db,
  withTenant,
  roomLocksTable,
  roomKeysTable,
  keyAuditLogTable,
  roomsTable,
  assignmentsTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";

import {
  issueCardViaHotek,
  checkoutViaHotek,
  getHotekStatus,
} from "../lib/pms-server.js";

const router = Router();

type HotekCardData = {
  roomNumber: string;
  checkIn: Date;
  checkOut: Date | null;
  cardType: string;
  ejectionType: string;
  user?: string;
  guestName?: string | null;
};

function getEncoder(
  propertyId: number,
  workstationId: string = "WS1",
  _type?: string,
) {
  return {
    isConnected: () => getHotekStatus(propertyId).connected,
    issueCard: async (cardData: HotekCardData) => {
      const result = await issueCardViaHotek(
        propertyId,
        cardData.roomNumber,
        cardData.guestName || cardData.user || "GUEST",
        false,
        workstationId,
        60000,
        cardData.checkOut?.toISOString() ?? null,
      );
      return {
        success: result.success,
        cardNumber: result.cardNumber,
        errorMessage: result.error,
        errorCode: result.success ? undefined : "HOTEK_SMART_ERROR",
      };
    },
    checkout: async (roomNumber: string) => {
      const result = await checkoutViaHotek(propertyId, roomNumber);
      return result;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ENCODER ENDPOINTS (IP + USB)
// ═══════════════════════════════════════════════════════════════

// ─── Encoder Status ───
router.get(
  "/encoder/status",
  requirePermission("smart_locks", "view"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = getTenantId(req);
      const status = getHotekStatus(propertyId);
      res.json({
        connected: status.connected,
        remoteAddress: status.remoteAddress,
        type: "smart",
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get encoder status" });
    }
  },
);

// ─── Connect to Encoder ───
router.post(
  "/encoder/connect",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = getTenantId(req);
      const status = getHotekStatus(propertyId);
      if (!status.connected) {
        res
          .status(503)
          .json({ error: "Hotek PMSServer not connected.", type: "smart" });
        return;
      }
      res.json({
        success: true,
        status: { connected: true, remoteAddress: status.remoteAddress },
        type: "smart",
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to connect to encoder", details: err.message });
    }
  },
);

// ─── Disconnect from Encoder ───
router.post(
  "/encoder/disconnect",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = getTenantId(req);
      const { disconnectHotekClient } = await import("../lib/pms-server.js");
      disconnectHotekClient(propertyId);
      res.json({
        success: true,
        type: "smart",
        note: "Disconnected Hotek PMSServer connection",
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to disconnect", details: err.message });
    }
  },
);

// ─── Read Card ───
router.post(
  "/encoder/read-card",
  requirePermission("smart_locks", "view"),
  async (req: Request, res: Response) => {
    res.status(400).json({
      error:
        "Read card not supported via Smart protocol. Use IP/USB encoder for read operations.",
    });
  },
);

// ─── Eject Card ───
router.post(
  "/encoder/eject",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    res.status(400).json({
      error:
        "Eject not supported via Smart protocol. Use IP/USB encoder for eject operations.",
    });
  },
);

// ─── Direct Encode (via encoder, no DB) ───
const DirectEncodeBody = z.object({
  type: z.enum(["smart"]).default("smart"),
  roomNumber: z.string().min(1),
  checkIn: z.string(),
  checkOut: z.string(),
  cardType: z
    .enum(["guest", "master", "floor", "building", "emergency", "lost"])
    .default("guest"),
  ejectionType: z.enum(["E", "R", "T"]).default("E"),
  user: z.string().optional(),
  workstation: z.string().optional().default("WS1"),
});

router.post(
  "/encoder/encode",
  requirePermission("smart_locks", "create"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = getTenantId(req);
      const parsed = DirectEncodeBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
        return;
      }

      try {
        const result = await issueCardViaHotek(
          propertyId,
          parsed.data.roomNumber,
          parsed.data.user || "GUEST",
          false,
          parsed.data.workstation || "WS1",
          60000,
          parsed.data.checkOut || null,
        );
        if (!result.success) {
          res
            .status(500)
            .json({ error: result.error || "Failed to encode card" });
          return;
        }
        res.json({ success: true, cardNumber: result.cardNumber });
        return;
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to encode card" });
        return;
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to process encode request" });
    }
  },
);

// ─── Smart Server: Issue Guest Key (stateless KR/KA protocol) ───
const SmartIssueBody = z.object({
  roomNumber: z.string().min(1),
  guestId: z.union([z.string(), z.number()]),
  guestName: z.string().optional(),
  arrivalDate: z.string(), // ISO string
  departureDate: z.string(), // ISO string
  checkOutTime: z.string().optional(), // e.g. "12:00"
  workstation: z.string().optional(),
  /** If true, also insert a key record in the DB */
  saveToDb: z.boolean().default(false),
  propertyId: z.number().optional(),
  roomId: z.number().optional(),
  assignmentId: z.number().optional(),
  cardType: z
    .enum(["guest", "master", "floor", "building", "emergency", "lost"])
    .default("guest"),
  notes: z.string().optional(),
});

router.post(
  "/encoder/smart/checkin-issue-key",
  requirePermission("smart_locks", "create"),
  async (req: Request, res: Response) => {
    try {
      const parsed = SmartIssueBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
        return;
      }

      const data = parsed.data;
      const propertyId = data.propertyId ?? getTenantId(req);
      const result = await issueCardViaHotek(
        propertyId,
        data.roomNumber,
        data.guestName || "GUEST",
        false,
        data.workstation || "WS1",
        60000,
      );
      if (!result.success) {
        res.status(500).json({ error: result.error || "Key issuance failed" });
        return;
      }

      const cardUid = result.cardNumber || "UNKNOWN";

      // Optionally save key record to DB
      let keyRecord = null;
      if (data.saveToDb && data.propertyId) {
        const propertyId = data.propertyId;

        keyRecord = await withTenant(propertyId, async (dbTx: any) => {
          const [key] = await dbTx
            .insert(roomKeysTable)
            .values({
              propertyId,
              assignmentId: data.assignmentId,
              roomId: data.roomId,
              cardNumber: cardUid,
              cardType: data.cardType,
              issuedBy: (req.session as any)?.userId
                ? Number((req.session as any).userId)
                : undefined,
              notes: data.notes,
              status: "active",
            })
            .returning();

          await dbTx.insert(keyAuditLogTable).values({
            propertyId,
            keyId: key.id,
            action: "issue",
            performedBy: (req.session as any)?.userId
              ? Number((req.session as any).userId)
              : undefined,
            cardNumber: cardUid,
            roomNumber: data.roomNumber,
            details: { method: "smart" },
          });

          return key;
        });

        // Broadcast
        const io = req.app.get("io");
        if (io) {
          io.to(`property:${propertyId}`).emit("keys:created", keyRecord);
        }
      }

      res.status(201).json({ success: true, cardUid, key: keyRecord });
    } catch (err: any) {
      if (
        err.message?.includes("Timeout") ||
        err.message?.includes("card on the reader")
      ) {
        res.status(408).json({
          error: "Encoder Timeout: Please place the card on the reader.",
        });
        return;
      }
      if (err.message?.includes("Unreachable")) {
        res.status(503).json({
          error: "Door Lock Server Unreachable. Check IT Network Status.",
        });
        return;
      }
      console.error("[Smart] checkin-issue-key error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to issue key via Smart server" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════
// LOCK MANAGEMENT (Database)
// ═══════════════════════════════════════════════════════════════

const CreateLockBody = z.object({
  roomId: z.number(),
  lockNumber: z.string().min(1),
  protocol: z.string().default("mifare"),
});

router.get(
  "/locks",
  requirePermission("smart_locks", "view"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.query.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const locks = await withTenant(propertyId, async (db: any) => {
        return db
          .select()
          .from(roomLocksTable)
          .where(eq(roomLocksTable.propertyId, propertyId));
      });

      res.json(locks);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch locks" });
    }
  },
);

router.post(
  "/locks",
  requirePermission("smart_locks", "create"),
  async (req: Request, res: Response) => {
    try {
      const parsed = CreateLockBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
        return;
      }

      const propertyId = Number(
        req.body.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const [lock] = await withTenant(propertyId, async (db: any) => {
        return db
          .insert(roomLocksTable)
          .values({ ...parsed.data, propertyId })
          .returning();
      });

      res.status(201).json(lock);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create lock" });
    }
  },
);

router.patch(
  "/locks/:id",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.body.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const { id } = req.params;
      const allowed = ["protocol", "status"];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
      }

      const [updated] = await withTenant(propertyId, async (db: any) => {
        return db
          .update(roomLocksTable)
          .set(updates)
          .where(eq(roomLocksTable.id, Number(id)))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Lock not found" });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update lock" });
    }
  },
);

// ═══════════════════════════════════════════════════════════════
// KEY MANAGEMENT (Database + Encoder)
// ═══════════════════════════════════════════════════════════════

const IssueKeyBody = z.object({
  roomId: z.number(),
  assignmentId: z.number().optional(),
  profileId: z.number().optional(),
  cardNumber: z.string().optional(),
  cardType: z
    .enum(["guest", "master", "floor", "building", "emergency", "lost"])
    .default("guest"),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
  /** If true, encode the card via the encoder before issuing */
  encodeCard: z.boolean().default(false),
  /** Encoder type is Smart Bridge only. IP/USB encoders are not used in this deployment. */
  encoderType: z.enum(["smart"]).default("smart"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  /** Ejection type: E=eject, R=retain, T=back eject */
  ejectionType: z.enum(["E", "R", "T"]).default("E"),
  isDuplicate: z.boolean().optional(),
  workstationId: z.string().optional().default("WS1"),
});

router.get(
  "/keys",
  requirePermission("smart_locks", "view"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.query.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;
      const status = req.query.status as string | undefined;

      const keys = await withTenant(propertyId, async (db: any) => {
        const conditions = [eq(roomKeysTable.propertyId, propertyId)];
        if (roomId) conditions.push(eq(roomKeysTable.roomId, roomId));
        if (status) conditions.push(eq(roomKeysTable.status, status));
        return db
          .select()
          .from(roomKeysTable)
          .where(and(...conditions))
          .orderBy(desc(roomKeysTable.issuedAt));
      });

      res.json(keys);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch keys" });
    }
  },
);

router.post(
  "/keys/issue",
  requirePermission("smart_locks", "create"),
  async (req: Request, res: Response) => {
    try {
      const parsed = IssueKeyBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.issues });
        return;
      }

      const propertyId = Number(
        req.body.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      let cardNumber = parsed.data.cardNumber;

      // ─── Fetch lock number (real room number like "201") and profile name ───
      const lockInfo = await withTenant(propertyId, async (dbTx: any) => {
        const [lock] = await dbTx
          .select()
          .from(roomLocksTable)
          .where(eq(roomLocksTable.roomId, parsed.data.roomId))
          .limit(1);
        if (lock) return { lockNumber: lock.lockNumber, lockId: lock.id };

        const [room] = await dbTx
          .select({ roomNumber: roomsTable.roomNumber })
          .from(roomsTable)
          .where(eq(roomsTable.id, parsed.data.roomId))
          .limit(1);
        return {
          lockNumber: room?.roomNumber ?? String(parsed.data.roomId),
          lockId: undefined,
        };
      });
      const realRoomNumber = lockInfo.lockNumber;
      const realLockId = lockInfo.lockId;

      // Fetch profile full name (for printing on card)
      let profileName: string | undefined;
      let profileJobNumber: string | undefined;
      const empId = parsed.data.profileId;
      if (empId) {
        const [emp] = await withTenant(propertyId, async (dbTx: any) => {
          return dbTx
            .select({
              firstName: profilesTable.firstName,
              lastName: profilesTable.lastName,
              profileId: profilesTable.profileId,
            })
            .from(profilesTable)
            .where(eq(profilesTable.id, empId))
            .limit(1);
        });
        if (emp) {
          profileName = `${emp.firstName} ${emp.lastName}`.trim();
          profileJobNumber = emp.profileId;
        }
      }

      // Fetch assignment dates if assignmentId provided and dates not passed
      let checkIn = parsed.data.checkIn;
      let checkOut = parsed.data.checkOut;
      if (parsed.data.assignmentId && (!checkIn || !checkOut)) {
        const [asgn] = await withTenant(propertyId, async (dbTx: any) => {
          return dbTx
            .select()
            .from(assignmentsTable)
            .where(eq(assignmentsTable.id, parsed.data.assignmentId!))
            .limit(1);
        });
        if (asgn) {
          checkIn = checkIn || asgn.checkInDate;
          checkOut = checkOut || asgn.expectedCheckOutDate || asgn.checkOutDate;
          if (!checkOut && asgn.profileId) {
            const [prof] = await withTenant(propertyId, async (dbTx: any) => {
              return dbTx
                .select({ contractEndDate: profilesTable.contractEndDate, employmentType: profilesTable.employmentType })
                .from(profilesTable)
                .where(eq(profilesTable.id, asgn.profileId))
                .limit(1);
            });
            if (prof?.contractEndDate && prof.employmentType !== "THIRD_PARTY") {
              checkOut = prof.contractEndDate;
            }
          }
        }
      }

      if (!checkOut && parsed.data.profileId) {
        const [prof] = await withTenant(propertyId, async (dbTx: any) => {
          return dbTx
            .select({ contractEndDate: profilesTable.contractEndDate, employmentType: profilesTable.employmentType })
            .from(profilesTable)
            .where(eq(profilesTable.id, parsed.data.profileId!))
            .limit(1);
        });
        if (prof?.contractEndDate && prof.employmentType !== "THIRD_PARTY") {
          checkOut = prof.contractEndDate;
        }
      }

      // If encodeCard is true, encode via the selected encoder type
      if (parsed.data.encodeCard && !cardNumber) {
        if (parsed.data.encoderType === "smart") {
          try {
            const result = await issueCardViaHotek(
              propertyId,
              realRoomNumber,
              profileName || "GUEST",
              parsed.data.isDuplicate || false,
              parsed.data.workstationId,
              60000,
              checkOut ? String(checkOut) : null,
              profileJobNumber,
            );
            if (!result.success || !result.cardNumber) {
              res.status(500).json({
                error: "Smart server failed to issue key",
                details: result.error,
              });
              return;
            }
            cardNumber = result.cardNumber;
          } catch (encodeErr: any) {
            res.status(500).json({
              error: "Smart card encoding failed",
              details: encodeErr.message,
            });
            return;
          }
        } else {
          // IP or USB encoder — uses CN command
          const encoder = getEncoder(
            propertyId,
            parsed.data.workstationId,
            parsed.data.encoderType,
          );
          if (!encoder.isConnected()) {
            res.status(400).json({
              error: `${String(parsed.data.encoderType).toUpperCase()} encoder not connected`,
            });
            return;
          } else {
            const cardData: HotekCardData = {
              roomNumber: realRoomNumber,
              checkIn: checkIn ? new Date(checkIn) : new Date(),
              checkOut: checkOut ? new Date(checkOut) : null,
              cardType: parsed.data.cardType,
              ejectionType: parsed.data.ejectionType,
              user:
                profileName ||
                ((req.session as any)?.userId
                  ? String((req.session as any).userId)
                  : undefined),
              guestName: profileName,
            };

            const encodeResult = await encoder.issueCard(cardData);
            if (!encodeResult.success) {
              res.status(500).json({
                error: "Failed to encode card",
                details: encodeResult.errorMessage,
                errorCode: encodeResult.errorCode,
              });
              return;
            }
            cardNumber = encodeResult.cardNumber;
          }
        }
      }

      // Insert the key record
      const [key] = await withTenant(propertyId, async (db: any) => {
        return db
          .insert(roomKeysTable)
          .values({
            propertyId,
            assignmentId: parsed.data.assignmentId,
            roomId: parsed.data.roomId,
            lockId: realLockId,
            profileId: parsed.data.profileId,
            cardNumber,
            cardType: parsed.data.cardType,
            issuedBy: (req.session as any)?.userId
              ? Number((req.session as any).userId)
              : undefined,
            expiresAt: parsed.data.expiresAt
              ? new Date(parsed.data.expiresAt)
              : undefined,
            notes: parsed.data.notes,
            status: "active",
          })
          .returning();
      });

      // Audit log
      await withTenant(propertyId, async (db: any) => {
        return db.insert(keyAuditLogTable).values({
          propertyId,
          keyId: key.id,
          action: "issue",
          performedBy: (req.session as any)?.userId
            ? Number((req.session as any).userId)
            : undefined,
          cardNumber,
          roomNumber: realRoomNumber,
          details: {
            cardType: parsed.data.cardType,
            encoded: parsed.data.encodeCard,
            encoderType: parsed.data.encoderType,
            profileName,
          },
        });
      });

      // Broadcast
      const io = req.app.get("io");
      if (io) {
        io.to(`property:${propertyId}`).emit("keys:created", key);
      }

      res.status(201).json(key);
    } catch (err: any) {
      console.error("[Keys] Issue error:", err);
      res.status(500).json({
        error: "Failed to issue key",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

router.post(
  "/keys/:id/revoke",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.body.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const { id } = req.params;
      const encoderType = req.body.type as string | undefined;

      const [key] = await withTenant(propertyId, async (db: any) => {
        return db
          .select()
          .from(roomKeysTable)
          .where(eq(roomKeysTable.id, Number(id)))
          .limit(1);
      });

      if (!key) {
        res.status(404).json({ error: "Key not found" });
        return;
      }
      if (key.status === "revoked") {
        res.status(400).json({ error: "Key already revoked" });
        return;
      }

      // ─── Get real room number for the encoder ───
      let realRoomNumber = key.roomId ? String(key.roomId) : "";
      if (key.roomId) {
        const lockInfo = await withTenant(propertyId, async (dbTx: any) => {
          const [lock] = await dbTx
            .select()
            .from(roomLocksTable)
            .where(eq(roomLocksTable.roomId, key.roomId))
            .limit(1);
          return lock || null;
        });
        if (lockInfo?.lockNumber) realRoomNumber = lockInfo.lockNumber;
      }

      // Revoke on the encoder (checkout the room using real room number)
      if (key.roomId) {
        try {
          const encoder = getEncoder(propertyId, encoderType);
          if (encoder.isConnected()) {
            await encoder.checkout(realRoomNumber);
          }
        } catch (encErr) {
          console.warn(
            "[Keys] Encoder revoke failed (continuing with DB revoke):",
            encErr,
          );
        }
      }

      const [updated] = await withTenant(propertyId, async (db: any) => {
        return db
          .update(roomKeysTable)
          .set({
            status: "revoked",
            revokedAt: new Date(),
            revokedBy: (req.session as any)?.userId
              ? Number((req.session as any).userId)
              : undefined,
          })
          .where(eq(roomKeysTable.id, Number(id)))
          .returning();
      });

      // Audit log
      await withTenant(propertyId, async (db: any) => {
        return db.insert(keyAuditLogTable).values({
          propertyId,
          keyId: key.id,
          action: "revoke",
          performedBy: (req.session as any)?.userId
            ? Number((req.session as any).userId)
            : undefined,
          cardNumber: key.cardNumber,
          roomNumber: realRoomNumber,
        });
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`property:${propertyId}`).emit("keys:revoked", updated);
      }

      res.json(updated);
    } catch (err: any) {
      console.error("[Keys] Revoke error:", err);
      res.status(500).json({ error: "Failed to revoke key" });
    }
  },
);

router.post(
  "/keys/:id/extend",
  requirePermission("smart_locks", "edit"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.body.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const { id } = req.params;
      const { expiresAt } = req.body;
      if (!expiresAt) {
        res.status(400).json({ error: "expiresAt required" });
        return;
      }

      const [updated] = await withTenant(propertyId, async (db: any) => {
        return db
          .update(roomKeysTable)
          .set({ expiresAt: new Date(expiresAt) })
          .where(eq(roomKeysTable.id, Number(id)))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Key not found" });
        return;
      }

      await withTenant(propertyId, async (db: any) => {
        return db.insert(keyAuditLogTable).values({
          propertyId,
          keyId: updated.id,
          action: "extend",
          performedBy: (req.session as any)?.userId
            ? Number((req.session as any).userId)
            : undefined,
          cardNumber: updated.cardNumber,
          details: { newExpiresAt: expiresAt },
        });
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to extend key" });
    }
  },
);

// ─── Audit Log ───
router.get(
  "/keys/audit",
  requirePermission("smart_locks", "view"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = Number(
        req.query.propertyId || (req.session as any)?.propertyId,
      );
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const logs = await withTenant(propertyId, async (db: any) => {
        return db
          .select()
          .from(keyAuditLogTable)
          .where(eq(keyAuditLogTable.propertyId, propertyId))
          .orderBy(desc(keyAuditLogTable.createdAt))
          .limit(200);
      });

      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  },
);

export default router;
