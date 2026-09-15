// Central API client — connects the browser directly to the Go serverless MongoDB backend.
// No proxies, no server functions, no middlemen.

const BACKEND_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BACKEND_URL) ||
  "https://freshxbackend.vercel.app";

export const getBackendUrl = () => String(BACKEND_URL).replace(/\/+$/, "");

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

export function getAuthToken(): string | null {
  const local = localStorage.getItem("freshx_token");
  if (local) return local;
  const match = document.cookie.match(/(?:^|;\s*)freshx_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export function saveAuthSession(user: any, token: string) {
  localStorage.setItem("freshx_token", token);
  localStorage.setItem("freshx_user", JSON.stringify(user));
  document.cookie = `freshx_token=${encodeURIComponent(token)}; path=/; max-age=5184000; SameSite=Lax`;
}

export function clearAuthSession() {
  localStorage.removeItem("freshx_token");
  localStorage.removeItem("freshx_user");
  document.cookie = `freshx_token=; path=/; max-age=0; SameSite=Lax`;
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

  if (!options.skipAuth) {
    const token = options.token || getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
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
