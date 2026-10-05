export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5004";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:5004/ws";

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      response.status,
      body.error?.message ?? response.statusText,
      body.error?.code,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
