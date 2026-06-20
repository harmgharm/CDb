/**
 * Queue Validation Schemas
 */

import { z } from "zod";

export const proposeSchema = z.object({
  mediaId: z.uuid("Invalid media ID"),
});

export type ProposeInput = z.infer<typeof proposeSchema>;

export const scheduleSchema = z.object({
  // A calendar date as a literal "YYYY-MM-DD" string — NOT coerced to a Date.
  // Coercion would parse it to UTC midnight, which a non-UTC server then shifts
  // back a day when storing into the Postgres `date` column (off-by-one).
  // Present but nullable: `null` clears the date back to the dateless state.
  scheduledDate: z.iso.date().nullable(),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
