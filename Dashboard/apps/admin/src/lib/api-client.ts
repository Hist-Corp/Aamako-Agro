// ─── API Client ───────────────────────────────────────────────────────
// Single HTTP client for all admin dashboard API calls.
// Uses JWT/refresh-token auth — same session as the customer platform.
//
// The backend serves routes under `/api` (no `/v1` version prefix).
// When no absolute NEXT_PUBLIC_API_URL is provided we stay same-origin
// (`/api`), and next.config.js rewrites those calls to the backend, so
// local dev needs zero env files and no CORS.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, body, headers: customHeaders, ...rest } = options;

    // Build URL with query params
    const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired — attempt refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url.toString(), {
            headers,
            body: body ? JSON.stringify(body) : undefined,
            ...rest,
          });
          if (!retryResponse.ok) {
            throw new ApiError(retryResponse.status, await retryResponse.json());
          }
          return retryResponse.json();
        }
        // Refresh failed — redirect to login
        window.location.href = '/login';
        throw new ApiError(401, { message: 'Session expired' });
      }
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(response.status, errorData);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /** Multipart file upload (image from device). `file` is sent as "file". */
  async upload<T>(endpoint: string, file: File): Promise<T> {
    const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    const response = await fetch(url.toString(), { method: 'POST', headers, body: form });
    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retry = await fetch(url.toString(), { method: 'POST', headers, body: form });
          if (!retry.ok) throw new ApiError(retry.status, await retry.json());
          return retry.json();
        }
        window.location.href = '/login';
        throw new ApiError(401, { message: 'Session expired' });
      }
      throw new ApiError(response.status, await response.json().catch(() => ({})));
    }
    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const storedRefresh = localStorage.getItem('refresh_token');
      if (!storedRefresh) return false;

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      // Backend returns top-level { accessToken, refreshToken }
      const accessToken = data.accessToken ?? data.tokens?.accessToken ?? null;
      const refreshToken = data.refreshToken ?? data.tokens?.refreshToken ?? null;
      if (!accessToken) return false;
      this.accessToken = accessToken;
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // Convenience methods
  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    const message = (data as { message?: string })?.message ?? `API Error ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = new ApiClient();
