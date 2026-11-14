// Helpers shared by the portal-data route modules.
import { z } from "zod";

export const CreateMaintenanceSchema = z.object({
  category: z
    .enum(["maintenance", "housekeeping", "complaint"])
    .default("maintenance"),
  problemType: z.string().min(1, "Problem type is required"),
  description: z
    .string()
    .min(5, "Please describe the issue (min 5 characters)"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  photoUrl: z.string().optional(),
  photoUrls: z.array(z.string()).max(6).optional(),
});

export const RateMaintenanceSchema = z.object({
  maintenanceId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().optional().default(""),
});
