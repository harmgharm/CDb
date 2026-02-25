/**
 * POST /api/admin/invite-codes
 *
 * Admin-only: Generate a new invite code.
 */

import { successResponse } from "@/lib/api/response";
import { generateInviteCode, logAudit, requireAdmin } from "@/lib/auth";

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
