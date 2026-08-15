import { Router } from "express";
import { exportQueue } from "@workspace/queue";
import { requireAuth } from "../middlewares/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const router = Router();

// All job routes require authentication
router.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────────────
const enqueueExportSchema = z.object({
  format: z.enum(["csv", "excel", "pdf"]),
  reportType: z.string(),
  filters: z.record(z.any()).optional(),
});

// ─── POST /jobs/export — Enqueue an export job ────────────────
router.post(
  "/export",
  asyncHandler(async (req, res) => {
    const body = enqueueExportSchema.parse(req.body);
    // @ts-ignore — session typings
    const userId = req.session?.userId;
    // @ts-ignore
    const propertyId = req.query.propertyId
      ? Number(req.query.propertyId)
      // @ts-ignore
      : req.session?.propertyId;

    if (!exportQueue) {
      return res.status(503).json({
        success: false,
        message: "Queue service not available — Redis is not configured",
      });
    }

    const job = await exportQueue.add("export", {
      tenantId: propertyId,
      format: body.format,
      reportType: body.reportType,
      filters: body.filters ?? {},
      userId,
    });

    res.status(202).json({
      success: true,
      jobId: job.id,
      message: "Export job enqueued",
    });
    return;
  }),
);

// ─── GET /jobs/:id/status — Poll job progress ─────────────────
router.get(
  "/:id/status",
  asyncHandler(async (req, res) => {
    if (!exportQueue) {
      return res.status(503).json({
        success: false,
        message: "Queue service not available",
      });
    }

    const job = await exportQueue.getJob(req.params.id as string);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const state = await job.getState();
    const progress = job.progress;

    const response: Record<string, any> = {
      success: true,
      jobId: job.id,
      state,
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    };

    if (state === "completed" && job.returnvalue) {
      response.result = {
        fileName: job.returnvalue.fileName,
        mimeType: job.returnvalue.mimeType,
        sizeBytes: job.returnvalue.sizeBytes,
        downloadUrl: `/api/jobs/${job.id}/download`,
      };
    }

    if (state === "failed") {
      response.error = job.failedReason ?? "Unknown error";
    }

    res.json(response);
    return;
  }),
);

// ─── GET /jobs/:id/download — Download completed export ───────
router.get(
  "/:id/download",
  asyncHandler(async (req, res) => {
    if (!exportQueue) {
      return res.status(503).json({
        success: false,
        message: "Queue service not available",
      });
    }

    const job = await exportQueue.getJob(req.params.id as string);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const state = await job.getState();
    if (state !== "completed" || !job.returnvalue?.filePath) {
      return res.status(400).json({
        success: false,
        message: "Job is not completed or has no downloadable file",
      });
    }

    const { filePath, fileName, mimeType } = job.returnvalue;

    if (!fs.existsSync(filePath)) {
      return res.status(410).json({
        success: false,
        message: "Export file has expired and been cleaned up",
      });
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    return;
  }),
);

export default router;
