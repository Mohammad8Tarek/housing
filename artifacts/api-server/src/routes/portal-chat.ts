import { Router } from "express";
import {
  withTenant,
  portalConversationsTable,
  portalConversationParticipantsTable,
  portalMessagesTable,
  portalMessageReadsTable,
  employeesTable,
} from "@workspace/db";
import { eq, and, desc, asc, inArray, sql, not } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

// ─── CONVERSATIONS ──────────────────────────────────────────────

// GET /portal-chat/conversations — قائمة المحادثات
// @ts-ignore
router.get("/conversations", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const conversations = await withTenant(
      sess.propertyId,
      async (tenantDb) => {
        const participantRows = await tenantDb
          .select({
            conversationId: portalConversationParticipantsTable.conversationId,
          })
          .from(portalConversationParticipantsTable)
          .where(
            eq(
              portalConversationParticipantsTable.employeeId,
              sess.employeeDbId,
            ),
          );

        if (participantRows.length === 0) return [];

        const convIds = participantRows.map((r) => r.conversationId);
        const convs = await tenantDb
          .select()
          .from(portalConversationsTable)
          .where(
            and(
              eq(portalConversationsTable.propertyId, sess.propertyId),
              inArray(portalConversationsTable.id, convIds),
            ),
          )
          .orderBy(desc(portalConversationsTable.updatedAt));

        // Get last message + unread count per conversation
        const result = [];
        for (const conv of convs) {
          const [lastMsg] = await tenantDb
            .select()
            .from(portalMessagesTable)
            .where(
              and(
                eq(portalMessagesTable.conversationId, conv.id),
                eq(portalMessagesTable.isDeleted, false),
              ),
            )
            .orderBy(desc(portalMessagesTable.createdAt))
            .limit(1);

          const [unreadResult] = await tenantDb
            .select({ count: sql`COUNT(*)` })
            .from(portalMessagesTable)
            .where(
              and(
                eq(portalMessagesTable.conversationId, conv.id),
                eq(portalMessagesTable.isDeleted, false),
                not(
                  sql`EXISTS (SELECT 1 FROM portal_message_reads WHERE message_id = portal_messages.id AND employee_id = ${sess.employeeDbId})`,
                ),
                not(eq(portalMessagesTable.senderId, sess.employeeDbId)),
              ),
            );

          // Get participants
          const participants = await tenantDb
            .select({
              employeeId: portalConversationParticipantsTable.employeeId,
            })
            .from(portalConversationParticipantsTable)
            .where(
              eq(portalConversationParticipantsTable.conversationId, conv.id),
            );

          result.push({
            ...conv,
            lastMessage: lastMsg || null,
            unreadCount: Number(unreadResult?.count || 0),
            participantIds: participants.map((p) => p.employeeId),
          });
        }
        return result;
      },
    );
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

// POST /portal-chat/conversations — إنشاء محادثة جديدة
// @ts-ignore
router.post("/conversations", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { participantIds, subject } = req.body;
    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "participantIds required" });
    }

    const allParticipantIds = [
      ...new Set([sess.employeeDbId, ...participantIds]),
    ];
    const isGroup = allParticipantIds.length > 2;

    const [conversation] = await withTenant(
      sess.propertyId,
      async (tenantDb) => {
        return await tenantDb
          .insert(portalConversationsTable)
          .values({
            propertyId: sess.propertyId,
            subject: subject || null,
            isGroup,
            createdBy: sess.employeeDbId,
          })
          .returning();
      },
    );

    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb.insert(portalConversationParticipantsTable).values(
        allParticipantIds.map((empId) => ({
          conversationId: conversation.id,
          employeeId: empId,
        })),
      );
    });

    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
});

// ─── MESSAGES ───────────────────────────────────────────────────

