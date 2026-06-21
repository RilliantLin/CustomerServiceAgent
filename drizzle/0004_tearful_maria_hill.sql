CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'planning', 'running', 'waiting_approval', 'failed', 'completed');--> statement-breakpoint
CREATE TYPE "public"."agent_run_step_type" AS ENUM('thinking', 'tool_call', 'tool_result', 'final', 'error');--> statement-breakpoint
CREATE TABLE "agent_run_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"runId" integer NOT NULL,
	"stepType" "agent_run_step_type" NOT NULL,
	"toolName" varchar(128),
	"argsSummary" text,
	"resultSummary" text,
	"content" text,
	"error" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"ticketId" integer,
	"status" "agent_run_status" DEFAULT 'queued' NOT NULL,
	"input" text NOT NULL,
	"finalOutput" text,
	"error" text,
	"llmProvider" varchar(32),
	"llmModel" varchar(128),
	"retryOfRunId" integer,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_agent_run_steps_runId" ON "agent_run_steps" USING btree ("runId");--> statement-breakpoint
CREATE INDEX "idx_agent_run_steps_stepType" ON "agent_run_steps" USING btree ("stepType");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_userId" ON "agent_runs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_ticketId" ON "agent_runs" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_status" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_retryOfRunId" ON "agent_runs" USING btree ("retryOfRunId");