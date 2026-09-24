import { z } from "zod";
export const searchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  people: z.coerce.number().int().min(1).max(500),
});
export const bookingSchema = searchSchema.extend({
  roomId: z.string().min(1).max(100),
  title: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(1000).default(""),
  quoteToken: z.string().min(1).max(10000),
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .default("")
    .refine((value) => !value || value.replace(/\D/g, "").length >= 8, {
      message: "Skriv inn et gyldig telefonnummer.",
    }),
});
export const roomSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(500),
  description: z.string().trim().max(3000),
  descriptionEn: z.string().trim().max(3000).optional().default(""),
  capacityLabel: z.string().trim().max(100).optional(),
  capacityLabelEn: z.string().trim().max(100).optional(),
  requiresApproval: z.boolean(),
  image: z.string().trim().max(2000).optional(),
  imageKind: z.enum(["illustrative", "actual"]).optional(),
  amenities: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .optional()
    .default([]),
  arrivalInfo: z.string().trim().max(1000).optional().default(""),
  imageFile: z
    .object({
      filename: z.string().trim().min(1).max(200),
      contentType: z.enum(["image/webp", "image/jpeg", "image/png"]),
      data: z.string().min(1).max(2_800_000),
    })
    .optional(),
});
export const roomCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(500),
  description: z.string().trim().max(3000).optional().default(""),
  descriptionEn: z.string().trim().max(3000).optional().default(""),
  capacityLabel: z.string().trim().max(100).optional(),
  capacityLabelEn: z.string().trim().max(100).optional(),
  requiresApproval: z.boolean().optional().default(false),
  image: z.string().trim().max(2000).optional(),
  imageKind: z.enum(["illustrative", "actual"]).optional(),
  amenities: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .optional()
    .default([]),
  arrivalInfo: z.string().trim().max(1000).optional().default(""),
  imageFile: z
    .object({
      filename: z.string().trim().min(1).max(200),
      contentType: z.enum(["image/webp", "image/jpeg", "image/png"]),
      data: z.string().min(1).max(2_800_000),
    })
    .optional(),
});
export type RoomPatch = z.infer<typeof roomSchema>;
export type RoomCreate = z.infer<typeof roomCreateSchema>;
export const accessRequestCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  company: z.string().trim().min(1).max(120),
});
export const accessRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export const messageCreateSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  clientMessageId: z.string().uuid().optional(),
});
export const supportOpenSchema = z.object({
  content: z.string().trim().min(1).max(4000).optional(),
  clientMessageId: z.string().uuid().optional(),
});
export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
});
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
    public params?: Record<string, string | number>,
  ) {
    super(message);
  }
}
