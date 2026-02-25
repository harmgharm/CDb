"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SWRProvider>
      <AuthProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
            </header>
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </AuthProvider>
    </SWRProvider>
  );
}
