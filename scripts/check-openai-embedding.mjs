import "dotenv/config";
import { createEmbedding } from "../server/_core/embeddings.ts";
import { ENV } from "../server/_core/env.ts";
import { resolveOpenAiApiUrl } from "../server/_core/openai.ts";

async function main() {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required to check embeddings");
  }
  if (!ENV.ragEmbeddingsEnabled) {
    console.log(
      "RAG_EMBEDDINGS_ENABLED=false; temporarily skipping embedding calls."
    );
    return;
  }

  const url = resolveOpenAiApiUrl(ENV.openAiEmbeddingPath, {
    baseUrl: ENV.openAiEmbeddingBaseUrl,
  });
  const startedAt = Date.now();

  console.log(`Embedding endpoint: ${url}`);
  console.log(`Embedding model: ${ENV.openAiEmbeddingModel}`);

  const embedding = await createEmbedding(
    "客服知识库 embedding connectivity check"
  );

  console.log(`Embedding dimension: ${embedding.length}`);
  console.log(`Completed in ${Date.now() - startedAt}ms`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
