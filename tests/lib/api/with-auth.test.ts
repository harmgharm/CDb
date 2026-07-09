import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { getAuthUser, getAdminUser, getModeratorUser } = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  getAdminUser: vi.fn(),
  getModeratorUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser, getAdminUser, getModeratorUser }));

import { withAdmin, withAuth, withModerator } from "@/lib/api/with-auth";

const mockUser = { id: "u1", role: "member" } as never;
const req = new NextRequest("http://localhost/api/test");

async function readJson(response: NextResponse) {
  return (await response.json()) as { data: unknown; error: string | null };
}

describe("withAuth", () => {
  it("returns 401 and does not call the handler when unauthenticated", async () => {
    getAuthUser.mockResolvedValueOnce(null);
    const handler = vi.fn();

    const response = await withAuth(handler)(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ data: null, error: "Not authenticated" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler with the resolved user when authenticated", async () => {
    getAuthUser.mockResolvedValueOnce(mockUser);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: "ok", error: null }));

    const context = { params: Promise.resolve({ id: "abc" }) };
    await withAuth<{ id: string }>(handler)(req, context);

    expect(handler).toHaveBeenCalledWith(req, mockUser, context);
  });
});

describe("withAdmin", () => {
  it("returns 403 when not an admin", async () => {
    getAdminUser.mockResolvedValueOnce(null);
    const handler = vi.fn();

    const response = await withAdmin(handler)(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ data: null, error: "Not authorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler when admin", async () => {
    getAdminUser.mockResolvedValueOnce(mockUser);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: "ok", error: null }));

    await withAdmin(handler)(req, { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalled();
  });
});

describe("withModerator", () => {
  it("returns 403 when not a moderator or admin", async () => {
    getModeratorUser.mockResolvedValueOnce(null);
    const handler = vi.fn();

    const response = await withModerator(handler)(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler when moderator", async () => {
    getModeratorUser.mockResolvedValueOnce(mockUser);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: "ok", error: null }));

    await withModerator(handler)(req, { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalled();
  });
});