// GET /portal-chat/conversations/:id/messages — رسائل المحادثة
// @ts-ignore
router.get(
  "/conversations/:id/messages",
  requirePortalAuth,
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const convId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const offset = Number(req.query.offset) || 0;

      const messages = await withTenant(sess.propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(portalMessagesTable)
          .where(
            and(
              eq(portalMessagesTable.conversationId, convId),
              eq(portalMessagesTable.isDeleted, false),
            ),
          )
          .orderBy(desc(portalMessagesTable.createdAt))
          .limit(limit)
          .offset(offset);
      });

      // Get employee names for senders
      const senderIds = [...new Set(messages.map((m) => m.senderId))];
      let employees: any[] = [];
      if (senderIds.length > 0) {
        employees = await withTenant(sess.propertyId, async (tenantDb) => {
          return await tenantDb
            .select({
              id: employeesTable.id,
              firstName: employeesTable.firstName,
              lastName: employeesTable.lastName,
              photoUrl: employeesTable.photoUrl,
            })
            .from(employeesTable)
            .where(inArray(employeesTable.id, senderIds));
        });
      }
      const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

      // Get read receipts
      const messageIds = messages.map((m) => m.id);
      let readReceipts: any[] = [];
      if (messageIds.length > 0) {
        readReceipts = await withTenant(sess.propertyId, async (tenantDb) => {
          return await tenantDb
            .select()
            .from(portalMessageReadsTable)
            .where(inArray(portalMessageReadsTable.messageId, messageIds));
        });
      }

      const readsByMsg: Record<number, any[]> = {};
      for (const r of readReceipts) {
        if (!readsByMsg[r.messageId]) readsByMsg[r.messageId] = [];
        readsByMsg[r.messageId].push(r);
      }

      const messagesWithReads = messages.map((m) => ({
        ...m,
        reads: readsByMsg[m.id] || [],
      }));

      res.json({
        success: true,
        messages: messagesWithReads.reverse(),
        senders: empMap,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /portal-chat/conversations/:id/messages — إرسال رسالة
// @ts-ignore
router.post(
  "/conversations/:id/messages",
  requirePortalAuth,
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const convId = Number(req.params.id);
      const { content, contentType } = req.body;
      if (!content || !content.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Content required" });
      }

      const [message] = await withTenant(sess.propertyId, async (tenantDb) => {
        // Update conversation updatedAt
        await tenantDb
          .update(portalConversationsTable)
          .set({ updatedAt: new Date() })
          .where(eq(portalConversationsTable.id, convId));
        // Insert message
        return await tenantDb
          .insert(portalMessagesTable)
          .values({
            conversationId: convId,
            senderId: sess.employeeDbId,
            content: content.trim(),
            contentType: contentType === "image" ? "image" : "text",
          })
          .returning();
      });

      // Broadcast via WebSocket using the standard data_updated event type
      await broadcastToProperty(sess.propertyId, {
        module: "chat",
        action: "new_message",
        data: { conversationId: convId, message },
      });

      return res.json({ success: true, message });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /portal-chat/conversations/:id/read — تحديث آخر قراءة
// @ts-ignore
router.put(
  "/conversations/:id/read",
  requirePortalAuth,
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const convId = Number(req.params.id);

      await withTenant(sess.propertyId, async (tenantDb) => {
        // Update lastReadAt on participant
        await tenantDb
          .update(portalConversationParticipantsTable)
          .set({ lastReadAt: new Date() })
          .where(
            and(
              eq(portalConversationParticipantsTable.conversationId, convId),
              eq(
                portalConversationParticipantsTable.employeeId,
                sess.employeeDbId,
              ),
            ),
          );

        // Mark all messages as read
        const unreadMessages = await tenantDb
          .select({ id: portalMessagesTable.id })
          .from(portalMessagesTable)
          .where(
            and(
              eq(portalMessagesTable.conversationId, convId),
              eq(portalMessagesTable.isDeleted, false),
              not(eq(portalMessagesTable.senderId, sess.employeeDbId)),
              not(
                sql`EXISTS (SELECT 1 FROM portal_message_reads WHERE message_id = portal_messages.id AND employee_id = ${sess.employeeDbId})`,
              ),
            ),
          );

        if (unreadMessages.length > 0) {
          await tenantDb.insert(portalMessageReadsTable).values(
            unreadMessages.map((m) => ({
              messageId: m.id,
              employeeId: sess.employeeDbId,
            })),
          );
        }
      });

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// ─── ADMIN: Moderation ──────────────────────────────────────────

// GET /portal-chat/admin/conversations — قائمة المحادثات (أدمن)
// @ts-ignore
router.get("/admin/conversations", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    const conversations = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalConversationsTable)
        .where(eq(portalConversationsTable.propertyId, propertyId))
        .orderBy(desc(portalConversationsTable.updatedAt));
    });
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

// DELETE /portal-chat/admin/messages/:id — حذف رسالة (moderation)
// @ts-ignore
router.delete("/admin/messages/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(portalMessagesTable)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(portalMessagesTable.id, id));
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /portal-chat/admin/stats — إحصائيات
// @ts-ignore
router.get("/admin/stats", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });
    const stats = await withTenant(propertyId, async (tenantDb) => {
      const [convCount] = await tenantDb
        .select({ count: sql`COUNT(*)` })
        .from(portalConversationsTable)
        .where(eq(portalConversationsTable.propertyId, propertyId));
      const [msgCount] = await tenantDb
        .select({ count: sql`COUNT(*)` })
        .from(portalMessagesTable);
      return {
        conversations: Number(convCount?.count || 0),
        totalMessages: Number(msgCount?.count || 0),
      };
    });
    res.json({ success: true, ...stats });
  } catch (err) {
    next(err);
  }
});

export default router;
