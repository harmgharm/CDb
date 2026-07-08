import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface GameBackButtonProps {
  readonly href?: string;
  readonly label?: string;
}

/**
 * Formalizes the ghost-button + Link + ArrowLeftIcon "Back" idiom already
 * used on Database/User detail pages, for the Play surfaces' setup and
 * results screens (kit's `.cdb-back-btn`, minus its in-round appearances —
 * the kit's always-present pill silently changes both label and destination
 * mid-session, so it's not replicated here; see the design-system spec's
 * Game play surfaces section for this decision).
 */
export function GameBackButton({ href = "/play", label = "Back to games" }: GameBackButtonProps) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        <ArrowLeftIcon className="mr-1 size-4" />
        {label}
      </Link>
    </Button>
  );
}
