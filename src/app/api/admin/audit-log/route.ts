/**
 * GET /api/admin/audit-log — Paginated audit log (admin only)
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAdmin } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import type { AuditAction } from "@/lib/db/types";
import { paginationSchema } from "@/lib/validations/common";

export const GET = withAdmin(async (req) => {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = paginationSchema.safeParse(searchParams);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }
  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
  const action = req.nextUrl.searchParams.get("action") ?? undefined;
  const entityType = req.nextUrl.searchParams.get("entityType") ?? undefined;

  let query = db
    .selectFrom("audit_log")
    .innerJoin("users", "users.id", "audit_log.user_id")
    .select([
      "audit_log.id",
      "audit_log.action",
      "audit_log.entity_type",
      "audit_log.entity_id",
      "audit_log.metadata",
      "audit_log.created_at",
      "users.id as user_id",
      "users.username",
      "users.display_name",
    ]);

  if (userId !== undefined) {
    query = query.where("audit_log.user_id", "=", userId);
  }
  if (action !== undefined) {
    query = query.where("audit_log.action", "=", action as AuditAction);
  }
  if (entityType !== undefined) {
    query = query.where("audit_log.entity_type", "=", entityType);
  }

  const total = await db
    .selectFrom("audit_log")
    .select(db.fn.countAll().as("count"))
    .$call((qb) => {
      let q = qb;
      if (userId !== undefined) q = q.where("audit_log.user_id", "=", userId);
      if (action !== undefined) q = q.where("audit_log.action", "=", action as AuditAction);
      if (entityType !== undefined) q = q.where("audit_log.entity_type", "=", entityType);
      return q;
    })
    .executeTakeFirstOrThrow();

  const items = await query
    .orderBy("audit_log.created_at", "desc")
    .offset(offset)
    .limit(limit)
    .execute();

  return successResponse({
    items,
    total: Number(total.count),
    page,
    limit,
    totalPages: Math.ceil(Number(total.count) / limit),
  });
});
