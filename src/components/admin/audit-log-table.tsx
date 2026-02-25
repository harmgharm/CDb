"use client";

import { FilterIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useState } from "react";

import { MediaPagination } from "@/components/media/media-pagination";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditLog } from "@/hooks/use-admin";
import type { AuditLogEntry, AuditLogResponse } from "@/types/admin-responses";

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "user.created", label: "User Created" },
  { value: "user.updated", label: "User Updated" },
  { value: "user.deleted", label: "User Deleted" },
  { value: "media.created", label: "Media Created" },
  { value: "media.updated", label: "Media Updated" },
  { value: "media.deleted", label: "Media Deleted" },
  { value: "session.created", label: "Session Created" },
  { value: "session.updated", label: "Session Updated" },
  { value: "session.deleted", label: "Session Deleted" },
  { value: "rating.created", label: "Rating Created" },
  { value: "rating.updated", label: "Rating Updated" },
  { value: "rating.deleted", label: "Rating Deleted" },
  { value: "invite.created", label: "Invite Created" },
  { value: "invite.used", label: "Invite Used" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "all", label: "All Entities" },
  { value: "user", label: "User" },
  { value: "media", label: "Media" },
  { value: "session", label: "Session" },
  { value: "rating", label: "Rating" },
  { value: "invite_code", label: "Invite Code" },
];

function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action.replaceAll(".", " ").replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-500/10 text-green-500 border-green-500/20",
  updated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  deleted: "bg-red-500/10 text-red-500 border-red-500/20",
  used: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

function ActionBadge({ action }: Readonly<{ action: string }>) {
  const verb = action.split(".")[1] ?? "unknown";
  const colorClass = ACTION_COLORS[verb] ?? "";
  return (
    <Badge variant="outline" className={colorClass}>
      {formatAction(action)}
    </Badge>
  );
}

function MetadataCell({ metadata }: Readonly<{ metadata: Record<string, unknown> | null }>) {
  if (metadata === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="text-muted-foreground text-xs">
      {entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ")}
    </span>
  );
}

function AuditLogRow({ entry, index }: Readonly<{ entry: AuditLogEntry; index: number }>) {
  return (
    <motion.tr
      className="hover:bg-muted/50 border-b transition-colors"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
    >
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {formatTimestamp(entry.created_at)}
      </TableCell>
      <TableCell className="font-medium">{entry.display_name ?? entry.username}</TableCell>
      <TableCell>
        <ActionBadge action={entry.action} />
      </TableCell>
      <TableCell className="capitalize">{entry.entity_type}</TableCell>
      <TableCell className="font-mono text-xs">{entry.entity_id.slice(0, 8)}...</TableCell>
      <TableCell className="max-w-48 truncate">
        <MetadataCell metadata={entry.metadata} />
      </TableCell>
    </motion.tr>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

interface AuditLogContentProps {
  readonly data: AuditLogResponse | undefined;
  readonly isLoading: boolean;
  readonly onPageChange: (page: number) => void;
}

function AuditLogContent({ data, isLoading, onPageChange }: AuditLogContentProps) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (data === undefined || data.items.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        No audit log entries found.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((entry, index) => (
              <AuditLogRow key={entry.id} entry={entry} index={index} />
            ))}
          </TableBody>
        </Table>
      </div>
      <MediaPagination page={data.page} totalPages={data.totalPages} onPageChange={onPageChange} />
    </>
  );
}

export function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  const { data, isLoading } = useAuditLog({
    page,
    limit: 20,
    action: actionFilter === "all" ? undefined : actionFilter,
    entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
  });

  function handleActionChange(value: string) {
    setActionFilter(value);
    setPage(1);
  }

  function handleEntityTypeChange(value: string) {
    setEntityTypeFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterIcon className="text-muted-foreground size-4" />
        <Select value={actionFilter} onValueChange={handleActionChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={handleEntityTypeChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by entity" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data !== undefined && (
          <span className="text-muted-foreground ml-auto text-sm">
            {String(data.total)} {data.total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <AuditLogContent data={data} isLoading={isLoading} onPageChange={setPage} />
    </div>
  );
}
