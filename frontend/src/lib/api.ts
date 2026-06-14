import { useAuthStore } from "@/store/authStore";
import type { AuthResponse } from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function refreshTokens(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      logout();
      return false;
    }
    const data: AuthResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

interface Options extends RequestInit {
  auth?: boolean;
  retry?: boolean;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { auth = true, retry = true, headers, ...rest } = options;
  const token = useAuthStore.getState().accessToken;
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  if (rest.body && !(rest.body instanceof FormData) && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
  }
  if (auth && token) h["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: h });

  if (res.status === 401 && auth && retry) {
    const ok = await refreshTokens();
    if (ok) return apiFetch<T>(path, { ...options, retry: false });
    useAuthStore.getState().logout();
  }

  if (!res.ok) {
    let message = res.statusText;
    let fieldErrors: Record<string, string> | undefined;
    try {
      const err = await res.json();
      message = err.message || message;
      fieldErrors = err.fieldErrors;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, fieldErrors);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(p: string) => apiFetch<T>(p),
  post: <T>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => apiFetch<T>(p, { method: "DELETE" }),
  postForm: <T>(p: string, form: FormData) => apiFetch<T>(p, { method: "POST", body: form }),
};

export interface StreamHandlers {
  onMeta?: (conversationId: string) => void;
  onToken?: (text: string) => void;
  onDone?: (message: unknown) => void;
  onError?: (err: Error) => void;
}

export async function streamChat(
  body: { conversationId?: string | null; message: string },
  handlers: StreamHandlers,
  retry = true
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e : new Error("Network error"));
    return;
  }

  if (res.status === 401 && retry) {
    const ok = await refreshTokens();
    if (ok) return streamChat(body, handlers, false);
  }
  if (!res.ok || !res.body) {
    handlers.onError?.(new Error("No se pudo iniciar el streaming de la respuesta"));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) parseEvent(part, handlers);
  }
  if (buffer.trim()) parseEvent(buffer, handlers);
}

function parseEvent(raw: string, handlers: StreamHandlers) {
  const lines = raw.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    if (event === "meta") handlers.onMeta?.(parsed.conversationId);
    else if (event === "token") handlers.onToken?.(parsed.t);
    else if (event === "done") handlers.onDone?.(parsed);
  } catch {
    /* ignore malformed chunk */
  }
}
