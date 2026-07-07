"use client";

import { KeyIcon, ScrollTextIcon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { InviteCodes } from "@/components/admin/invite-codes";
import { UserManagement } from "@/components/admin/user-management";
import { IssueLine } from "@/components/editorial/issue-line";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminUsers, useInviteCodes } from "@/hooks/use-admin";
import { getCodeStatus } from "@/lib/admin/invite-code-status";

// Gold-active soft-chip tabs (kit's cdb-up-tab.active) — same className override
// pattern as PROFILE_TAB_CLASS on the user profile page.
const ADMIN_TAB_CLASS = [
  "data-[state=active]:text-cdb-marquee-text dark:data-[state=active]:text-cdb-marquee-text",
  "data-[state=active]:border-transparent dark:data-[state=active]:border-transparent",
  "data-[state=active]:shadow-none",
].join(" ");

function buildIssueCounts(
  memberCount: number | undefined,
  activeCodeCount: number | undefined,
): string | undefined {
  if (memberCount === undefined || activeCodeCount === undefined) return undefined;
  const memberNoun = memberCount === 1 ? "member" : "members";
  const codeNoun = activeCodeCount === 1 ? "code" : "codes";
  return `${String(memberCount)} ${memberNoun} · ${String(activeCodeCount)} active ${codeNoun}`;
}

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
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="mx-auto h-5 w-80" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return <AdminContent />;
}

// Rendered only after the role gate so the admin API hooks never fire for a
// non-admin's brief pre-redirect render.
function AdminContent() {
  const { data: users } = useAdminUsers();
  const { data: codes } = useInviteCodes();

  const activeCodeCount =
    codes === undefined
      ? undefined
      : codes.filter((code) => getCodeStatus(code) === "active").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <header className="flex flex-col gap-2.5 border-b border-[var(--border-strong)] pt-4 pb-6">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
            Back office · admin only
          </span>
          <h1 className="font-display m-0 text-center text-[clamp(72px,11vw,144px)] leading-[0.88] font-normal tracking-[-0.045em]">
            The <em className="text-cdb-marquee tracking-[-0.06em] italic">back office</em>
          </h1>
          <p className="font-display text-muted-foreground mx-auto max-w-[560px] text-center text-lg leading-[1.4] italic">
            Who&apos;s in, who got invited, and a paper trail of everything that&apos;s happened in
            the group.
          </p>
        </header>

        {/* Kit's .cdb-page-inner separates masthead and issue line with a 32px flex gap */}
        <div className="mt-8">
          <IssueLine
            left="Access · admin"
            right={buildIssueCounts(users?.length, activeCodeCount)}
          />
        </div>
      </motion.div>

      <Tabs defaultValue="audit-log">
        <TabsList className="self-start">
          <TabsTrigger value="audit-log" className={ADMIN_TAB_CLASS}>
            <ScrollTextIcon className="size-4" />
            <span className="hidden sm:inline">Audit log</span>
          </TabsTrigger>
          <TabsTrigger value="members" className={ADMIN_TAB_CLASS}>
            <UsersIcon className="size-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="invite-codes" className={ADMIN_TAB_CLASS}>
            <KeyIcon className="size-4" />
            <span className="hidden sm:inline">Invite codes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit-log" className="mt-4">
          <AuditLogTable />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="invite-codes" className="mt-4">
          <InviteCodes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
