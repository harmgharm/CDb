"use client";

import { SWRConfig } from "swr";

import type { ApiResponse } from "@/lib/api/response";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
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
