/**
 * Queue Validation Schemas
 */

import { z } from "zod";

export const proposeSchema = z.object({
  mediaId: z.uuid("Invalid media ID"),
});

export type ProposeInput = z.infer<typeof proposeSchema>;

export const scheduleSchema = z.object({
  // Present but nullable: `null` clears the date back to the dateless state.
  scheduledDate: z.coerce.date().nullable(),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
