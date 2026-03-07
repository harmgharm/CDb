"use client";

import { SWRConfig } from "swr";

import type { ApiResponse } from "@/lib/api/response";

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetcher<T>(url: string): Promise<T> {
  let response = await fetch(url);

  // If unauthorized, try refreshing the token and retry once
  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      response = await fetch(url);
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (json.error !== null) {
    throw new Error(json.error);
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
