/**
 * GET /api/settings/notifications — Get notification preferences
 * PUT /api/settings/notifications — Update notification preferences
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser } from "@/lib/auth";
import { getUserNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications";
import { updateNotificationPreferencesSchema } from "@/lib/validations/notifications";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }
  const preferences = await getUserNotificationPreferences(user.id);
  return successResponse({ preferences });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = updateNotificationPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  await updateNotificationPreferences(user.id, parsed.data.preferences);
  return successResponse({ preferences: parsed.data.preferences });
}
