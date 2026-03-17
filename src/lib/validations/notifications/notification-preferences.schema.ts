import { z } from "zod";

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.record(z.string(), z.boolean()),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
