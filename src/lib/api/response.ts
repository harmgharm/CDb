/**
 * Consistent API response helpers
 */

import { NextResponse } from "next/server";

interface ApiSuccessResponse<T> {
  data: T;
  error: null;
  message?: string;
}

interface ApiErrorResponse {
  data: null;
  error: string;
  message?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse(data: unknown, message?: string, status = 200): NextResponse {
  return NextResponse.json({ data, error: null, message } satisfies ApiSuccessResponse<unknown>, {
    status,
  });
}

export function errorResponse(error: string, status = 400): NextResponse {
  return NextResponse.json({ data: null, error } satisfies ApiErrorResponse, { status });
}
