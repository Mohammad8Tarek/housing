import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../lib/activity-logger.js";
import { z } from "zod/v4";

const router: Router = Router();

// All signature routes require an authenticated session.
// (Previously su() silently produced userId=undefined for anonymous callers.)
router.use((req, res, next) => {
  if (!Number((req.session as any)?.userId)) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  next();
});

const SIGNATURE_DATA_RE = /^data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+/=]+$/i;
const MAX_SIGNATURE_LENGTH = 5 * 1024 * 1024; // 5MB as base64 string to allow higher-res PNGs

const UploadSignatureBody = z.object({
  signatureImage: z.string().min(1, "Signature image is required"),
});

function su(req: any) {
  const s = req.session ?? {};
  return {
    userId: s.userId,
    propertyId: s.propertyId,
    username: s.username,
    userRole: Array.isArray(s.userRole) ? s.userRole[0] : s.userRole || "",
    isSystemAdmin: !!s.isSystemAdmin,
  };
}

router.get("/users/me/signature", async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const rows = await pool.query(
      "SELECT signature_image_url, uploaded_at FROM public.user_signatures WHERE user_id = $1",
      [user.userId],
    );
    if (rows.rows.length === 0) {
      res.json({ signatureImageUrl: null, uploadedAt: null });
      return;
    }
    res.json({
      signatureImageUrl: rows.rows[0].signature_image_url,
      uploadedAt: rows.rows[0].uploaded_at,
    });
  } catch {
    console.error("user-signature: database error");
    res.status(500).json({ success: false, message: "Failed to load signature" });
  }
});

router.post("/users/me/signature", async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const parsed = UploadSignatureBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues.map((e: any) => e.message).join(", "),
      });
      return;
    }

    const { signatureImage } = parsed.data;

    if (!SIGNATURE_DATA_RE.test(signatureImage)) {
      res.status(400).json({
        success: false,
        message: "Must be a PNG or JPEG image encoded as a data URL",
      });
      return;
    }

    if (signatureImage.length > MAX_SIGNATURE_LENGTH) {
      res.status(400).json({
        success: false,
        message: "Signature image must be under 5MB",
      });
      return;
    }

    const existing = await pool.query(
      "SELECT id FROM public.user_signatures WHERE user_id = $1",
      [user.userId],
    );

    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE public.user_signatures SET signature_image_url = $1, updated_at = NOW() WHERE user_id = $2",
        [signatureImage, user.userId],
      );
    } else {
      await pool.query(
        "INSERT INTO public.user_signatures (user_id, signature_image_url) VALUES ($1, $2)",
        [user.userId, signatureImage],
      );
    }

    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "SIGNATURE_UPLOADED",
      actionType: "UPDATE",
      module: "users",
      severity: "info",
      details: "User uploaded/replaced signature image",
    });

    res.json({ success: true, message: "Signature saved" });
  } catch {
    console.error("user-signature: database error");
    res.status(500).json({ success: false, message: "Failed to save signature" });
  }
});

router.get("/users/:id/signature", async (req, res): Promise<void> => {
  const admin = su(req);
  const targetUserId = parseInt(String(req.params.id));
  if (!Number.isFinite(targetUserId)) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }
  if (!admin.isSystemAdmin && targetUserId !== admin.userId) {
    res.status(403).json({
      success: false,
      message: "Only system admins can view other users' signatures",
    });
    return;
  }

  try {
    const rows = await pool.query(
      "SELECT signature_image_url, uploaded_at FROM public.user_signatures WHERE user_id = $1",
      [targetUserId],
    );
    if (rows.rows.length === 0) {
      res.json({ signatureImageUrl: null, uploadedAt: null });
      return;
    }
    res.json({
      signatureImageUrl: rows.rows[0].signature_image_url,
      uploadedAt: rows.rows[0].uploaded_at,
    });
  } catch {
    console.error("user-signature: database error");
    res.status(500).json({ success: false, message: "Failed to load signature" });
  }
});

router.post("/users/:id/signature", async (req, res): Promise<void> => {
  const admin = su(req);
  const targetUserId = parseInt(String(req.params.id));
  if (!Number.isFinite(targetUserId)) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }
  const isSelf = targetUserId === admin.userId;
  if (!admin.isSystemAdmin && !isSelf) {
    res.status(403).json({
      success: false,
      message: "Only system admins can upload signatures for other users",
    });
    return;
  }

  try {
    const parsed = UploadSignatureBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues.map((e: any) => e.message).join(", "),
      });
      return;
    }

    const { signatureImage } = parsed.data;

    if (!SIGNATURE_DATA_RE.test(signatureImage)) {
      res.status(400).json({
        success: false,
        message: "Must be a PNG or JPEG image encoded as a data URL",
      });
      return;
    }

    if (signatureImage.length > MAX_SIGNATURE_LENGTH) {
      res.status(400).json({
        success: false,
        message: "Signature image must be under 5MB",
      });
      return;
    }

    const existing = await pool.query(
      "SELECT id FROM public.user_signatures WHERE user_id = $1",
      [targetUserId],
    );

    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE public.user_signatures SET signature_image_url = $1, updated_at = NOW() WHERE user_id = $2",
        [signatureImage, targetUserId],
      );
    } else {
      await pool.query(
        "INSERT INTO public.user_signatures (user_id, signature_image_url) VALUES ($1, $2)",
        [targetUserId, signatureImage],
      );
    }

    await logActivity({
      req,
      propertyId: admin.propertyId ?? 0,
      username: admin.username,
      userId: admin.userId,
      userRole: admin.userRole,
      action: "SIGNATURE_UPLOADED_BY_ADMIN",
      actionType: "UPDATE",
      module: "users",
      severity: "info",
      details: `Admin uploaded/replaced signature image for user ${targetUserId}`,
    });

    res.json({ success: true, message: "Signature saved" });
  } catch {
    console.error("user-signature: database error");
    res.status(500).json({ success: false, message: "Failed to save signature" });
  }
});

export default router;
