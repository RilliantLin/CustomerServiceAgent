import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import {
  buildKnowledgeEmbeddingInput,
  cosineSimilarity,
  createEmbedding,
  isEmbeddingEnabled,
  parseEmbedding,
} from "./embeddings";

const originalEnv = { ...ENV };

describe("embedding helpers", () => {
  beforeEach(() => {
    Object.assign(ENV, {
      ...originalEnv,
      ragEmbeddingsEnabled: true,
      embeddingProvider: "openai",
      openAiApiKey: "sk-test-key-1234567890",
      openAiEmbeddingBaseUrl: "https://api.openai.com",
      openAiEmbeddingPath: "/v1/embeddings",
      openAiEmbeddingModel: "text-embedding-test",
    });
  });

  afterEach(() => {
    Object.assign(ENV, originalEnv);
    vi.restoreAllMocks();
  });

  it("builds stable knowledge text for document embeddings", () => {
    const input = buildKnowledgeEmbeddingInput({
      title: "退货政策",
      category: "售后",
      keywords: "退货,退款",
      content: "30 天内可申请退货。",
    });

    expect(input).toBe("标题：退货政策\n分类：售后\n关键词：退货,退款\n内容：30 天内可申请退货。");
  });

  it("creates embeddings through the configured provider", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
        }),
        { status: 200 }
      )
    );

    const vector = await createEmbedding("物流多久发货", "query");

    expect(vector).toEqual([0.1, 0.2, 0.3]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "text-embedding-test",
      input: "物流多久发货",
    });
  });

  it("computes cosine similarity and rejects invalid vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });

  it("parses persisted embeddings only when they are numeric arrays", () => {
    expect(parseEmbedding("[1,2,3]")).toEqual([1, 2, 3]);
    expect(parseEmbedding([1, 2, 3])).toEqual([1, 2, 3]);
    expect(parseEmbedding("[1,\"x\"]")).toBeNull();
    expect(parseEmbedding("not-json")).toBeNull();
  });

  it("honors the embedding enabled switch", () => {
    ENV.ragEmbeddingsEnabled = false;
    expect(isEmbeddingEnabled()).toBe(false);

    ENV.ragEmbeddingsEnabled = true;
    ENV.embeddingProvider = "openai";
    ENV.openAiApiKey = "";
    expect(isEmbeddingEnabled()).toBe(false);
  });
});
