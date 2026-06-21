CREATE TYPE "public"."knowledge_document_status" AS ENUM('pending', 'parsing', 'indexing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" varchar(255) NOT NULL,
	"fileType" varchar(16) NOT NULL,
	"status" "knowledge_document_status" DEFAULT 'pending' NOT NULL,
	"totalChunks" integer DEFAULT 0 NOT NULL,
	"error" text,
	"uploadedBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP CONSTRAINT "knowledge_base_title_unique";--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "documentId" integer;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "embeddingStatus" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_knowledge_documents_status" ON "knowledge_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_documentId" ON "knowledge_base" USING btree ("documentId");