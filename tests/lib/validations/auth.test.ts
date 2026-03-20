import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      identifier: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases identifier", () => {
    const result = loginSchema.safeParse({
      identifier: "  User@Example.COM  ",
      password: "pass",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.identifier).toBe("user@example.com");
  });

  it("rejects empty identifier", () => {
    const result = loginSchema.safeParse({ identifier: "", password: "pass" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ identifier: "user", password: "" });
    expect(result.success).toBe(false);
  });

  it("accepts username as identifier", () => {
    const result = loginSchema.safeParse({ identifier: "johndoe", password: "pass" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  const validInput = {
    email: "user@example.com",
    username: "johndoe",
    password: "securepass123",
    inviteCode: "ABC123",
  };

  it("accepts valid registration", () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("lowercases email and username", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      email: "USER@EXAMPLE.COM",
      username: "JohnDoe",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.email).toBe("user@example.com");
    expect(result.data.username).toBe("johndoe");
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 chars", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 20 chars", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "a".repeat(21) });
    expect(result.success).toBe(false);
  });

  it("rejects username starting with a number", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "1user" });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "user@name" });
    expect(result.success).toBe(false);
  });

  it("allows underscores in username", () => {
    const result = registerSchema.safeParse({ ...validInput, username: "john_doe" });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = registerSchema.safeParse({ ...validInput, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 chars", () => {
    const result = registerSchema.safeParse({ ...validInput, password: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("rejects missing invite code", () => {
    const { inviteCode: _, ...noCode } = validInput;
    const result = registerSchema.safeParse(noCode);
    expect(result.success).toBe(false);
  });

  it("rejects empty invite code", () => {
    const result = registerSchema.safeParse({ ...validInput, inviteCode: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional displayName", () => {
    const result = registerSchema.safeParse({ ...validInput, displayName: "John" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.displayName).toBe("John");
  });
});
