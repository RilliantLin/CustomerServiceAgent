CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ticket_note_type" AS ENUM('comment', 'status_change', 'assignment', 'system');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('pending', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer,
	"userId" integer NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"content" text NOT NULL,
	"relatedKnowledgeIds" jsonb,
	"relatedKnowledgeSnapshot" jsonb,
	"llmProvider" varchar(32),
	"llmModel" varchar(128),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"keywords" text,
	"embedding" vector(1024),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_base_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "ticket_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"noteType" "ticket_note_type" DEFAULT 'comment' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'pending' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"assignedTo" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "idx_userId_chat" ON "chat_messages" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_ticketId_chat" ON "chat_messages" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "idx_category" ON "knowledge_base" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_embedding_hnsw" ON "knowledge_base" USING hnsw ("embedding" vector_cosine_ops) WHERE "knowledge_base"."embedding" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_ticketId" ON "ticket_notes" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "idx_userId" ON "tickets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_status" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_priority" ON "tickets" USING btree ("priority");
