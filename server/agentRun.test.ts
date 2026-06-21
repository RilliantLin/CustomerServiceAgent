import { describe, expect, it } from "vitest";
import type { AgentRunStatus, AgentRunStepType } from "./db";
import {
  StructuredAgentOutputSchema,
  buildStructuredAgentOutput,
  evaluateInputGuardrails,
} from "./agentService";

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

describe("agent guardrails and structured output", () => {
  it("blocks obvious sensitive credentials before model execution", () => {
    const result = evaluateInputGuardrails("我的 password: hunter2 帮我看看");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("sensitive_information");
      expect(result.message).toContain("敏感信息");
    }
  });

  it("builds valid structured output from normal agent text", () => {
    const structured = buildStructuredAgentOutput({
      userContent: "帮我总结最近工单，物流一直没更新",
      assistantContent: "最近工单显示物流延迟，建议查看相关工单详情并继续跟进。",
      events: [
        {
          type: "tool_result",
          toolName: "listTickets",
          resultSummary: JSON.stringify({
            count: 1,
            tickets: [{ id: 12, title: "物流延迟" }],
          }),
        },
      ],
    });

    expect(StructuredAgentOutputSchema.safeParse(structured).success).toBe(true);
    expect(structured.category).toBe("shipping");
    expect(structured.referencedTicketIds).toEqual([12]);
  });

  it("repairs partial structured JSON embedded in model output", () => {
    const structured = buildStructuredAgentOutput({
      userContent: "我想退款",
      assistantContent:
        '```json\n{"category":"refund","summary":"用户咨询退款","suggestedActions":["核对订单状态"],"shouldCreateTicket":true}\n```',
      events: [],
    });

    expect(structured.category).toBe("refund");
    expect(structured.riskLevel).toBe("medium");
    expect(structured.suggestedActions).toEqual(["核对订单状态"]);
  });
});
