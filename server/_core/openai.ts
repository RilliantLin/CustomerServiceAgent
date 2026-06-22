import { ENV } from "./env";
import { redactSensitiveText } from "./observability";

type ResolveOpenAiApiUrlOptions = {
  baseUrl?: string;
};

export function resolveOpenAiApiUrl(
  path: string,
  options: ResolveOpenAiApiUrlOptions = {}
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const rawBaseUrl = options.baseUrl ?? ENV.openAiBaseUrl;
  const baseUrl = rawBaseUrl.replace(/\/$/, "");
  let basePath = "";

  try {
    basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  } catch {
    throw new Error(
      `OpenAI base URL must be an absolute URL, received "${rawBaseUrl}"`
    );
  }

  if (basePath.endsWith("/v1")) {
    return `${baseUrl}${normalizedPath.replace(/^\/v1/, "")}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const ERROR_BODY_MAX_LENGTH = 1_200;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;
type OpenAiHttpErrorOptions = {
  label: string;
  response: Response;
  url: string;
  model?: string;
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) =>
  status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;

const sanitizeErrorText = (text: string) =>
  redactSensitiveText(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ERROR_BODY_MAX_LENGTH);

export async function buildOpenAiHttpError({
  label,
  response,
  url,
  model,
}: OpenAiHttpErrorOptions) {
  const body = sanitizeErrorText(await response.text().catch(() => ""));
  const hints: string[] = [];

  if (response.status === 503) {
    hints.push(
      "Proxy/upstream returned 503. Check whether the gateway is healthy and whether it supports this endpoint and model."
    );
  }
  if (response.status === 404) {
    hints.push(
      "Endpoint was not found. If your proxy already includes /v1 or uses a custom path, adjust OPENAI_BASE_URL or the endpoint-specific path."
    );
  }
  if (response.status === 401 || response.status === 403) {
    hints.push(
      "Authentication was rejected. Verify the API key scope and whether this proxy expects a different credential."
    );
  }

  return new Error(
    [
      `${label} failed via ${url}${model ? ` (model: ${model})` : ""}: ${response.status} ${response.statusText}`,
      body ? `Response: ${body}` : "",
      hints.length > 0 ? `Hint: ${hints.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join(" - ")
  );
}

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

const computeBackoffDelay = (attempt: number, retryAfterMs?: number): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

export async function fetchWithBackoff(
  url: string,
  init: FetchInit,
  label = "OpenAI request"
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
      clearTimeout(timeoutId);

      if (
        response.ok ||
        attempt === RETRY_MAX_RETRIES ||
        !shouldRetryStatus(response.status)
      ) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `${label} retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `${label} retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after exhausting retries`);
}
