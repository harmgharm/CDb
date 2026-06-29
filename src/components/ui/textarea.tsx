import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // No field-sizing-content: it sizes the textarea to its content's
        // intrinsic WIDTH, so a long unbroken token (a pasted URL) bursts the
        // textarea out of its container (e.g. a dialog) and width caps can't
        // rein it back in. Instead use a fixed min-h with a max-h ceiling and
        // internal scroll; min-w-0 + break-words keep long tokens inside the box.
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex max-h-[40vh] min-h-16 w-full min-w-0 resize-none overflow-auto rounded-md border bg-transparent px-3 py-2 text-base break-words shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
