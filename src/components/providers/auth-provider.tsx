"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import useSWR from "swr";

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
  } = useSWR<SafeUser, Error>("/api/auth/me");

  // Redirect to login when auth fails (token expired and refresh failed)
  useEffect(() => {
    if (authError !== undefined && !isLoading) {
      router.push("/login");
    }
  }, [authError, isLoading, router]);

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
