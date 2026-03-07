/**
 * Hooks for user settings mutations
 */

import { useCallback, useState } from "react";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";

interface UpdateProfileParams {
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly username?: string;
  readonly email?: string;
}

export function useUpdateProfile() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useCallback(
    async (userId: string, data: UpdateProfileParams): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);
      try {
        const response = await fetchWithAuth(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = (await response.json()) as ApiResponse<unknown>;
        if (json.error !== null) {
          setError(json.error);
          return false;
        }
        return true;
      } catch {
        setError("Failed to update profile");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateProfile, isUpdating, error };
}

interface ChangePasswordParams {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

export function useChangePassword() {
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useCallback(async (data: ChangePasswordParams): Promise<boolean> => {
    setIsChanging(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        setError(json.error);
        return false;
      }
      return true;
    } catch {
      setError("Failed to change password");
      return false;
    } finally {
      setIsChanging(false);
    }
  }, []);

  return { changePassword, isChanging, error };
}
