import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const ticketNoteTypeEnum = pgEnum("ticket_note_type", [
  "comment",
  "status_change",
  "assignment",
  "system",
]);
export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tickets table - 工单表
 * 存储客户工单信息，包括状态、优先级、标题、描述等
 */
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // 创建工单的用户 ID
  title: varchar("title", { length: 255 }).notNull(), // 工单标题
  description: text("description").notNull(), // 工单描述
  status: ticketStatusEnum("status").default("pending").notNull(), // 工单状态
  priority: ticketPriorityEnum("priority").default("medium").notNull(), // 优先级
  assignedTo: integer("assignedTo"), // 分配给的管理员 ID（可选）
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }), // 解决时间
}, (table) => ({
  userIdIdx: index("idx_userId").on(table.userId),
  statusIdx: index("idx_status").on(table.status),
  priorityIdx: index("idx_priority").on(table.priority),
}));

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

/**
 * Ticket notes table - 工单备注表
 * 存储工单的历史备注和更新记录
 */
export const ticketNotes = pgTable("ticket_notes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  userId: integer("userId").notNull(), // 添加备注的用户 ID
  content: text("content").notNull(), // 备注内容
  noteType: ticketNoteTypeEnum("noteType").default("comment").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("idx_ticketId").on(table.ticketId),
}));

export type TicketNote = typeof ticketNotes.$inferSelect;
export type InsertTicketNote = typeof ticketNotes.$inferInsert;

/**
 * Knowledge base table - 知识库表
 * 存储客服知识库条目，用于 RAG 检索
 */
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull().unique(), // 知识库条目标题
  content: text("content").notNull(), // 知识库条目内容
  category: varchar("category", { length: 100 }).notNull(), // 分类（FAQ、产品说明、政策等）
  keywords: text("keywords"), // 关键词（逗号分隔）
  embedding: vector("embedding", { dimensions: 1024 }), // BAAI/bge-m3 向量嵌入
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("idx_category").on(table.category),
  embeddingIdx: index("idx_knowledge_base_embedding_hnsw")
    .using("hnsw", table.embedding.op("vector_cosine_ops"))
    .where(sql`${table.embedding} IS NOT NULL`),
}));

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;

/**
 * Chat messages table - 聊天记录表
 * 存储用户与智能客服的对话记录
 */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId"), // 关联的工单 ID（可选）
  userId: integer("userId").notNull(), // 用户 ID
  role: chatMessageRoleEnum("role").notNull(), // 消息角色
  content: text("content").notNull(), // 消息内容
  relatedKnowledgeIds: jsonb("relatedKnowledgeIds").$type<number[]>(), // 关联的知识库 ID 列表
  relatedKnowledgeSnapshot: jsonb("relatedKnowledgeSnapshot").$type<Array<{
    id: number;
    title: string;
    category: string;
  }>>(), // 保存回答时引用的知识库标题/分类快照
  llmProvider: varchar("llmProvider", { length: 32 }), // 生成该回复的 LLM provider
  llmModel: varchar("llmModel", { length: 128 }), // 生成该回复的模型
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_userId_chat").on(table.userId),
  ticketIdIdx: index("idx_ticketId_chat").on(table.ticketId),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
