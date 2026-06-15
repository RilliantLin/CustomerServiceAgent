import { ENV } from "./env";
import {
  buildOpenAiHttpError,
  fetchWithBackoff,
  resolveOpenAiApiUrl,
} from "./openai";

type EmbeddingResponse = {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
};

export function isEmbeddingEnabled() {
  return ENV.ragEmbeddingsEnabled && Boolean(ENV.openAiApiKey);
}

export function buildKnowledgeEmbeddingInput(entry: {
  title: string;
  content: string;
  category: string;
  keywords?: string | null;
}) {
  return [
    `标题：${entry.title}`,
    `分类：${entry.category}`,
    entry.keywords ? `关键词：${entry.keywords}` : "",
    `内容：${entry.content}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createEmbedding(input: string): Promise<number[]> {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required to generate embeddings");
  }

  const url = resolveOpenAiApiUrl(ENV.openAiEmbeddingPath, {
    baseUrl: ENV.openAiEmbeddingBaseUrl,
  });
  const response = await fetchWithBackoff(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: ENV.openAiEmbeddingModel,
        input,
      }),
    },
    "OpenAI embedding"
  );

  if (!response.ok) {
    throw await buildOpenAiHttpError({
      label: "OpenAI embedding",
      response,
      url,
      model: ENV.openAiEmbeddingModel,
    });
  }

  const data = (await response.json()) as EmbeddingResponse;
  const embedding = data.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("OpenAI embedding response did not include a vector");
  }

  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMagnitude += a[i] * a[i];
    bMagnitude += b[i] * b[i];
  }

  const denominator = Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}

export function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value) && value.every(item => typeof item === "number")) {
    return value;
  }
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "number")
      ? parsed
      : null;
  } catch {
    return null;
  }
}
