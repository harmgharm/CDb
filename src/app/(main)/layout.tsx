"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notifications";
import { AblyProvider } from "@/components/providers/ably-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SWRProvider>
      <AuthProvider>
        <AblyProvider>
          <SidebarProvider>
            <AppSidebar />
            {/* min-w-0 on BOTH the inset and the inner <main> lets the content
                column shrink instead of forcing the flex row wider than the
                viewport. Without it, wide content (a full table, a long
                unbreakable title) floors the column at its min-content and
                pushes the whole page into a horizontal scrollbar — most visibly
                in the 900-940px band where the docked 256px rail leaves the
                least room. Each flex level needs its own min-w-0 for the shrink
                to propagate down to the table's own overflow-x-auto box.
                Applied via className, not by editing the shadcn primitive. */}
            <SidebarInset className="min-w-0">
              <header className="bg-background sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1 size-11" />
                <div className="ml-auto">
                  <NotificationBell />
                </div>
              </header>
              <main className="min-w-0 flex-1 p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </AblyProvider>
      </AuthProvider>
    </SWRProvider>
  );
}
