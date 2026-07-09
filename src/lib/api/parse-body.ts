/**
 * Guarded JSON body parsing for API routes.
 *
 * `req.json()` throws on a malformed/empty body before Zod validation ever
 * runs, producing a raw unstructured 500 instead of the app's `{ data, error,
 * message }` shape. This wraps the parse in a catch and folds straight into
 * the schema check.
 */

import type { NextRequest, NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";

import { errorResponse } from "./response";

type ParseBodyResult<T> = { success: true; data: T } | { success: false; response: NextResponse };

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
  message: string | ((error: ZodError) => string) = "Invalid input",
): Promise<ParseBodyResult<T>> {
  const body: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const resolvedMessage = typeof message === "function" ? message(parsed.error) : message;
    return { success: false, response: errorResponse(resolvedMessage, 400) };
  }
  return { success: true, data: parsed.data };
}
