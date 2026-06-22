import { describe, expect, it } from "vitest";
import { sanitizeLogValue } from "./observability";

describe("log sanitization", () => {
  it("redacts credentials without hiding usage counters", () => {
    const sanitized = sanitizeLogValue({
      authorization: "Bearer sk-live-secret-1234567890",
      promptTokens: 12,
      completionTokens: 5,
      nested: {
        apiKey: "sk-nested-secret-1234567890",
        message: "failed with password: hunter2",
      },
    });

    expect(sanitized).toEqual({
      authorization: "[redacted]",
      promptTokens: 12,
      completionTokens: 5,
      nested: {
        apiKey: "[redacted]",
        message: "failed with password=[redacted]",
      },
    });
  });
});
