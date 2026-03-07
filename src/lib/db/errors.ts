/**
 * Database error helpers
 */

/**
 * Check if an error is a Postgres unique constraint violation (code 23505).
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}
