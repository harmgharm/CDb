/**
 * GET /api/settings/notifications — Get notification preferences
 * PUT /api/settings/notifications — Update notification preferences
 */

import { parseBody } from "@/lib/api/parse-body";
import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { getUserNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications";
import { updateNotificationPreferencesSchema } from "@/lib/validations/notifications";

export const GET = withAuth(async (_req, user) => {
  const preferences = await getUserNotificationPreferences(user.id);
  return successResponse({ preferences });
});

export const PUT = withAuth(async (req, user) => {
  const parsed = await parseBody(req, updateNotificationPreferencesSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  await updateNotificationPreferences(user.id, parsed.data.preferences);
  return successResponse({ preferences: parsed.data.preferences });
});
