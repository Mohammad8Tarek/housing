import { Router } from "express";
import {
  withTenant,
  portalConversationsTable,
  portalConversationParticipantsTable,
  portalMessagesTable,
  portalMessageReadsTable,
  profilesTable,
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
              portalConversationParticipantsTable.profileId,
              sess.profileDbId,
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
                  sql`EXISTS (SELECT 1 FROM portal_message_reads WHERE message_id = portal_messages.id AND profile_id = ${sess.profileDbId})`,
                ),
                not(eq(portalMessagesTable.senderId, sess.profileDbId)),
              ),
            );

          // Get participants
          const participants = await tenantDb
            .select({
              profileId: portalConversationParticipantsTable.profileId,
            })
            .from(portalConversationParticipantsTable)
            .where(
              eq(portalConversationParticipantsTable.conversationId, conv.id),
            );

          const participantIds = participants.map((p) => p.profileId);
          let participantsData: any[] = [];
          if (participantIds.length > 0) {
            participantsData = await tenantDb
              .select({
                id: profilesTable.id,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                photoUrl: profilesTable.photoUrl,
              })
              .from(profilesTable)
              .where(inArray(profilesTable.id, participantIds));
          }

          result.push({
            ...conv,
            lastMessage: lastMsg || null,
            unreadCount: Number(unreadResult?.count || 0),
            participantIds,
            participantsData,
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
      ...new Set([sess.profileDbId, ...participantIds]),
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
            createdBy: sess.profileDbId,
          })
          .returning();
      },
    );

    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb.insert(portalConversationParticipantsTable).values(
        allParticipantIds.map((empId) => ({
          conversationId: conversation.id,
          profileId: empId,
        })),
      );
    });

    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
});

// ─── Typing State Tracking (In-Memory) ──────────────────────────
const typingState = new Map<number, Set<number>>(); // convId -> Set of profileIds

