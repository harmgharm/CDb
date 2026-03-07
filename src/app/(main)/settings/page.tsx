"use client";

import { KeyIcon, UserIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-settings";
import type { SafeUser } from "@/types/auth";

function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ============================================
// Profile Form
// ============================================

interface ProfileFormProps {
  readonly user: SafeUser;
  readonly onSaved: () => Promise<void>;
}

function ProfileForm({ user, onSaved }: ProfileFormProps) {
  const { updateProfile, isUpdating, error } = useUpdateProfile();

  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="size-5" />
          Profile
        </CardTitle>
        <CardDescription>Update your personal information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
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
              type="url"
              value={avatarUrl}
              onChange={(event) => {
                setAvatarUrl(event.target.value);
              }}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyIcon className="size-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your password. All other sessions will be logged out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
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

          <Button type="submit" disabled={isChanging}>
            {isChanging ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================
// Settings Page
// ============================================

export default function SettingsPage() {
  const { user, isLoading, mutate } = useAuth();

  if (isLoading || user === null) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" as const }}
      >
        <ProfileForm user={user} onSaved={mutate} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" as const }}
      >
        <ChangePasswordForm />
      </motion.div>
    </div>
  );
}
