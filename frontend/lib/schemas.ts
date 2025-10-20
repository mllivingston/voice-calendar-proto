// frontend/lib/schemas.ts
import { z } from "zod";

/**
 * Event contract (unchanged from your Action 12.5a work).
 * Adjust fields here only if your backend differs.
 */
export const EventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().nullable().optional(),
  start: z.string().datetime().nullable().optional(),
  end: z.string().datetime().nullable().optional(),
  allDay: z.boolean().optional().default(false),
  notes: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;

/**
 * Mutation diff/result (used by /calendar/mutate responses).
 */
export const MutationResultSchema = z.object({
  status: z.literal("ok"),
  diff: z.object({
    type: z.enum(["create", "update", "delete", "move"]),
    event: EventSchema.optional(),
    before: EventSchema.optional(),
    after: EventSchema.optional(),
  }),
});
export type MutationResult = z.infer<typeof MutationResultSchema>;

/**
 * NEW — Command contract returned by /ai/interpret and consumed by /calendar/mutate.
 * Keep this aligned with your FastAPI Command model.
 */
export const CommandSchema = z.object({
  op: z.enum(["create", "update", "delete", "move"]),
  // Normalized fields that your backend understands for mutate:
  title: z.string().nullable().optional(),
  start: z.string().datetime().nullable().optional(),
  end: z.string().datetime().nullable().optional(),
  id: z.string().uuid().optional(),
  allDay: z.boolean().optional(),
  notes: z.string().optional(),
});
export type Command = z.infer<typeof CommandSchema>;

/**
 * API wrappers (request/response envelopes) for /ai/interpret and /calendar/mutate
 */
export const InterpretRequestSchema = z.object({
  text: z.string().min(1),
});
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>;

export const InterpretResponseSchema = z.object({
  status: z.literal("ok"),
  command: CommandSchema,
});
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>;

export const MutateRequestSchema = z.object({
  command: CommandSchema,
});
export type MutateRequest = z.infer<typeof MutateRequestSchema>;
