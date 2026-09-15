// Central API client connecting FreshX to the Go serverless MongoDB backend.
import { getFreshXSession } from "@/lib/session.server";

const getBackendUrl = () => {
  const url = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || "http://localhost:8080";
  return url.replace(/\/+$/, "");
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getBackendUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach auth token if available and not skipped
  if (!options.skipAuth) {
    let token = options.token;
    if (!token) {
      try {
        const session = await getFreshXSession();
        token = session.data?.token;
      } catch {
        // Session not available in this execution context
      }
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Cookie", `token=${token}`);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" && data.length > 0 ? data : `API request failed with status ${res.status}`);
    throw new ApiError(errorMsg, res.status, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "GET" }),

  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
