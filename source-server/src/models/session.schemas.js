import { z } from "zod";

export const createSessionSchema = z.object({
  videoId: z.string().min(1),
  approvedViewerId: z.string().min(1).optional(),
  expiresInMinutes: z.number().int().min(5).max(120).optional()
});

export const approveViewerSchema = z.object({
  viewerId: z.string().min(1)
});

export const endSessionSchema = z.object({
  reason: z.string().min(3).max(120).optional()
}).default({});
