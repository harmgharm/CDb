/**
 * SWR hooks for admin data
 */

import { useCallback, useState } from "react";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { UserRole } from "@/lib/db/types";
import type { AdminUser, AuditLogResponse, InviteCodeItem } from "@/types/admin-responses";

interface AuditLogParams {
  readonly page?: number;
  readonly limit?: number;
  readonly action?: string;
  readonly entityType?: string;
  readonly userId?: string;
}

function buildAuditLogKey(params: AuditLogParams): string {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.action !== undefined && params.action.length > 0)
    searchParams.set("action", params.action);
  if (params.entityType !== undefined && params.entityType.length > 0)
    searchParams.set("entityType", params.entityType);
  if (params.userId !== undefined && params.userId.length > 0)
    searchParams.set("userId", params.userId);
  return `/api/admin/audit-log?${searchParams.toString()}`;
}

export function useAuditLog(params: AuditLogParams) {
  return useSWR<AuditLogResponse>(buildAuditLogKey(params));
}

export function useAdminUsers() {
  return useSWR<AdminUser[]>("/api/admin/users");
}

export function useInviteCodes() {
  return useSWR<InviteCodeItem[]>("/api/admin/invite-codes");
}

export function useChangeRole() {
  const [isUpdating, setIsUpdating] = useState(false);

  const changeRole = useCallback(async (userId: string, role: UserRole): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { changeRole, isUpdating };
}

export function useDeleteUser() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteUser, isDeleting };
}

export function useGenerateInviteCode() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (expiresInDays = 30): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const response = await fetchWithAuth("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays }),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}

export function useDeleteInviteCode() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteCode = useCallback(async (codeId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/admin/invite-codes/${codeId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteCode, isDeleting };
}

export function useUpdateInviteCode() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateCode = useCallback(
    async (codeId: string, expiresInDays: number): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetchWithAuth(`/api/admin/invite-codes/${codeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInDays }),
        });
        const json = (await response.json()) as ApiResponse<unknown>;
        return json.error === null;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateCode, isUpdating };
}
