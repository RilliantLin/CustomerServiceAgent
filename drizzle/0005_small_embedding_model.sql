DROP INDEX IF EXISTS "idx_knowledge_base_embedding_hnsw";--> statement-breakpoint
UPDATE "knowledge_base"
SET "embedding" = NULL,
    "embeddingStatus" = 'pending';--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "embedding" TYPE vector(512);--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_embedding_hnsw" ON "knowledge_base" USING hnsw ("embedding" vector_cosine_ops) WHERE "knowledge_base"."embedding" IS NOT NULL;--> statement-breakpoint
