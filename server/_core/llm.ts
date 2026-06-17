import { ENV } from "./env";
import {
  buildOpenAiHttpError,
  fetchWithBackoff,
  resolveOpenAiApiUrl,
} from "./openai";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type StreamChunk = {
  type: "content" | "done";
  content?: string;
  model?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveManusApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertManusApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
};

const assertOpenAiApiKey = () => {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const toOpenAiResponsesTextFormat = (
  format: ReturnType<typeof normalizeResponseFormat>
) => {
  if (!format) return undefined;
  if (format.type !== "json_schema") return format;

  return {
    type: "json_schema",
    name: format.json_schema.name,
    schema: format.json_schema.schema,
    ...(typeof format.json_schema.strict === "boolean"
      ? { strict: format.json_schema.strict }
      : {}),
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = ENV.llmProvider.trim().toLowerCase();

  if (provider === "openai") {
    return invokeOpenAiResponses(params);
  }

  if (provider === "manus" || provider === "forge") {
    return invokeManusLLM(params);
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${ENV.llmProvider}". Use "openai" or "manus".`
  );
}

export async function* streamLLM(
  params: InvokeParams,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const provider = ENV.llmProvider.trim().toLowerCase();

  if (provider === "openai") {
    yield* streamOpenAiChatCompletions(params, signal);
    return;
  }

  if (provider === "manus" || provider === "forge") {
    yield* streamManusLLM(params, signal);
    return;
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${ENV.llmProvider}". Use "openai" or "manus".`
  );
}

const createChatCompletionPayload = (params: InvokeParams) => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (model) {
    payload.model = model;
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
};

async function* parseSseResponse(
  response: Response
): AsyncGenerator<StreamChunk> {
  if (!response.body) {
    throw new Error("LLM stream response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const data = event
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trimStart())
        .join("\n");

      if (!data) continue;
      if (data === "[DONE]") {
        yield { type: "done" };
        continue;
      }

      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      const content = delta?.content ?? delta?.text ?? parsed.delta ?? "";
      if (typeof content === "string" && content.length > 0) {
        yield {
          type: "content",
          content,
          model: typeof parsed.model === "string" ? parsed.model : undefined,
        };
      }
    }
  }
}

async function* streamManusLLM(
  params: InvokeParams,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  assertManusApiKey();

  const payload: Record<string, unknown> = {
    ...createChatCompletionPayload(params),
    stream: true,
  };

  const response = await fetchWithBackoff(resolveManusApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM stream failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  yield* parseSseResponse(response);
}

async function* streamOpenAiChatCompletions(
  params: InvokeParams,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  assertOpenAiApiKey();

  const payload: Record<string, unknown> = {
    ...createChatCompletionPayload({
      ...params,
      model: params.model || ENV.openAiModel,
    }),
    stream: true,
  };
  const url = resolveOpenAiApiUrl("/v1/chat/completions");
  const response = await fetchWithBackoff(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw await buildOpenAiHttpError({
      label: "OpenAI stream",
      response,
      url,
      model: String(payload.model ?? ENV.openAiModel),
    });
  }

  yield* parseSseResponse(response);
}

async function invokeManusLLM(params: InvokeParams): Promise<InvokeResult> {
  assertManusApiKey();
  const payload = createChatCompletionPayload(params);

  const response = await fetchWithBackoff(resolveManusApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

const textFromMessageContent = (content: Message["content"]): string => {
  return ensureArray(content)
    .map(part => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      if (part.type === "image_url") return `[image: ${part.image_url.url}]`;
      if (part.type === "file_url") return `[file: ${part.file_url.url}]`;
      return JSON.stringify(part);
    })
    .join("\n");
};

const extractOutputText = (response: any): string => {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  if (!Array.isArray(response.output)) return "";

  const parts: string[] = [];
  for (const item of response.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
};

async function invokeOpenAiResponses(params: InvokeParams): Promise<InvokeResult> {
  assertOpenAiApiKey();

  const {
    messages,
    model,
    maxTokens,
    max_tokens,
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
    reasoning,
  } = params;

  const systemMessages = messages
    .filter(message => message.role === "system")
    .map(message => textFromMessageContent(message.content))
    .filter(Boolean);

  const input = messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: textFromMessageContent(message.content),
    }));

  const payload: Record<string, unknown> = {
    model: model || ENV.openAiModel,
    input,
  };

  if (systemMessages.length > 0) {
    payload.instructions = systemMessages.join("\n\n");
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_output_tokens = resolvedMaxTokens;
  }

  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) {
    payload.text = {
      format: toOpenAiResponsesTextFormat(normalizedResponseFormat),
    };
  }

  const url = resolveOpenAiApiUrl("/v1/responses");
  const response = await fetchWithBackoff(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildOpenAiHttpError({
      label: "OpenAI response",
      response,
      url,
      model: String(payload.model),
    });
  }

  const data = await response.json() as any;
  const content = extractOutputText(data) || "抱歉，我无法处理您的请求。";
  const created = typeof data.created_at === "number"
    ? Math.floor(data.created_at)
    : Math.floor(Date.now() / 1000);

  return {
    id: data.id ?? "",
    created,
    model: data.model ?? payload.model as string,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: data.status === "completed" ? "stop" : data.status ?? null,
      },
    ],
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens ?? 0,
          completion_tokens: data.usage.output_tokens ?? 0,
          total_tokens: data.usage.total_tokens
            ?? ((data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)),
        }
      : undefined,
  };
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  const provider = ENV.llmProvider.trim().toLowerCase();

  if (provider === "openai") {
    assertOpenAiApiKey();
    const url = resolveOpenAiApiUrl("/v1/models");
    const response = await fetchWithBackoff(url, {
      headers: { authorization: `Bearer ${ENV.openAiApiKey}` },
    });

    if (!response.ok) {
      throw await buildOpenAiHttpError({
        label: "List OpenAI models",
        response,
        url,
      });
    }

    return (await response.json()) as ModelsResponse;
  }

  assertManusApiKey();

  const url = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/models`
    : "https://forge.manus.im/v1/models";

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${ENV.forgeApiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}
