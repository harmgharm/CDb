"use client";

import { CheckIcon, ListPlusIcon, Loader2Icon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProposeToQueue, useQueue } from "@/hooks/use-queue";

interface ProposeToQueueButtonProps {
  readonly mediaId: string;
  readonly size?: "sm" | "default" | "icon";
}

/**
 * Proposes an (already-imported) title to the group queue from its detail page.
 *
 * Reads the live queue to know whether the title is already up (scheduled pick
 * or an open proposal). Once it is, the action has nothing left to do — a
 * proposal can't be withdrawn from here without risking deletion of the media
 * entry itself — so it collapses to a quiet, non-interactive "In the queue" tag
 * in the button's place rather than a dead disabled button. The propose
 * endpoint dedups server-side too, so a race just resolves to "already
 * proposed" rather than a duplicate.
 */
export function ProposeToQueueButton({ mediaId, size = "sm" }: ProposeToQueueButtonProps) {
  const { scheduled, proposals, refresh } = useQueue();
  const { propose, isProposing } = useProposeToQueue();

  // The title is "in the queue" if it's the scheduled pick or any open proposal.
  const isProposed = useMemo(() => {
    if (scheduled !== null && scheduled.media.id === mediaId) {
      return true;
    }
    return proposals.some((proposal) => proposal.media.id === mediaId);
  }, [scheduled, proposals, mediaId]);

  async function handleClick() {
    const outcome = await propose(mediaId);
    if (outcome === null) {
      toast.error("Couldn't propose that title");
      return;
    }
    await refresh();
    toast.success(outcome.alreadyProposed ? "Already in the queue" : "Proposed to the queue");
  }

  if (isProposed) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 px-1 text-sm">
        <CheckIcon className="text-cdb-marquee size-4" />
        In the queue
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      disabled={isProposing}
      onClick={() => {
        void handleClick();
      }}
    >
      {isProposing ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ListPlusIcon className="size-4" />
      )}
      {size !== "icon" && "Propose"}
    </Button>
  );
}
