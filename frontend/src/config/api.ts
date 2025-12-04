const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const code = data?.error?.code || 'HTTP_ERROR';
    throw new Error(`${code}: ${message}`);
  }

  return data.data ?? data;
}

export const api = {
  get: <T>(path: string, headers?: HeadersInit) =>
    request<T>(path, { method: 'GET', headers }),
  post: <T>(path: string, body?: any, headers?: HeadersInit) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers }),
  patch: <T>(path: string, body?: any, headers?: HeadersInit) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers }),
  del: <T>(path: string, headers?: HeadersInit) =>
    request<T>(path, { method: 'DELETE', headers }),
};

export { API_BASE_URL };


