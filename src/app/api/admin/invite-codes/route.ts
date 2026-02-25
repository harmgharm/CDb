/**
 * GET /api/admin/invite-codes — List all invite codes (admin only)
 * POST /api/admin/invite-codes — Generate a new invite code (admin only)
 */

import { successResponse } from "@/lib/api/response";
import { generateInviteCode, logAudit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  await requireAdmin();

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
}

export async function POST() {
  const admin = await requireAdmin();

  const code = await generateInviteCode(admin.id);

  // Fetch the created invite to get the expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await logAudit({
    userId: admin.id,
    action: "invite.created",
    entityType: "invite_code",
    entityId: code,
    metadata: { expires_at: expiresAt.toISOString() },
  });

  return successResponse({ code, expiresAt }, "Invite code created", 201);
}
