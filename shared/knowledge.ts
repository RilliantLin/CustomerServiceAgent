export const KNOWLEDGE_DOCUMENT_STATUSES = [
  "pending",
  "parsing",
  "indexing",
  "completed",
  "failed",
] as const;

export type KnowledgeDocumentStatus =
  (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];
