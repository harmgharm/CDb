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

import { Wordmark } from "@/components/branding/wordmark";
import { OnlineUsersSection } from "@/components/online-users";
import { useAuth } from "@/components/providers/auth-provider";
import { UpNextCard } from "@/components/sidebar/up-next-card";
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

/** Kit's `.cdb-nav-item.active`: amber text/icon + elev-3 background. Scoped to this file's nav
 *  buttons only. The left rail lives on `NAV_ITEM_RAIL_CLASS` (on `SidebarMenuItem`) instead of
 *  here — `SidebarMenuButton` clips overflow, so a `before:` bleeding outside its own box (to sit
 *  in the sidebar gutter, like the kit's un-clipped `.cdb-nav-item`) would be invisible on the
 *  button itself. */
const NAV_ACTIVE_CLASS =
  "data-[active=true]:bg-[var(--bg-elev-3)] data-[active=true]:text-cdb-marquee-text " +
  "[&[data-active=true]>svg]:text-cdb-marquee-text " +
  "[&[data-active=true]_.cdb-nav-admin-tag]:text-cdb-marquee-text";

/** `SidebarMenuItem` (a plain `<li>`, not overflow-clipped) hosts the amber left rail via
 *  `has-data-[active=true]`, since it targets the active button's `data-active` from the child.
 *  `-left-2` (not the kit's literal `-10px`) is deliberate: `SidebarContent` (a few ancestors up)
 *  has `overflow-auto` for scrolling a long nav list, which clips anything bleeding past its own
 *  box. `SidebarGroup`'s `p-2` padding sits *inside* that clip boundary, so `-left-2` (-8px) lands
 *  in that already-visible padding gutter instead of being clipped like the kit's `-10px` bleed
 *  would be. */
const NAV_ITEM_RAIL_CLASS =
  "has-data-[active=true]:before:absolute has-data-[active=true]:before:-left-2 " +
  "has-data-[active=true]:before:inset-y-2 has-data-[active=true]:before:w-0.5 " +
  "has-data-[active=true]:before:rounded-full has-data-[active=true]:before:bg-cdb-marquee";

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
        <Link
          href="/home"
          className="hover:bg-sidebar-accent flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors group-data-[collapsible=icon]:hidden"
        >
          <span className="bg-cdb-marquee flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--cdb-ink-950)]">
            <ClapperboardIcon className="size-4" />
          </span>
          <span className="flex flex-col gap-0.5">
            <Wordmark size="sm" />
            <span className="text-muted-foreground text-xs">Movie nights, tracked.</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <UpNextCard />
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href} className={NAV_ITEM_RAIL_CLASS}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                    className={NAV_ACTIVE_CLASS}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {user?.role === "admin" && (
                <SidebarMenuItem className={NAV_ITEM_RAIL_CLASS}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin"
                    className={NAV_ACTIVE_CLASS}
                  >
                    <Link href="/admin">
                      <ShieldIcon />
                      <span>Admin</span>
                      <span className="cdb-nav-admin-tag ml-auto font-mono text-[9px] tracking-[0.1em] text-[var(--fg-dim)] uppercase">
                        admin
                      </span>
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
                    className="border-border data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border bg-[var(--bg-elev-2)]"
                  >
                    <Avatar className="size-7">
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
