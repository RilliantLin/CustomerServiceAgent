const MAX_LOG_FIELD_LENGTH = 600;

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/g, "Bearer [redacted]"],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "sk-[redacted]"],
  [/\bpa-[A-Za-z0-9_-]{12,}\b/g, "pa-[redacted]"],
  [
    /\b(api[_-]?key|secret|token|password|passwd|pwd|密码)\s*[:=：]\s*["']?[^"',\s}]+/gi,
    "$1=[redacted]",
  ],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card]"],
];

export function redactSensitiveText(value: string) {
  return SENSITIVE_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

const isSensitiveLogKey = (key: string) => {
  const normalized = key.toLowerCase();
  return (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "token" ||
    normalized.endsWith("token") ||
    normalized.includes("api_key") ||
    normalized.includes("apikey") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("passwd") ||
    normalized.includes("pwd") ||
    normalized.includes("密码")
  );
};

export function sanitizeLogValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const redacted = redactSensitiveText(value).replace(/\s+/g, " ").trim();
    return redacted.length > MAX_LOG_FIELD_LENGTH
      ? `${redacted.slice(0, MAX_LOG_FIELD_LENGTH)}...`
      : redacted;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogValue(value.message),
    };
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveLogKey(key) ? "[redacted]" : sanitizeLogValue(item),
      ])
    );
  }
  return String(value);
}

export function logInfo(message: string, fields?: Record<string, unknown>) {
  console.info(message, fields ? sanitizeLogValue(fields) : "");
}

export function logWarn(message: string, fields?: Record<string, unknown>) {
  console.warn(message, fields ? sanitizeLogValue(fields) : "");
}

export function logError(message: string, fields?: Record<string, unknown>) {
  console.error(message, fields ? sanitizeLogValue(fields) : "");
}

export async function observeAsync<T>(
  label: string,
  fields: Record<string, unknown>,
  operation: () => Promise<T>,
  getMetrics?: (result: T) => Record<string, unknown>
) {
  const startedAt = Date.now();
  try {
    const result = await operation();
    logInfo(`[observability] ${label}`, {
      ...fields,
      status: "success",
      latencyMs: Date.now() - startedAt,
      ...(getMetrics ? getMetrics(result) : {}),
    });
    return result;
  } catch (error) {
    logWarn(`[observability] ${label}`, {
      ...fields,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}
