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
            <SidebarInset>
              <header className="bg-background sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1 size-11" />
                <div className="ml-auto">
                  <NotificationBell />
                </div>
              </header>
              <main className="flex-1 p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </AblyProvider>
      </AuthProvider>
    </SWRProvider>
  );
}
