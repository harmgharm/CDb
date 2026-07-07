import type { InviteCodeItem } from "@/types/admin-responses";

export type CodeStatus = "used" | "expired" | "active";

export function getCodeStatus(code: InviteCodeItem): CodeStatus {
  if (code.used_by_user_id !== null) return "used";
  if (new Date(code.expires_at) < new Date()) return "expired";
  return "active";
}
