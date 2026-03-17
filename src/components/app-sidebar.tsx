"use client";

import {
  ClapperboardIcon,
  DatabaseIcon,
  Gamepad2Icon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { OnlineUsersSection } from "@/components/online-users";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Home", href: "/home", icon: HomeIcon },
  { title: "Database", href: "/database", icon: DatabaseIcon },
  { title: "For You", href: "/recommendations", icon: SparklesIcon },
  { title: "Play", href: "/play", icon: Gamepad2Icon },
  { title: "Users", href: "/users", icon: UsersIcon },
] as const;

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ThemeMenuItem() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }}
    >
      <div className="relative mr-2 size-4">
        <SunIcon className="absolute size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </div>
      Toggle theme
    </DropdownMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/home">
                <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <ClapperboardIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">CinemaDB</span>
                  <span className="text-muted-foreground truncate text-xs">Movie tracker</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin"
                  >
                    <Link href="/admin">
                      <ShieldIcon />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <OnlineUsersSection />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {user !== null && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8">
                      <AvatarImage
                        src={user.avatarUrl ?? undefined}
                        alt={user.displayName ?? user.username}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.displayName, user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.displayName ?? user.username}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" side="top" sideOffset={4}>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm leading-none font-medium">
                        {user.displayName ?? user.username}
                      </p>
                      <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${user.id}`}>
                      <UserIcon className="mr-2 size-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <SettingsIcon className="mr-2 size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <ThemeMenuItem />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void logout();
                    }}
                  >
                    <LogOutIcon className="mr-2 size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
