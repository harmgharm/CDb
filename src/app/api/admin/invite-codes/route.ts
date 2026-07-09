/**
 * GET /api/admin/invite-codes — List all invite codes (admin only)
 * POST /api/admin/invite-codes — Generate a new invite code (admin only)
 */

import { parseBody } from "@/lib/api/parse-body";
import { successResponse } from "@/lib/api/response";
import { withAdmin } from "@/lib/api/with-auth";
import { generateInviteCode, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCodeSchema } from "@/lib/validations/admin";

export const GET = withAdmin(async () => {
  const codes = await db
    .selectFrom("invite_codes")
    .leftJoin("users as creator", "creator.id", "invite_codes.created_by_user_id")
    .leftJoin("users as redeemer", "redeemer.id", "invite_codes.used_by_user_id")
    .select([
      "invite_codes.id",
      "invite_codes.code",
      "invite_codes.expires_at",
      "invite_codes.created_at",
      "invite_codes.used_by_user_id",
      "creator.username as created_by_username",
      "redeemer.username as used_by_username",
    ])
    .orderBy("invite_codes.created_at", "desc")
    .execute();

  return successResponse(codes);
});

export const POST = withAdmin(async (req, admin) => {
  const parsed = await parseBody(req, generateInviteCodeSchema, "Invalid request body");
  if (!parsed.success) {
    return parsed.response;
  }

  const { expiresInDays } = parsed.data;
  const invite = await generateInviteCode(admin.id, expiresInDays);

  await logAudit({
    userId: admin.id,
    action: "invite.created",
    entityType: "invite_code",
    entityId: invite.id,
    metadata: { code: invite.code, expires_at: invite.expiresAt.toISOString() },
  });

  return successResponse(
    { code: invite.code, expiresAt: invite.expiresAt },
    "Invite code created",
    201,
  );
});
