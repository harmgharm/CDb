"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import useSWR from "swr";

import { onRefreshFail } from "@/lib/api/fetch-with-auth";
import type { SafeUser } from "@/types/auth";

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  mutate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const {
    data: user,
    isLoading,
    error: authError,
    mutate,
  } = useSWR<SafeUser, Error>("/api/auth/me", {
    refreshInterval: 5 * 60 * 1000, // Check session every 5 minutes
    revalidateOnFocus: true, // Re-check auth when tab regains focus (e.g. user returns after idle)
    revalidateOnReconnect: true, // Re-check auth when network reconnects
  });

  // Redirect to login when auth fails (token expired and refresh failed)
  useEffect(() => {
    if (authError !== undefined && !isLoading) {
      router.push("/login");
    }
  }, [authError, isLoading, router]);

  // When any API call's token refresh fails, revalidate /api/auth/me immediately
  // so the authError effect above fires and redirects to login.
  useEffect(() => {
    return onRefreshFail(() => {
      void mutate();
    });
  }, [mutate]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutate(undefined, { revalidate: false });
    router.push("/login");
  }, [mutate, router]);

  const handleMutate = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      logout,
      mutate: handleMutate,
    }),
    [user, isLoading, logout, handleMutate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
