import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

type TransformersModule = typeof import("@xenova/transformers");
type FeatureExtractionPipeline = Awaited<
  ReturnType<TransformersModule["pipeline"]>
>;
type TensorLike = {
  data: Float32Array | number[];
};
type FeatureExtractor = (
  input: string,
  options: { pooling: "mean" }
) => Promise<TensorLike>;

const DEFAULT_PROVIDER_MODEL = "BAAI/bge-small-zh-v1.5";
const DEFAULT_RUNTIME_MODEL = "Xenova/bge-small-zh-v1.5";

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getRuntimeModelId() {
  return process.env.LOCAL_EMBEDDING_RUNTIME_MODEL ?? DEFAULT_RUNTIME_MODEL;
}

function getProviderModelId() {
  return process.env.LOCAL_EMBEDDING_MODEL ?? DEFAULT_PROVIDER_MODEL;
}

async function getPipeline(modelId: string) {
  if (!pipelinePromise) {
    pipelinePromise = import("@xenova/transformers").then(
      async ({ env, pipeline }) => {
        env.allowLocalModels = false;
        env.cacheDir =
          process.env.TRANSFORMERS_CACHE ??
          process.env.RAILWAY_VOLUME_MOUNT_PATH ??
          ".cache/transformers";

        return pipeline("feature-extraction", modelId);
      }
    );
  }
  return pipelinePromise;
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map(value => value / magnitude);
}

async function embedText(text: string, modelId: string) {
  const extractor = (await getPipeline(modelId)) as unknown as FeatureExtractor;
  const output = await extractor(text, { pooling: "mean" });
  const data = Array.from(output.data);
  return normalizeVector(data);
}

function normalizeInput(input: unknown) {
  if (typeof input === "string") return [input];
  if (Array.isArray(input) && input.every(item => typeof item === "string")) {
    return input;
  }
  return null;
}

function isAuthorized(req: Request) {
  const apiKey = process.env.LOCAL_EMBEDDING_API_KEY;
  if (!apiKey) return true;

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(apiKey);
  const actual = Buffer.from(token);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function registerLocalEmbeddingRoutes(app: Express) {
  app.post("/v1/embeddings", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      res.status(401).json({
        error: {
          message: "Unauthorized",
          type: "authentication_error",
        },
      });
      return;
    }

    const input = normalizeInput(req.body?.input);
    if (!input) {
      res.status(400).json({
        error: {
          message: "input must be a string or an array of strings",
          type: "invalid_request_error",
        },
      });
      return;
    }

    try {
      const model = getRuntimeModelId();
      const providerModel = getProviderModelId();
      const embeddings = await Promise.all(input.map(text => embedText(text, model)));
      res.json({
        object: "list",
        model: providerModel,
        data: embeddings.map((embedding, index) => ({
          object: "embedding",
          embedding,
          index,
        })),
        usage: {
          prompt_tokens: 0,
          total_tokens: 0,
        },
      });
    } catch (error) {
      console.error("[LocalEmbedding] Failed to create embedding:", error);
      res.status(500).json({
        error: {
          message:
            error instanceof Error ? error.message : "Failed to create embedding",
          type: "server_error",
        },
      });
    }
  });
}
