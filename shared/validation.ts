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
});
export const roomSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(500),
  description: z.string().trim().max(3000),
  requiresApproval: z.boolean(),
});
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
  ) {
    super(message);
  }
}
