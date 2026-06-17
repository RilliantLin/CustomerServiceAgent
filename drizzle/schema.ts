import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tickets table - 工单表
 * 存储客户工单信息，包括状态、优先级、标题、描述等
 */
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // 创建工单的用户 ID
  title: varchar("title", { length: 255 }).notNull(), // 工单标题
  description: text("description").notNull(), // 工单描述
  status: mysqlEnum("status", ["pending", "in_progress", "resolved", "closed"]).default("pending").notNull(), // 工单状态
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(), // 优先级
  assignedTo: int("assignedTo"), // 分配给的管理员 ID（可选）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"), // 解决时间
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
export const ticketNotes = mysqlTable("ticket_notes", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  userId: int("userId").notNull(), // 添加备注的用户 ID
  content: text("content").notNull(), // 备注内容
  noteType: mysqlEnum("noteType", ["comment", "status_change", "assignment", "system"]).default("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("idx_ticketId").on(table.ticketId),
}));

export type TicketNote = typeof ticketNotes.$inferSelect;
export type InsertTicketNote = typeof ticketNotes.$inferInsert;

/**
 * Knowledge base table - 知识库表
 * 存储客服知识库条目，用于 RAG 检索
 */
export const knowledgeBase = mysqlTable("knowledge_base", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(), // 知识库条目标题
  content: text("content").notNull(), // 知识库条目内容
  category: varchar("category", { length: 100 }).notNull(), // 分类（FAQ、产品说明、政策等）
  keywords: text("keywords"), // 关键词（逗号分隔）
  embedding: json("embedding"), // 向量嵌入（用于相似度检索）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("idx_category").on(table.category),
}));

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;

/**
 * Chat messages table - 聊天记录表
 * 存储用户与智能客服的对话记录
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId"), // 关联的工单 ID（可选）
  userId: int("userId").notNull(), // 用户 ID
  role: mysqlEnum("role", ["user", "assistant"]).notNull(), // 消息角色
  content: text("content").notNull(), // 消息内容
  relatedKnowledgeIds: json("relatedKnowledgeIds"), // 关联的知识库 ID 列表
  relatedKnowledgeSnapshot: json("relatedKnowledgeSnapshot"), // 保存回答时引用的知识库标题/分类快照
  llmProvider: varchar("llmProvider", { length: 32 }), // 生成该回复的 LLM provider
  llmModel: varchar("llmModel", { length: 128 }), // 生成该回复的模型
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_userId_chat").on(table.userId),
  ticketIdIdx: index("idx_ticketId_chat").on(table.ticketId),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
