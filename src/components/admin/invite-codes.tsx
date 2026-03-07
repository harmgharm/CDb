"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useDeleteInviteCode,
  useGenerateInviteCode,
  useInviteCodes,
  useUpdateInviteCode,
} from "@/hooks/use-admin";
import type { InviteCodeItem } from "@/types/admin-responses";

const DURATION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
];

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

// ============================================
// Edit Expiry Dialog
// ============================================

interface EditExpiryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly code: InviteCodeItem;
  readonly onSaved: () => void;
}

function EditExpiryDialog({ open, onOpenChange, code, onSaved }: EditExpiryDialogProps) {
  const { updateCode, isUpdating } = useUpdateInviteCode();
  const [days, setDays] = useState("30");

  async function handleSave() {
    const success = await updateCode(code.id, Number(days));
    if (success) {
      toast.success("Invite code expiry updated");
      onOpenChange(false);
      onSaved();
    } else {
      toast.error("Failed to update invite code");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Expiry</DialogTitle>
          <DialogDescription>
            Set a new validity duration for code{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs font-medium">{code.code}</code>.
            The expiry will be recalculated from today.
          </DialogDescription>
        </DialogHeader>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={isUpdating}
            onClick={() => {
              void handleSave();
            }}
          >
            {isUpdating ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Delete Confirm Dialog
// ============================================

interface DeleteCodeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly code: InviteCodeItem;
  readonly onDeleted: () => void;
}

function DeleteCodeDialog({ open, onOpenChange, code, onDeleted }: DeleteCodeDialogProps) {
  const { deleteCode, isDeleting } = useDeleteInviteCode();

  async function handleDelete() {
    const success = await deleteCode(code.id);
    if (success) {
      toast.success("Invite code deleted");
      onOpenChange(false);
      onDeleted();
    } else {
      toast.error("Failed to delete invite code");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Invite Code</DialogTitle>
          <DialogDescription>
            Delete invite code{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs font-medium">{code.code}</code>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={() => {
              void handleDelete();
            }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Invite Code Row Actions
// ============================================

interface RowActionsProps {
  readonly code: InviteCodeItem;
  readonly onChanged: () => void;
}

function RowActions({ code, onChanged }: RowActionsProps) {
  const status = getCodeStatus(code);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (status === "used") return null;

  return (
    <>
      <div className="flex gap-0.5">
        {status === "active" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setShowEdit(true);
            }}
          >
            <PencilIcon className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive size-7"
          onClick={() => {
            setShowDelete(true);
          }}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>

      {showEdit && (
        <EditExpiryDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          code={code}
          onSaved={onChanged}
        />
      )}

      <DeleteCodeDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        code={code}
        onDeleted={onChanged}
      />
    </>
  );
}

// ============================================
// Table Content
// ============================================

interface InviteCodesContentProps {
  readonly codes: InviteCodeItem[] | undefined;
  readonly isLoading: boolean;
  readonly justGenerated: boolean;
  readonly onChanged: () => void;
}

function InviteCodesContent({
  codes,
  isLoading,
  justGenerated,
  onChanged,
}: InviteCodesContentProps) {
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
            <TableHead className="w-20">Actions</TableHead>
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
                {code.created_by_username ?? "\u2014"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {code.used_by_username ?? "\u2014"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(code.expires_at)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(code.created_at)}
              </TableCell>
              <TableCell>
                <RowActions code={code} onChanged={onChanged} />
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function InviteCodes() {
  const { data: codes, isLoading, mutate } = useInviteCodes();
  const { generate, isGenerating } = useGenerateInviteCode();
  const [justGenerated, setJustGenerated] = useState(false);
  const [duration, setDuration] = useState("30");

  async function handleGenerate() {
    const success = await generate(Number(duration));
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

  function handleDataChange() {
    void mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Generate invite codes for new members with a custom validity period.
        </p>
        <div className="flex items-center gap-2">
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      <InviteCodesContent
        codes={codes}
        isLoading={isLoading}
        justGenerated={justGenerated}
        onChanged={handleDataChange}
      />
    </div>
  );
}
