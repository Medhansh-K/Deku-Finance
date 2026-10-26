import { ApiError, NetworkError } from "./errors";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  token?: string | null;
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, token, headers: customHeaders, ...rest } = options;

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers = new Headers(customHeaders);
  if (!headers.has("Content-Type") && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Retrieve token from argument, localStorage, or cookies if available in browser
  const activeToken =
    token ||
    (typeof window !== "undefined"
      ? localStorage.getItem("deku_auth_token")
      : null);

  if (activeToken) {
    headers.set("Authorization", `Bearer ${activeToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      signal: rest.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    let responseData: any = null;

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }

    if (!response.ok) {
      const errorMsg =
        responseData?.message ||
        responseData?.error ||
        `HTTP Error ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMsg, response.status, responseData);
    }

    return responseData as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new NetworkError("Request timed out. The server took too long to respond.");
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new NetworkError(err.message || "Failed to communicate with Deku backend");
  }
}
