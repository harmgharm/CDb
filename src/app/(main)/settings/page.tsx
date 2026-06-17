"use client";

import { BellIcon, KeyIcon, LogOutIcon, PlusIcon, UserIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notifications";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/types/auth";

type Section = "profile" | "password" | "notifications";

function getInitials(displayName: string | null, username: string): string {
  const source = displayName !== null && displayName.length > 0 ? displayName : username;
  return source.slice(0, 2).toUpperCase();
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-end justify-between gap-6 border-b border-[var(--border-strong)] pb-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="size-22 rounded-full" />
      </div>
      <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

// ============================================
// Editorial pane head — shared chrome above each form
// ============================================

interface PaneHeadProps {
  readonly title: string;
  readonly sub: string;
}

function PaneHead({ title, sub }: PaneHeadProps) {
  return (
    <div className="border-b border-[var(--border)] pb-4">
      <h2 className="font-display m-0 text-[28px] leading-none font-normal tracking-[-0.015em]">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1.5 text-sm">{sub}</p>
    </div>
  );
}

// ============================================
// Profile Form
// ============================================

interface ProfileFormProps {
  readonly user: SafeUser;
  readonly onSaved: () => Promise<void>;
  /** Bumped by the header "Change" affordance to focus the avatar URL field. */
  readonly avatarFocusKey: number;
}

function ProfileForm({ user, onSaved, avatarFocusKey }: ProfileFormProps) {
  const { updateProfile, isUpdating, error } = useUpdateProfile();

  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Focus the avatar URL field when the header "Change" affordance is used.
  // avatarFocusKey starts at 0 (no focus on mount) and increments per click.
  useEffect(() => {
    if (avatarFocusKey > 0) {
      avatarInputRef.current?.focus();
    }
  }, [avatarFocusKey]);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const data: Record<string, string> = {};
    if (displayName !== (user.displayName ?? "")) {
      data.displayName = displayName.length > 0 ? displayName : "";
    }
    if (username !== user.username) {
      data.username = username;
    }
    if (email !== user.email) {
      data.email = email;
    }
    if (avatarUrl !== (user.avatarUrl ?? "")) {
      data.avatarUrl = avatarUrl.length > 0 ? avatarUrl : "";
    }

    if (Object.keys(data).length === 0) {
      toast.info("No changes to save");
      return;
    }

    const success = await updateProfile(user.id, data);
    if (success) {
      toast.success("Profile updated");
      await onSaved();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PaneHead title="Profile" sub="How the group sees you." />
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="flex max-w-[460px] flex-col gap-[18px]"
      >
        {error !== null && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            placeholder="Your display name"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
            }}
            placeholder="username"
            minLength={3}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            ref={avatarInputRef}
            type="url"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value);
            }}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <div className="mt-2">
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// Change Password Form
// ============================================

function ChangePasswordForm() {
  const { changePassword, isChanging, error } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    const success = await changePassword({ currentPassword, newPassword, confirmPassword });
    if (success) {
      toast.success("Password changed. Other sessions have been logged out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PaneHead
        title="Password"
        sub="Update your password. All other sessions will be logged out."
      />
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="flex max-w-[460px] flex-col gap-[18px]"
      >
        {error !== null && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
            }}
            required
            autoComplete="current-password"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
            }}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
            }}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </div>

        <div className="mt-2">
          <Button type="submit" disabled={isChanging}>
            {isChanging ? "Changing..." : "Change Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// Notification Preferences
// ============================================

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  "session.rate_pending": {
    label: "Rate reminders",
    description: "Reminders to rate media after watching sessions",
  },
  "session.created": {
    label: "New sessions",
    description: "When someone logs a new watching session",
  },
  "rating.submitted": {
    label: "Ratings on your picks",
    description: "When someone rates media you picked",
  },
  "watchlist.friend_watched": {
    label: "Watchlist updates",
    description: "When friends watch something on your watchlist",
  },
};

function NotificationPreferencesForm() {
  const { data, isLoading } = useNotificationPreferences();
  const { updatePreferences, isUpdating } = useUpdateNotificationPreferences();

  // Optimistic overrides — null means use SWR data as-is
  const [optimisticPrefs, setOptimisticPrefs] = useState<Record<string, boolean> | null>(null);
  const displayPrefs = optimisticPrefs ?? data?.preferences ?? {};

  async function handleToggle(type: string, enabled: boolean) {
    const updated = { ...displayPrefs, [type]: enabled };
    setOptimisticPrefs(updated);

    const success = await updatePreferences(updated);
    if (success) {
      toast.success("Notification preferences updated");
    } else {
      toast.error("Failed to update preferences");
    }
    setOptimisticPrefs(null);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PaneHead title="Notifications" sub="Pick what shows up in your bell." />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PaneHead title="Notifications" sub="Pick what shows up in your bell." />
      <div className="flex flex-col">
        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, { label, description }]) => (
          <div
            key={type}
            className="flex items-center justify-between gap-6 border-b border-[var(--border)] py-4 last:border-b-0"
          >
            <div className="space-y-0.5">
              <Label htmlFor={`notif-${type}`} className="text-sm font-medium">
                {label}
              </Label>
              <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <Switch
              id={`notif-${type}`}
              checked={displayPrefs[type] !== false}
              onCheckedChange={(checked) => {
                void handleToggle(type, checked);
              }}
              disabled={isUpdating}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Rail
// ============================================

const RAIL_ITEMS: readonly { id: Section; label: string; icon: typeof UserIcon }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "password", label: "Password", icon: KeyIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
];

