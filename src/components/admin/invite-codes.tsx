"use client";

import { CheckCircleIcon, ClockIcon, CopyIcon, PlusIcon, XCircleIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGenerateInviteCode, useInviteCodes } from "@/hooks/use-admin";
import type { InviteCodeItem } from "@/types/admin-responses";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type CodeStatus = "used" | "expired" | "active";

function getCodeStatus(code: InviteCodeItem): CodeStatus {
  if (code.used_by_user_id !== null) return "used";
  if (new Date(code.expires_at) < new Date()) return "expired";
  return "active";
}

const STATUS_CONFIG: Record<
  CodeStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: <ClockIcon className="size-3" />,
  },
  used: {
    label: "Used",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: <CheckCircleIcon className="size-3" />,
  },
  expired: {
    label: "Expired",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: <XCircleIcon className="size-3" />,
  },
};

function StatusBadge({ code }: Readonly<{ code: InviteCodeItem }>) {
  const status = getCodeStatus(code);
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function CopyButton({ code }: Readonly<{ code: string }>) {
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard");
  }, [code]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => {
        void handleCopy();
      }}
    >
      <CopyIcon className="size-3.5" />
    </Button>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

interface InviteCodesContentProps {
  readonly codes: InviteCodeItem[] | undefined;
  readonly isLoading: boolean;
  readonly justGenerated: boolean;
}

function InviteCodesContent({ codes, isLoading, justGenerated }: InviteCodesContentProps) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (codes === undefined || codes.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        No invite codes yet. Generate one to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Used By</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code, index) => (
            <motion.tr
              key={code.id}
              className={`hover:bg-muted/50 border-b transition-colors ${
                index === 0 && justGenerated ? "bg-green-500/5" : ""
              }`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
            >
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
                    {code.code}
                  </code>
                  {getCodeStatus(code) === "active" && <CopyButton code={code.code} />}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge code={code} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {code.created_by_username ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {code.used_by_username ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(code.expires_at)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(code.created_at)}
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function InviteCodes() {
  const { data: codes, isLoading, mutate } = useInviteCodes();
  const { generate, isGenerating } = useGenerateInviteCode();
  const [justGenerated, setJustGenerated] = useState(false);

  async function handleGenerate() {
    const success = await generate();
    if (success) {
      toast.success("New invite code generated");
      setJustGenerated(true);
      await mutate();
      setTimeout(() => {
        setJustGenerated(false);
      }, 2000);
    } else {
      toast.error("Failed to generate invite code");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            Generate invite codes for new members. Codes expire after 30 days.
          </p>
        </div>
        <Button
          size="sm"
          disabled={isGenerating}
          onClick={() => {
            void handleGenerate();
          }}
        >
          <PlusIcon className="mr-1.5 size-4" />
          {isGenerating ? "Generating..." : "Generate Code"}
        </Button>
      </div>

      <InviteCodesContent codes={codes} isLoading={isLoading} justGenerated={justGenerated} />
    </div>
  );
}
