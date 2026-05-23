"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";
import type { ApiResponse } from "@/lib/api/response";
import type { SafeUser } from "@/types/auth";

export default function SignupPage() {
  useRedirectIfAuthenticated("/home");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          displayName: displayName.length > 0 ? displayName : undefined,
          inviteCode,
        }),
      });

      const data = (await response.json()) as ApiResponse<SafeUser>;

      if (!response.ok) {
        setError(data.error ?? "Signup failed");
        return;
      }

      globalThis.location.href = "/home";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        Sign up
      </p>
      <h1 className="font-display text-[clamp(40px,6vw,56px)] leading-[1.0] tracking-tight">
        Join <em className="text-cdb-marquee italic">the group</em>
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        An invite code from an admin gets you in.
      </p>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error.length > 0 && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            type="text"
            placeholder="CDB-XXXX-XXXX"
            value={inviteCode}
            onChange={(event) => {
              setInviteCode(event.target.value);
            }}
            required
            className="font-mono tracking-[0.04em]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="coolwatcher42"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
            }}
            required
            autoComplete="username"
            minLength={3}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">
            Display name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="display-name"
            type="text"
            placeholder="Your Name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-muted-foreground text-xs">Minimum 8 characters.</p>
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-cdb-marquee font-medium underline underline-offset-[3px]"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
