import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/passwords";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("MySecureP@ss123");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("MySecureP@ss123");

    const valid = await verifyPassword(hash, "MySecureP@ss123");
    expect(valid).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const valid = await verifyPassword(hash, "wrong-password");
    expect(valid).toBe(false);
  });

  it("produces different hashes for same password (salted)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });

  it("returns false for malformed hash", async () => {
    const result = await verifyPassword("not-a-valid-hash", "password");
    expect(result).toBe(false);
  });

  it("returns false for empty hash", async () => {
    const result = await verifyPassword("", "password");
    expect(result).toBe(false);
  });
});
