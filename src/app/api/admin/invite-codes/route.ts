/**
 * GET /api/admin/invite-codes — List all invite codes (admin only)
 * POST /api/admin/invite-codes — Generate a new invite code (admin only)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { generateInviteCode, logAudit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCodeSchema } from "@/lib/validations/admin";

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

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = generateInviteCodeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid request body", 400);
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
}
