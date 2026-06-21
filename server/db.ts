import { eq, and, desc, like, inArray, isNotNull } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, tickets, knowledgeBase, chatMessages, ticketNotes } from "../drizzle/schema";
import { ENV } from './_core/env';
import {
  createEmbedding,
  isEmbeddingEnabled,
} from "./_core/embeddings";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { max: 10 });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    updateSet.updatedAt = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Tickets ============

export async function createTicket(data: {
  userId: number;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "urgent";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tickets).values({
    userId: data.userId,
    title: data.title,
    description: data.description,
    priority: data.priority || "medium",
  });

  return result;
}

export async function getTicketById(ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listTickets(filters?: {
  userId?: number;
  status?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filters?.userId) {
    conditions.push(eq(tickets.userId, filters.userId));
  }
  if (filters?.status) {
    conditions.push(eq(tickets.status, filters.status as any));
  }
  if (filters?.priority) {
    conditions.push(eq(tickets.priority, filters.priority as any));
  }
  if (filters?.search) {
    conditions.push(like(tickets.title, `%${filters.search}%`));
  }

  let query: any = db.select().from(tickets);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(tickets.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return await query;
}

export async function updateTicket(ticketId: number, data: Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: number | null;
  resolvedAt: Date | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.resolvedAt !== undefined) updateData.resolvedAt = data.resolvedAt;
  updateData.updatedAt = new Date();

  return db.update(tickets).set(updateData).where(eq(tickets.id, ticketId));
}

// ============ Knowledge Base ============

export async function addKnowledgeEntry(data: {
  title: string;
  content: string;
  category: string;
  keywords?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(knowledgeBase).values({
    title: data.title,
    content: data.content,
    category: data.category,
    keywords: data.keywords,
  });
}

export async function getKnowledgeByCategory(category: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(knowledgeBase).where(eq(knowledgeBase.category, category));
}

export async function listKnowledgeEntries() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(knowledgeBase);
}

export async function getKnowledgeByIds(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const uniqueIds = Array.from(new Set(ids)).filter(Number.isFinite);
  if (uniqueIds.length === 0) return [];

  return db.select().from(knowledgeBase).where(inArray(knowledgeBase.id, uniqueIds));
}

export async function updateKnowledgeEmbedding(id: number, embedding: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(knowledgeBase)
    .set({ embedding, updatedAt: new Date() })
    .where(eq(knowledgeBase.id, id));
}

async function fallbackSearchKnowledge(query: string, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const entries = await db.select().from(knowledgeBase);
  const ranked = rankKnowledgeEntriesByKeyword(query, entries, limit);
  if (ranked.length > 0) return ranked;

  return db.select().from(knowledgeBase)
    .where(like(knowledgeBase.title, `%${query}%`))
    .limit(limit);
}

export async function searchKnowledgeByKeyword(query: string, limit = 5) {
  return fallbackSearchKnowledge(query, limit);
}

type KeywordSearchEntry = {
  title: string;
  content: string;
  category: string;
  keywords?: string | null;
};

const normalizeSearchText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "");

const getSearchTerms = (query: string, entries: KeywordSearchEntry[]) => {
  const normalizedQuery = normalizeSearchText(query);
  const terms = new Set<string>();

  for (const part of query.toLowerCase().split(/[,\s，。！？!?、;；:：/\\|]+/)) {
    const term = part.trim();
    if (term.length >= 2) terms.add(term);
  }

  for (const entry of entries) {
    const candidates = [
      entry.title,
      entry.category,
      ...(entry.keywords ?? "").split(/[,\s，、]+/),
    ];

    for (const candidate of candidates) {
      const term = normalizeSearchText(candidate);
      if (term.length >= 2 && normalizedQuery.includes(term)) {
        terms.add(term);
      }
    }
  }

  return Array.from(terms);
};

