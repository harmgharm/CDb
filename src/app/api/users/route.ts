/**
 * GET /api/users — List all users (public info only)
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchTaglineInputsBatch } from "@/lib/users/stats";
import { deriveTagline } from "@/lib/users/tagline";

export async function GET() {
  await requireAuth();

  const users = await db
    .selectFrom("users")
    .select(["id", "username", "display_name", "avatar_url", "role", "created_at"])
    .orderBy("username", "asc")
    .execute();

  const taglineInputs = await fetchTaglineInputsBatch(users);

  return successResponse(
    users.map((u) => {
      const inputs = taglineInputs.get(u.id);
      return {
        ...u,
        tagline: inputs === undefined ? "Watching along." : deriveTagline(inputs),
        // Roster stats are already computed for the tagline, so surface them
        // for the roster rows with no extra queries.
        stats: {
          picks: inputs?.pickCount ?? 0,
          watched: inputs?.sessionsAttended ?? 0,
          avgScore: inputs?.avgScore ?? null,
        },
      };
    }),
  );
}
