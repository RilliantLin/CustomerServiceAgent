import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { ENV } from "./_core/env";
import { invokeLLM, Message } from "./_core/llm";

const CHAT_HISTORY_LIMIT = 10;
const CHAT_HISTORY_CHAR_LIMIT = 4_000;
const KNOWLEDGE_CONTEXT_CHAR_LIMIT = 6_000;
const LLM_TIMEOUT_MS = 45_000;

const parseJsonValue = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

export function buildKnowledgeContext(
  relatedKnowledge: Array<{
    title: string;
    content: string;
    category: string;
  }>
) {
  const context = relatedKnowledge
    .map(kb => `[${kb.category}] ${kb.title}: ${kb.content}`)
    .join("\n\n");

  return truncateText(context, KNOWLEDGE_CONTEXT_CHAR_LIMIT);
}

export function buildChatHistoryMessages(
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>
): Message[] {
  let remaining = CHAT_HISTORY_CHAR_LIMIT;
  const selected: Message[] = [];

  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];
    if (!message?.content) continue;

    const content = truncateText(message.content, Math.min(remaining, 1_000));
    if (content.length === 0 || remaining <= 0) break;

    selected.unshift({
      role: message.role,
      content,
    });
    remaining -= content.length;
  }

  return selected;
}

export function buildCustomerServiceSystemPrompt(knowledgeContext: string) {
  return `你是一个专业的客服助手。请严格根据提供的知识库信息回答用户问题。

知识库信息：
${knowledgeContext || "暂无相关知识库信息"}

规则：
1. 只使用知识库中明确提供的信息，不要编造政策、承诺、联系方式或时间。
2. 如果知识库没有相关信息，或历史上下文仍不足以确认，请礼貌说明暂时无法确认，并建议用户创建工单由人工客服处理。
3. 回答应简洁、专业，优先给出可执行步骤。
4. 如果用到了知识库内容，在回答末尾用“参考：知识库标题”列出来源标题。`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ Tickets Router ============
  tickets: router({
    // 创建工单
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createTicket({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
        });
        return result;
      }),

    // 获取工单详情
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getTicketById(input.id);
      }),

    // 列表工单（支持筛选和搜索）
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input, ctx }) => {
        // 普通用户只能看自己的工单，管理员可以看所有工单
        const filters: any = {
          ...input,
        };
        if (ctx.user.role !== "admin") {
          filters.userId = ctx.user.id;
        }
        return await db.listTickets(filters);
      }),

    // 更新工单
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedTo: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查权限：只有管理员或工单创建者可以更新
        const ticket = await db.getTicketById(input.id);
        if (!ticket) throw new Error("Ticket not found");
        if (ctx.user.role !== "admin" && ticket.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const updateData: any = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.status !== undefined) {
          updateData.status = input.status;
          if (input.status === "resolved") {
            updateData.resolvedAt = new Date();
          }
        }
        if (input.priority !== undefined) updateData.priority = input.priority;
        if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;

        await db.updateTicket(input.id, updateData);

        // 记录状态变更
        if (input.status !== undefined && input.status !== ticket.status) {
          await db.addTicketNote({
            ticketId: input.id,
            userId: ctx.user.id,
            content: `Status changed from ${ticket.status} to ${input.status}`,
            noteType: "status_change",
          });
        }

        return { success: true };
      }),

    // 获取工单备注历史
    getNotes: protectedProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTicketNotes(input.ticketId);
      }),

    // 添加工单备注
    addNote: protectedProcedure
      .input(z.object({
        ticketId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addTicketNote({
          ticketId: input.ticketId,
          userId: ctx.user.id,
          content: input.content,
          noteType: "comment",
        });
        return { success: true };
      }),

    // 获取工单统计（仅管理员）
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await db.getTicketStats();
      }),
  }),

  // ============ Knowledge Base Router ============
  knowledge: router({
    // 获取知识库列表（仅管理员）
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await db.listKnowledgeEntries();
      }),

    // 搜索知识库
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        return await db.searchKnowledge(input.query, input.limit);
      }),

    // 按分类获取知识库
    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getKnowledgeByCategory(input.category);
      }),

    // 添加知识库条目（仅管理员）
    add: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        category: z.string().min(1),
        keywords: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await db.addKnowledgeEntry(input);
      }),
  }),

  // ============ Chat Router ============
  chat: router({
    // 获取聊天历史
    getHistory: protectedProcedure
      .input(z.object({
        ticketId: z.number().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input, ctx }) => {
        const history = await db.getChatHistory(ctx.user.id, input.ticketId, input.limit);
        const ids = history.flatMap(message =>
          parseJsonValue<number[]>(message.relatedKnowledgeIds, [])
        );
        const knowledgeById = new Map(
          (await db.getKnowledgeByIds(ids)).map(entry => [entry.id, entry])
        );

        return history.map(message => {
          const snapshot = parseJsonValue<Array<{
            id: number;
            title: string;
            category: string;
          }>>(message.relatedKnowledgeSnapshot, []);
          const relatedKnowledgeIds = parseJsonValue<number[]>(
            message.relatedKnowledgeIds,
            []
          );
          const relatedKnowledge = snapshot.length > 0
            ? snapshot
            : relatedKnowledgeIds
                .map(id => knowledgeById.get(id))
                .filter(Boolean)
                .map(kb => ({
                  id: kb!.id,
                  title: kb!.title,
                  category: kb!.category,
                }));

          return {
            ...message,
            relatedKnowledgeIds,
            relatedKnowledge,
          };
        });
      }),

    // 发送消息并获取 AI 回复（基于 RAG）
    sendMessage: protectedProcedure
      .input(z.object({
        ticketId: z.number().optional(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const history = await db.getRecentChatHistory(
          ctx.user.id,
          input.ticketId,
          CHAT_HISTORY_LIMIT
        );

        // 保存用户消息
        await db.saveChatMessage({
          ticketId: input.ticketId,
          userId: ctx.user.id,
          role: "user",
          content: input.content,
        });

        // 从知识库检索相关内容
        const relatedKnowledge = await db.searchKnowledge(input.content, 3);
        const knowledgeContext = buildKnowledgeContext(relatedKnowledge);

        // 调用 LLM 生成回复
        const systemPrompt = buildCustomerServiceSystemPrompt(knowledgeContext);
        const response = await withTimeout(
          invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              ...buildChatHistoryMessages(history),
              { role: "user", content: input.content },
            ],
          }),
          LLM_TIMEOUT_MS,
          "LLM call"
        );

        const assistantContent = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : "抱歉，我无法处理您的请求。";
        const relatedKnowledgeSnapshot = relatedKnowledge.map(kb => ({
          id: kb.id,
          title: kb.title,
          category: kb.category,
        }));

        // 保存 AI 回复
        await db.saveChatMessage({
          ticketId: input.ticketId,
          userId: ctx.user.id,
          role: "assistant",
          content: assistantContent,
          relatedKnowledgeIds: relatedKnowledge.map(kb => kb.id),
          relatedKnowledgeSnapshot,
          llmProvider: ENV.llmProvider,
          llmModel: response.model,
        });

        return {
          userMessage: input.content,
          assistantMessage: assistantContent as string,
          relatedKnowledge: relatedKnowledgeSnapshot,
          llmProvider: ENV.llmProvider,
          llmModel: response.model,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
