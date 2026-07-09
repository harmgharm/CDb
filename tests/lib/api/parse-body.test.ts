import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseBody } from "@/lib/api/parse-body";

const schema = z.object({ name: z.string() });

function jsonRequest(body: string) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}

/** Asserts a parseBody result failed and returns its error JSON. */
async function expectFailure(result: Awaited<ReturnType<typeof parseBody>>) {
  expect(result.success).toBe(false);
  const response = result.success ? undefined : result.response;
  return {
    status: response?.status,
    json: (await response?.json()) as { error: string } | undefined,
  };
}

describe("parseBody", () => {
  it("returns parsed data on a valid body", async () => {
    const result = await parseBody(jsonRequest(JSON.stringify({ name: "Alice" })), schema);

    expect(result).toEqual({ success: true, data: { name: "Alice" } });
  });

  it("returns a 400 response when the body fails schema validation", async () => {
    const result = await parseBody(jsonRequest(JSON.stringify({ name: 5 })), schema);

    const { status, json } = await expectFailure(result);
    expect(status).toBe(400);
    expect(json?.error).toBe("Invalid input");
  });

  it("returns a 400 response instead of throwing on a malformed body", async () => {
    const result = await parseBody(jsonRequest("not json"), schema);

    const { status } = await expectFailure(result);
    expect(status).toBe(400);
  });

  it("returns a 400 response instead of throwing on an empty body", async () => {
    const result = await parseBody(jsonRequest(""), schema);

    expect(result.success).toBe(false);
  });

  it("uses a custom message when provided", async () => {
    const result = await parseBody(jsonRequest("not json"), schema, "Invalid request body");

    const { json } = await expectFailure(result);
    expect(json?.error).toBe("Invalid request body");
  });

  it("derives the message from the Zod error when given a function", async () => {
    const result = await parseBody(
      jsonRequest(JSON.stringify({ name: 5 })),
      schema,
      (error) => `Invalid request: ${error.message}`,
    );

    const { json } = await expectFailure(result);
    expect(json?.error).toContain("Invalid request:");
  });
});