interface SettingsRailProps {
  readonly section: Section;
  readonly onSelect: (section: Section) => void;
  readonly onLogout: () => void;
}

function SettingsRail({ section, onSelect, onLogout }: SettingsRailProps) {
  return (
    <aside className="flex flex-col gap-0.5 lg:sticky lg:top-2 lg:self-start">
      {RAIL_ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = section === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              onSelect(id);
            }}
            aria-pressed={isActive}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
              "before:absolute before:top-2 before:bottom-2 before:-left-0.5 before:w-0.5 before:rounded-r before:bg-[var(--cdb-marquee)] before:transition-opacity",
              isActive
                ? "bg-[var(--bg-elev-2)] text-[var(--cdb-marquee)] before:opacity-100"
                : "text-muted-foreground hover:text-foreground before:opacity-0 hover:bg-[var(--bg-elev-2)]",
            )}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        );
      })}

      <div className="mx-3 my-2 h-px bg-[var(--border)]" />

      <button
        type="button"
        onClick={onLogout}
        className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-[var(--fg-dim)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--cdb-cherry-hi)]"
      >
        <LogOutIcon className="size-3.5" />
        <span>Log out</span>
      </button>
    </aside>
  );
}

// ============================================
// Pane wrapper — animates in on becoming active without remounting children
// ============================================

interface SettingsPaneProps {
  readonly active: boolean;
  readonly children: React.ReactNode;
}

function SettingsPane({ active, children }: SettingsPaneProps) {
  // animate prop reacts to `active`, so switching panes plays the fade/slide
  // each time. Children are never keyed/unmounted, so form state survives.
  return (
    <motion.div
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" as const }}
      className={active ? "" : "pointer-events-none hidden"}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Settings Page
// ============================================

export default function SettingsPage() {
  const { user, isLoading, logout, mutate } = useAuth();

  const [section, setSection] = useState<Section>("profile");
  const [avatarFocusKey, setAvatarFocusKey] = useState(0);

  if (isLoading || user === null) {
    return <SettingsSkeleton />;
  }

  const eyebrowName =
    user.displayName !== null && user.displayName.length > 0 ? user.displayName : user.username;

  function handleAvatarChange() {
    setSection("profile");
    setAvatarFocusKey((previous) => previous + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Editorial header — hand-rolled two-column lockup with avatar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
        className="flex flex-col-reverse items-start justify-between gap-6 border-b border-[var(--border-strong)] pb-6 sm:flex-row sm:items-end"
      >
        <div className="max-w-[640px] min-w-0">
          <div className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
            Account · {eyebrowName}
          </div>
          <h1 className="font-display mt-2 text-[clamp(40px,7vw,64px)] leading-[0.95] font-normal tracking-[-0.03em]">
            The <em className="text-cdb-marquee-text italic">fine print</em>
          </h1>
          <p className="font-display text-muted-foreground mt-1.5 text-base italic">
            Your name, your password, your notifications.
          </p>
        </div>

        <div className="relative shrink-0">
          <Avatar className="size-22 border-2 shadow-lg">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={eyebrowName} />
            <AvatarFallback className="text-xl">
              {getInitials(user.displayName, user.username)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={handleAvatarChange}
            aria-label="Change avatar, jumps to the avatar URL field"
            className="absolute -right-1 -bottom-1 inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elev-3)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] text-[var(--fg-muted)] uppercase transition-colors hover:border-[var(--cdb-marquee)] hover:text-[var(--cdb-marquee)]"
          >
            <PlusIcon className="size-3" />
            Change
          </button>
        </div>
      </motion.header>

      {/* Body — sticky rail + swapping pane */}
      <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
        <SettingsRail
          section={section}
          onSelect={setSection}
          onLogout={() => {
            void logout();
          }}
        />

        <main className="min-w-0">
          {/* Each pane stays mounted (hidden, not unmounted) so unsaved input and the
              optimistic notification toggle persist across pane switches. The fade/slide
              rides each pane's own visibility, so we animate on switch WITHOUT remounting
              the form (a key on a shared wrapper would wipe the forms' useState). */}
          <SettingsPane active={section === "profile"}>
            <ProfileForm user={user} onSaved={mutate} avatarFocusKey={avatarFocusKey} />
          </SettingsPane>
          <SettingsPane active={section === "password"}>
            <ChangePasswordForm />
          </SettingsPane>
          <SettingsPane active={section === "notifications"}>
            <NotificationPreferencesForm />
          </SettingsPane>
        </main>
      </div>
    </div>
  );
}
