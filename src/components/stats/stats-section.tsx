"use client";

import { ChevronDownIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface StatsSectionProps {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
}

export function StatsSection({ title, icon, defaultOpen = false, children }: StatsSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="bg-card hover:bg-accent/50 group flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground">{icon}</div>
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <ChevronDownIcon className="text-muted-foreground size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pt-4 pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