export function rankKnowledgeEntriesByKeyword<T extends KeywordSearchEntry>(
  query: string,
  entries: T[],
  limit = 5
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const terms = getSearchTerms(query, entries);

  return entries
    .map(entry => {
      const title = normalizeSearchText(entry.title);
      const category = normalizeSearchText(entry.category);
      const keywords = normalizeSearchText(entry.keywords ?? "");
      const content = normalizeSearchText(entry.content);

      let score = 0;
      if (title.includes(normalizedQuery)) score += 10;
      if (keywords.includes(normalizedQuery)) score += 8;
      if (content.includes(normalizedQuery)) score += 4;

      for (const term of terms) {
        if (title.includes(term)) score += 6;
        if (keywords.includes(term)) score += 5;
        if (category.includes(term)) score += 3;
        if (content.includes(term)) score += 1;
      }

      return { entry, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.entry);
}

export async function searchKnowledge(query: string, limit = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!isEmbeddingEnabled()) {
    return fallbackSearchKnowledge(query, limit);
  }

  try {
    const queryEmbedding = await createEmbedding(query, "query");
    const distance = cosineDistance(knowledgeBase.embedding, queryEmbedding);
    const scored = await db
      .select()
      .from(knowledgeBase)
      .where(isNotNull(knowledgeBase.embedding))
      .orderBy(distance, desc(knowledgeBase.updatedAt))
      .limit(limit);

    return scored.length > 0 ? scored : fallbackSearchKnowledge(query, limit);
  } catch (error) {
    console.warn("[RAG] Vector search failed, falling back to keyword search:", error);
    return fallbackSearchKnowledge(query, limit);
  }
}

// ============ Chat Messages ============

export async function saveChatMessage(data: {
  ticketId?: number;
  userId: number;
  role: "user" | "assistant";
  content: string;
  relatedKnowledgeIds?: number[];
  relatedKnowledgeSnapshot?: Array<{
    id: number;
    title: string;
    category: string;
  }>;
  llmProvider?: string;
  llmModel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(chatMessages).values({
    ticketId: data.ticketId,
    userId: data.userId,
    role: data.role,
    content: data.content,
    relatedKnowledgeIds: data.relatedKnowledgeIds ?? null,
    relatedKnowledgeSnapshot: data.relatedKnowledgeSnapshot ?? null,
    llmProvider: data.llmProvider,
    llmModel: data.llmModel,
  });
}

export async function getChatHistory(userId: number, ticketId?: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(chatMessages.userId, userId)];
  if (ticketId) {
    conditions.push(eq(chatMessages.ticketId, ticketId));
  }

  const rows = await db.select().from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function getRecentChatHistory(userId: number, ticketId?: number, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(chatMessages.userId, userId)];
  if (ticketId) {
    conditions.push(eq(chatMessages.ticketId, ticketId));
  }

  const rows = await db.select().from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.reverse();
}

// ============ Ticket Notes ============

export async function addTicketNote(data: {
  ticketId: number;
  userId: number;
  content: string;
  noteType?: "comment" | "status_change" | "assignment" | "system";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(ticketNotes).values({
    ticketId: data.ticketId,
    userId: data.userId,
    content: data.content,
    noteType: data.noteType || "comment",
  });
}

export async function getTicketNotes(ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(ticketNotes).where(eq(ticketNotes.ticketId, ticketId)).orderBy(desc(ticketNotes.createdAt));
}

// ============ Statistics ============

export async function getTicketStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const total = await db.select().from(tickets);
  const pending = await db.select().from(tickets).where(eq(tickets.status, "pending"));
  const inProgress = await db.select().from(tickets).where(eq(tickets.status, "in_progress"));
  const resolved = await db.select().from(tickets).where(eq(tickets.status, "resolved"));
  const closed = await db.select().from(tickets).where(eq(tickets.status, "closed"));

  return {
    total: total.length,
    pending: pending.length,
    inProgress: inProgress.length,
    resolved: resolved.length,
    closed: closed.length,
  };
}
