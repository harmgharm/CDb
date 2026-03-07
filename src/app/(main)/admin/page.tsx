"use client";

import { KeyIcon, ScrollTextIcon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { InviteCodes } from "@/components/admin/invite-codes";
import { UserManagement } from "@/components/admin/user-management";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      router.replace("/home");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1">
          Manage users, invite codes, and view audit logs.
        </p>
      </motion.div>

      <Tabs defaultValue="audit-log">
        <TabsList>
          <TabsTrigger value="audit-log" className="gap-1.5">
            <ScrollTextIcon className="size-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <UsersIcon className="size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="invite-codes" className="gap-1.5">
            <KeyIcon className="size-4" />
            Invite Codes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit-log" className="mt-4">
          <AuditLogTable />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="invite-codes" className="mt-4">
          <InviteCodes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