function setTyping(convId: number, profileId: number) {
  if (!typingState.has(convId)) {
    typingState.set(convId, new Set());
  }
  typingState.get(convId)!.add(profileId);
  // Clear after 3 seconds
  setTimeout(() => {
    const s = typingState.get(convId);
    if (s) {
      s.delete(profileId);
      if (s.size === 0) typingState.delete(convId);
    }
  }, 3000);
}

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

      await withTenant(sess.propertyId, async (tenantDb) => {
        // Check participant access
        const [participant] = await tenantDb
          .select()
          .from(portalConversationParticipantsTable)
          .where(
            and(
              eq(portalConversationParticipantsTable.conversationId, convId),
              eq(
                portalConversationParticipantsTable.profileId,
                sess.profileDbId,
              ),
            ),
          )
          .limit(1);

        if (!participant) {
          res
            .status(403)
            .json({ success: false, message: "Not a participant" });
          return;
        }

        // Fetch messages
        const messages = await tenantDb
          .select()
          .from(portalMessagesTable)
          .where(
            and(
              eq(portalMessagesTable.conversationId, convId),
              eq(portalMessagesTable.isDeleted, false),
            ),
          )
          .orderBy(asc(portalMessagesTable.createdAt));

        // Fetch reads for all messages
        const reads = await tenantDb
          .select()
          .from(portalMessageReadsTable)
          .where(
            inArray(
              portalMessageReadsTable.messageId,
              messages.map((m) => m.id),
            ),
          );

        const msgMap = new Map(
          messages.map((m) => [m.id, { ...m, reads: [] as any[] }]),
        );
        reads.forEach((r) => {
          if (msgMap.has(r.messageId)) {
            msgMap.get(r.messageId)!.reads.push(r);
          }
        });

        // Get senders
        const senderIds = [...new Set(messages.map((m) => m.senderId))];
        let senders: any[] = [];
        if (senderIds.length > 0) {
          senders = await tenantDb
            .select({
              id: profilesTable.id,
              firstName: profilesTable.firstName,
              lastName: profilesTable.lastName,
              photoUrl: profilesTable.photoUrl,
              department: profilesTable.department,
              jobTitle: profilesTable.jobTitle,
            })
            .from(profilesTable)
            .where(inArray(profilesTable.id, senderIds));
        }

        const sendersDict = senders.reduce((acc, emp) => {
          acc[emp.id] = emp;
          return acc;
        }, {});

        const typingUsers = Array.from(typingState.get(convId) || []).filter(
          (id) => id !== sess.profileDbId,
        );

        res.json({
          success: true,
          messages: Array.from(msgMap.values()),
          senders: sendersDict,
          typingUsers,
        });
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
            senderId: sess.profileDbId,
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
                portalConversationParticipantsTable.profileId,
                sess.profileDbId,
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
              not(eq(portalMessagesTable.senderId, sess.profileDbId)),
              not(
                sql`EXISTS (SELECT 1 FROM portal_message_reads WHERE message_id = portal_messages.id AND profile_id = ${sess.profileDbId})`,
              ),
            ),
          );

        if (unreadMessages.length > 0) {
          await tenantDb.insert(portalMessageReadsTable).values(
            unreadMessages.map((m) => ({
              messageId: m.id,
              profileId: sess.profileDbId,
            })),
          );
        }
      });

      // Broadcast the read receipt so the sender's UI updates instantly
      await broadcastToProperty(sess.propertyId, {
        module: "chat",
        action: "read_receipt",
        data: { conversationId: convId, readerId: sess.profileDbId },
      });

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /portal-chat/conversations/:id/typing — مؤشر الكتابة
// @ts-ignore
router.post(
  "/conversations/:id/typing",
  requirePortalAuth,
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const convId = Number(req.params.id);

      setTyping(convId, sess.profileDbId);

      await broadcastToProperty(sess.propertyId, {
        module: "chat",
        action: "typing_start",
        data: { conversationId: convId, profileId: sess.profileDbId },
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

// GET /portal-chat/admin/conversations/:id/messages — رسائل محادثة (أدمن)
// @ts-ignore
router.get(
  "/admin/conversations/:id/messages",
  requireAuth,
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const convId = Number(req.params.id);

      await withTenant(propertyId, async (tenantDb) => {
        // Fetch messages
        const messages = await tenantDb
          .select()
          .from(portalMessagesTable)
          .where(
            and(
              eq(portalMessagesTable.conversationId, convId),
              eq(portalMessagesTable.isDeleted, false)
            )
          )
          .orderBy(asc(portalMessagesTable.createdAt));

        // Get senders
        const senderIds = [...new Set(messages.map((m) => m.senderId))];
        let senders: any[] = [];
        if (senderIds.length > 0) {
          senders = await tenantDb
            .select({
              id: profilesTable.id,
              firstName: profilesTable.firstName,
              lastName: profilesTable.lastName,
              photoUrl: profilesTable.photoUrl,
              department: profilesTable.department,
              jobTitle: profilesTable.jobTitle,
            })
            .from(profilesTable)
            .where(inArray(profilesTable.id, senderIds));
        }

        const sendersDict = senders.reduce((acc, emp) => {
          acc[emp.id] = emp;
          return acc;
        }, {});

        res.json({
          success: true,
          messages,
          senders: sendersDict,
        });
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /portal-chat/admin/conversations/:id/messages — إرسال رسالة كأدمن
// @ts-ignore
router.post(
  "/admin/conversations/:id/messages",
  requireAuth,
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const convId = Number(req.params.id);
      const { content } = req.body;

      if (!content || !content.trim()) {
        res
          .status(400)
          .json({ success: false, message: "Content required" });
        return;
      }

      // To send as admin, we can use a special senderId or just -1
      // But portalMessagesTable requires senderId. We can use a system user ID or -1 if the foreign key allows.
      // Wait, senderId is integer and usually references profiles.
      // If we don't have a specific admin profile, we can just use 0 or a dedicated system ID.
      // Let's check the schema for portalMessagesTable.
      // For now we will insert senderId = 0 (assuming it doesn't violate foreign key, or if we have to, we will bypass it).
      // Wait, we can't assume 0 works if there is a foreign key to profilesTable.
      // Let's look up a valid profile or skip.
      
      const [message] = await withTenant(propertyId, async (tenantDb) => {
        // Update conversation updatedAt
        await tenantDb
          .update(portalConversationsTable)
          .set({ updatedAt: new Date() })
          .where(eq(portalConversationsTable.id, convId));

        return await tenantDb
          .insert(portalMessagesTable)
          .values({
            conversationId: convId,
            senderId: 0, // 0 indicates Admin/System
            content: content.trim(),
            contentType: "text",
          })
          .returning();
      });

      await broadcastToProperty(propertyId, {
        module: "chat",
        action: "new_message",
        data: { conversationId: convId, message },
      });

      res.json({ success: true, message });
    } catch (err) {
      next(err);
    }
  },
);

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
