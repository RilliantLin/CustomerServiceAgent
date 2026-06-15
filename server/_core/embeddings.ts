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

type EmbeddingInputType = "query" | "document";

export function isEmbeddingEnabled() {
  if (!ENV.ragEmbeddingsEnabled) return false;
  if (ENV.embeddingProvider === "voyage") return Boolean(ENV.voyageApiKey);
  if (ENV.embeddingProvider === "openai") return Boolean(ENV.openAiApiKey);
  return false;
}

export function getEmbeddingProviderConfig() {
  if (ENV.embeddingProvider === "voyage") {
    return {
      provider: "voyage",
      apiKey: ENV.voyageApiKey,
      baseUrl: ENV.voyageBaseUrl,
      path: ENV.voyageEmbeddingPath,
      model: ENV.voyageEmbeddingModel,
    };
  }

  if (ENV.embeddingProvider === "openai") {
    return {
      provider: "openai",
      apiKey: ENV.openAiApiKey,
      baseUrl: ENV.openAiEmbeddingBaseUrl,
      path: ENV.openAiEmbeddingPath,
      model: ENV.openAiEmbeddingModel,
    };
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER "${ENV.embeddingProvider}". Use "voyage" or "openai".`
  );
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

export async function createEmbedding(
  input: string,
  inputType: EmbeddingInputType = "document"
): Promise<number[]> {
  const config = getEmbeddingProviderConfig();

  if (!config.apiKey) {
    const envName =
      config.provider === "voyage" ? "VOYAGE_API_KEY" : "OPENAI_API_KEY";
    throw new Error(`${envName} is required to generate embeddings`);
  }

  const url = resolveOpenAiApiUrl(config.path, {
    baseUrl: config.baseUrl,
  });
  const label =
    config.provider === "voyage" ? "Voyage embedding" : "OpenAI embedding";
  const body =
    config.provider === "voyage"
      ? {
          model: config.model,
          input,
          input_type: inputType,
        }
      : {
          model: config.model,
          input,
        };

  const response = await fetchWithBackoff(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    label
  );

  if (!response.ok) {
    throw await buildOpenAiHttpError({
      label,
      response,
      url,
      model: config.model,
    });
  }

  const data = (await response.json()) as EmbeddingResponse;
  const embedding = data.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error(`${label} response did not include a vector`);
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
