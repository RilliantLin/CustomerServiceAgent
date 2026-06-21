import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { createChatResponse, parseJsonValue } from "./chatService";
import { createAgentChatResponse } from "./agentService";
import { ingestDocument } from "./knowledge/ingest";
import { ENV } from "./_core/env";

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

    // 搜索知识库（仅管理员）
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().optional().default(5),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await db.searchKnowledgeByKeyword(input.query, input.limit);
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

    // 上传文档（Markdown/CSV），解析为知识条目并后台向量化（仅管理员）
    uploadDocument: protectedProcedure
      .input(z.object({
        filename: z.string().min(1).max(255),
        fileType: z.enum(["markdown", "csv"]),
        content: z.string().min(1),
        category: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await ingestDocument({
          filename: input.filename,
          fileType: input.fileType,
          content: input.content,
          category: input.category,
          userId: ctx.user.id,
        });
      }),

    // 文档列表（含解析状态与索引进度，仅管理员）
    listDocuments: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return await db.listKnowledgeDocuments();
      }),

    // 删除文档及其生成的全部知识条目（仅管理员）
    deleteDocument: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        await db.deleteKnowledgeDocument(input.id);
        return { success: true };
      }),

    // 删除单条知识条目（仅管理员）
    deleteEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        await db.deleteKnowledgeEntry(input.id);
        return { success: true };
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
        if (ENV.chatMode === "agent") {
          return createAgentChatResponse({
            userId: ctx.user.id,
            userRole: ctx.user.role,
            ticketId: input.ticketId,
            content: input.content,
          });
        }

        return createChatResponse({
          userId: ctx.user.id,
          ticketId: input.ticketId,
          content: input.content,
        });
      }),
  }),

  // ============ Agent Runs Router ============
  agentRuns: router({
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const run = await db.getAgentRunWithSteps(input.id);
        if (!run) {
          throw new Error("Agent run not found");
        }
        if (ctx.user.role !== "admin" && run.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return run;
      }),

    summarizeRecentTickets: protectedProcedure
      .input(z.object({
        search: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(10).default(5),
      }).optional())
      .mutation(async ({ input, ctx }) => {
        const query = input?.search
          ? `请查询并总结最近与“${input.search}”相关的工单，给出状态、风险等级和建议下一步动作。`
          : `请查询并总结我最近 ${input?.limit ?? 5} 个工单，给出状态、风险等级和建议下一步动作。`;

        return createAgentChatResponse({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          content: query,
        });
      }),

    retry: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const existingRun = await db.getAgentRunById(input.id);
        if (!existingRun) {
          throw new Error("Agent run not found");
        }
        if (ctx.user.role !== "admin" && existingRun.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        return createAgentChatResponse({
          userId: existingRun.userId,
          userRole: existingRun.userId === ctx.user.id ? ctx.user.role : "user",
          ticketId: existingRun.ticketId ?? undefined,
          content: existingRun.input,
          retryOfRunId: existingRun.id,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
