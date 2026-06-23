"use client";

import { SWRConfig } from "swr";

import { FetchError } from "@/lib/api/fetch-error";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetchWithAuth(url);
  const json = (await response.json()) as ApiResponse<T>;

  if (json.error !== null) {
    // Carry the HTTP status so consumers can tell a genuine 404 (resource
    // missing) from a transient failure (500 / network) — a detail page 404s
    // only on the former. See resolveDetailState.
    throw new FetchError(json.error, response.status);
  }

  return json.data;
}

export function SWRProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
