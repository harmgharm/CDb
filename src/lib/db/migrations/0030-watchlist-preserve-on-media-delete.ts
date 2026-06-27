/**
 * Migration 0030: Preserve watchlist entries when their media is deleted
 *
 * Previously `watchlist.media_id` was `ON DELETE CASCADE`, so deleting a media
 * row silently destroyed every watchlist entry that referenced it. This changes
 * the FK to `ON DELETE SET NULL` and relaxes `watchlist_anchor_check` so an
 * imported entry may *also* carry its external ids (`tmdb_id`/`mal_id`) and
 * cached display fields. On deletion the row downgrades to external-only —
 * still visible (GET coalesces `media.*` -> `ext_*`) and still proposable
 * (planWatchlistPropose imports-then-proposes external-only entries) — instead
 * of being destroyed.
 *
 * Existing imported rows are backfilled from `media` so the protection applies
 * retroactively. For the downgrade to be safe, every `media` row must carry at
 * least one of tmdb_id/mal_id — otherwise a deleted-media row would become
 * anchorless (`media_id`, `tmdb_id`, `mal_id` all null) and violate the relaxed
 * check, failing the DELETE. The import path always sets one, but the manual
 * `POST /api/media` create path did not, so step 1 adds a CHECK on `media` to
 * make the invariant real (paired with a `createMediaSchema` refine).
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // 1. Enforce that every media row has at least one external id, so a watchlist
  //    entry can always downgrade to a valid external-only row when its media is
  //    deleted. Mirrors rec_cache_anchor_check. (No existing row violates this.)
  await sql`
    ALTER TABLE media
    ADD CONSTRAINT media_external_id_check
    CHECK (tmdb_id IS NOT NULL OR mal_id IS NOT NULL)
  `.execute(db);

  // 2. Swap the media_id FK from CASCADE to SET NULL.
  await sql`
    ALTER TABLE watchlist
    DROP CONSTRAINT IF EXISTS watchlist_media_id_fkey
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_media_id_fkey
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL
  `.execute(db);

  // 3. Relax the anchor check: an imported row (media_id set) may also hold
  //    external ids as a deletion fallback. The only hard rule is that an
  //    external-only row (media_id null) must carry at least one external id.
  await sql`
    ALTER TABLE watchlist
    DROP CONSTRAINT IF EXISTS watchlist_anchor_check
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_anchor_check
    CHECK (
      media_id IS NOT NULL
      OR tmdb_id IS NOT NULL
      OR mal_id IS NOT NULL
    )
  `.execute(db);

  // 4. Backfill external fallback fields onto existing imported rows. The step-1
  //    CHECK guarantees at least one external id, so no row ends up anchorless.
  await sql`
    UPDATE watchlist
    SET tmdb_id = media.tmdb_id,
        mal_id = media.mal_id,
        ext_title = media.title,
        ext_poster_url = media.poster_url,
        ext_media_type = media.type
    FROM media
    WHERE watchlist.media_id = media.id
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // Restore the strict XOR anchor check. Existing imported rows now carry
  // external ids (from the backfill / new write paths), which the strict check
  // forbids, so clear them on imported rows first.
  await sql`
    UPDATE watchlist
    SET tmdb_id = NULL,
        mal_id = NULL,
        ext_title = NULL,
        ext_poster_url = NULL,
        ext_media_type = NULL
    WHERE media_id IS NOT NULL
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    DROP CONSTRAINT IF EXISTS watchlist_anchor_check
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_anchor_check
    CHECK (
      (media_id IS NOT NULL AND tmdb_id IS NULL AND mal_id IS NULL)
      OR
      (media_id IS NULL AND (tmdb_id IS NOT NULL OR mal_id IS NOT NULL))
    )
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    DROP CONSTRAINT IF EXISTS watchlist_media_id_fkey
  `.execute(db);

  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_media_id_fkey
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE media
    DROP CONSTRAINT IF EXISTS media_external_id_check
  `.execute(db);
}
