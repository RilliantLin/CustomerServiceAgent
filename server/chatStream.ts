import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { streamLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { streamAgentChatResponse, type AgentEvent } from "./agentService";
import {
  LLM_TIMEOUT_MS,
  prepareChatResponse,
} from "./chatService";

type SsePayload =
  | {
      type: "meta";
      relatedKnowledge: Array<{ id: number; title: string; category: string }>;
      llmProvider: string;
    }
  | { type: "delta"; content: string }
  | {
      type: "agent_event";
      event: AgentEvent;
    }
  | { type: "done"; llmProvider: string; llmModel?: string }
  | { type: "error"; message: string };

const writeSse = (res: Response, payload: SsePayload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const sendSseError = (res: Response, error: unknown) => {
  const message =
    error instanceof Error ? error.message : "发送消息失败，请稍后重试";
  writeSse(res, { type: "error", message });
};

export function registerChatStreamRoutes(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders?.();

    const abortController = new AbortController();
    let clientClosed = false;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, LLM_TIMEOUT_MS);
    res.on("close", () => {
      if (!res.writableEnded) {
        clientClosed = true;
        abortController.abort();
      }
    });

    try {
      const user = await sdk.authenticateRequest(req);
      const content = typeof req.body?.content === "string"
        ? req.body.content.trim()
        : "";
      const ticketId = typeof req.body?.ticketId === "number"
        ? req.body.ticketId
        : undefined;

      if (!content) {
        res.statusCode = 400;
        writeSse(res, { type: "error", message: "消息内容不能为空" });
        return;
      }

      if (ENV.chatMode === "agent") {
        const result = await streamAgentChatResponse(
          {
            userId: user.id,
            userRole: user.role,
            ticketId,
            content,
          },
          abortController.signal,
          event => {
            writeSse(res, { type: "agent_event", event });
            if (event.type === "final") {
              writeSse(res, { type: "delta", content: event.content });
            }
          }
        );

        writeSse(res, {
          type: "meta",
          relatedKnowledge: result.relatedKnowledgeSnapshot,
          llmProvider: "openai-agents",
        });
        writeSse(res, {
          type: "done",
          llmProvider: "openai-agents",
          llmModel: ENV.openAiModel,
        });
        return;
      }

      const { messages, relatedKnowledge, relatedKnowledgeSnapshot } =
        await prepareChatResponse({
          userId: user.id,
          ticketId,
          content,
        });

      writeSse(res, {
        type: "meta",
        relatedKnowledge: relatedKnowledgeSnapshot,
        llmProvider: ENV.llmProvider,
      });

      let assistantContent = "";
      let llmModel: string | undefined;

      for await (const chunk of streamLLM({ messages }, abortController.signal)) {
        if (chunk.type === "content" && chunk.content) {
          assistantContent += chunk.content;
          if (chunk.model) llmModel = chunk.model;
          writeSse(res, { type: "delta", content: chunk.content });
        }
      }

      if (!assistantContent) {
        assistantContent = "抱歉，我无法处理您的请求。";
        writeSse(res, { type: "delta", content: assistantContent });
      }

      await db.saveChatMessage({
        ticketId,
        userId: user.id,
        role: "assistant",
        content: assistantContent,
        relatedKnowledgeIds: relatedKnowledge.map(kb => kb.id),
        relatedKnowledgeSnapshot,
        llmProvider: ENV.llmProvider,
        llmModel,
      });

      writeSse(res, {
        type: "done",
        llmProvider: ENV.llmProvider,
        llmModel,
      });
    } catch (error) {
      if (!clientClosed) {
        sendSseError(
          res,
          timedOut ? new Error("LLM call timed out，请稍后重试") : error
        );
      }
    } finally {
      clearTimeout(timeoutId);
      res.end();
    }
  });
}
