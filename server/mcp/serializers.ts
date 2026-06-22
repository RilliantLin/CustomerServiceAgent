import type {
  AgentRun,
  AgentRunStep,
  KnowledgeBase,
  Ticket,
  TicketNote,
} from "../../drizzle/schema";

const DEFAULT_TEXT_LIMIT = 800;
const DESCRIPTION_LIMIT = 1_200;
const NOTE_LIMIT = 600;

const SENSITIVE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\b(api[_-]?key|secret|token)\s*[:=：]\s*[\w.-]{8,}/gi,
  /\b(password|passwd|pwd|密码)\s*[:=：]\s*\S{4,}/gi,
  /\b(?:\d[ -]*?){13,19}\b/g,
];

export function truncateText(value: string | null | undefined, limit = DEFAULT_TEXT_LIMIT) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

export function redactText(value: string | null | undefined, limit = DEFAULT_TEXT_LIMIT) {
  let text = truncateText(value, limit);
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }
  return text;
}

export function serializeKnowledgeEntry(entry: KnowledgeBase) {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    contentPreview: redactText(entry.content, DESCRIPTION_LIMIT),
    keywords: entry.keywords,
    documentId: entry.documentId,
    embeddingStatus: entry.embeddingStatus,
    updatedAt: entry.updatedAt,
  };
}

export function serializeTicketSummary(ticket: Ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    userId: ticket.userId,
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
  };
}

export function serializeTicketDetail(ticket: Ticket, notes: TicketNote[]) {
  return {
    ...serializeTicketSummary(ticket),
    descriptionPreview: redactText(ticket.description, DESCRIPTION_LIMIT),
    notes: notes.slice(0, 10).map(note => ({
      id: note.id,
      userId: note.userId,
      noteType: note.noteType,
      contentPreview: redactText(note.content, NOTE_LIMIT),
      createdAt: note.createdAt,
    })),
    notesTruncated: notes.length > 10,
  };
}

export function serializeAgentRun(run: AgentRun & { steps: AgentRunStep[] }) {
  return {
    id: run.id,
    userId: run.userId,
    ticketId: run.ticketId,
    status: run.status,
    inputPreview: redactText(run.input, DESCRIPTION_LIMIT),
    finalOutputPreview: redactText(run.finalOutput, DESCRIPTION_LIMIT),
    error: redactText(run.error, DESCRIPTION_LIMIT),
    llmProvider: run.llmProvider,
    llmModel: run.llmModel,
    retryOfRunId: run.retryOfRunId,
    metadata: run.metadata,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    steps: run.steps.slice(0, 50).map(step => ({
      id: step.id,
      stepType: step.stepType,
      toolName: step.toolName,
      argsSummary: redactText(step.argsSummary, NOTE_LIMIT),
      resultSummary: redactText(step.resultSummary, NOTE_LIMIT),
      contentPreview: redactText(step.content, NOTE_LIMIT),
      error: redactText(step.error, NOTE_LIMIT),
      createdAt: step.createdAt,
    })),
    stepsTruncated: run.steps.length > 50,
  };
}

export function asTextContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

