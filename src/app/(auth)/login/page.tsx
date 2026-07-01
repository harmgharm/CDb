"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";
import type { ApiResponse } from "@/lib/api/response";
import type { SafeUser } from "@/types/auth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/home";

  useRedirectIfAuthenticated(callbackUrl);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = (await response.json()) as ApiResponse<SafeUser>;

      if (!response.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      // Full page load (not client-side nav) so the authenticated layout
      // mounts fresh with the new cookies — avoids stale SWR cache from
      // the pre-login state causing a silent redirect loop back to /login.
      globalThis.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground -mb-2 text-[11px] font-medium tracking-[0.18em] uppercase">
        Welcome back
      </p>
      <h1 className="font-display text-[clamp(40px,6vw,56px)] leading-[1.0] tracking-tight">
        Ready for <em className="text-cdb-marquee italic">another?</em>
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">Pick up where you left off.</p>

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
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="you@example.com or username"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
            }}
            required
            autoComplete="username"
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
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
          {!loading && <ArrowRightIcon />}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          Have an invite code?{" "}
          <Link
            href="/signup"
            className="text-cdb-marquee font-medium underline underline-offset-[3px]"
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
