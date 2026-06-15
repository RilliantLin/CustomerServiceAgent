import "dotenv/config";
import {
  buildKnowledgeEmbeddingInput,
  createEmbedding,
  parseEmbedding,
} from "../server/_core/embeddings.ts";
import {
  listKnowledgeEntries,
  updateKnowledgeEmbedding,
} from "../server/db.ts";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate knowledge embeddings");
  }
  if (process.env.RAG_EMBEDDINGS_ENABLED === "false") {
    throw new Error(
      "RAG_EMBEDDINGS_ENABLED=false, skip embedding backfill until the embedding endpoint is available"
    );
  }

  const entries = await listKnowledgeEntries();
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (parseEmbedding(entry.embedding)) {
      skipped += 1;
      continue;
    }

    const input = buildKnowledgeEmbeddingInput(entry);
    const embedding = await createEmbedding(input);
    await updateKnowledgeEmbedding(entry.id, embedding);
    updated += 1;
    console.log(`Embedded #${entry.id}: ${entry.title}`);
  }

  console.log(`Embedding complete. Updated: ${updated}, skipped: ${skipped}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
