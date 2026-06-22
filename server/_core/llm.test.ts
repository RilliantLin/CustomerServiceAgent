import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

const originalEnv = { ...ENV };

describe("OpenAI Responses provider", () => {
  beforeEach(() => {
    Object.assign(ENV, {
      ...originalEnv,
      llmProvider: "openai",
      openAiApiKey: "sk-test-key-1234567890",
      openAiBaseUrl: "https://api.openai.com",
      openAiModel: "gpt-test",
    });
  });

  afterEach(() => {
    Object.assign(ENV, originalEnv);
    vi.restoreAllMocks();
  });

  it("maps Responses API output and usage into InvokeResult", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_123",
          model: "gpt-test",
          status: "completed",
          created_at: 1_700_000_000,
          output_text: "您好，密码可以通过忘记密码入口重置。",
          usage: {
            input_tokens: 21,
            output_tokens: 13,
            total_tokens: 34,
          },
        }),
        { status: 200 }
      )
    );

    const result = await invokeLLM({
      messages: [
        { role: "system", content: "只基于知识库回答" },
        { role: "user", content: "忘记密码怎么办？" },
      ],
      maxTokens: 200,
    });

    expect(result.id).toBe("resp_123");
    expect(result.choices[0]?.message.content).toContain("忘记密码");
    expect(result.choices[0]?.finish_reason).toBe("stop");
    expect(result.usage).toEqual({
      prompt_tokens: 21,
      completion_tokens: 13,
      total_tokens: 34,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer sk-test-key-1234567890",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "gpt-test",
      instructions: "只基于知识库回答",
      input: [{ role: "user", content: "忘记密码怎么办？" }],
      max_output_tokens: 200,
    });
  });

  it("redacts OpenAI credentials from provider errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "bad key sk-live-secret-1234567890 Bearer token-value",
          },
        }),
        { status: 401, statusText: "Unauthorized" }
      )
    );

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hello" }] })
    ).rejects.toThrow(/sk-\[redacted\]/);
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hello" }] })
    ).rejects.not.toThrow(/sk-live-secret/);
  });
});
