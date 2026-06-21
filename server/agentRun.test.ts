import { describe, expect, it } from "vitest";
import type { AgentRunStatus, AgentRunStepType } from "./db";

const runStatuses: AgentRunStatus[] = [
  "queued",
  "planning",
  "running",
  "waiting_approval",
  "failed",
  "completed",
];

const stepTypes: AgentRunStepType[] = [
  "thinking",
  "tool_call",
  "tool_result",
  "final",
  "error",
];

describe("agent run lifecycle types", () => {
  it("covers the persisted run states required by phase 4", () => {
    expect(runStatuses).toEqual([
      "queued",
      "planning",
      "running",
      "waiting_approval",
      "failed",
      "completed",
    ]);
  });

  it("covers the persisted step event types emitted by the agent service", () => {
    expect(stepTypes).toEqual([
      "thinking",
      "tool_call",
      "tool_result",
      "final",
      "error",
    ]);
  });
});
