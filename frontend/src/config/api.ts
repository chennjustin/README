const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Custom error class for authentication errors
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

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
    
    // Handle 401 Unauthorized errors specially
    if (res.status === 401) {
      // Clear authentication data from localStorage
      const adminAuth = window.localStorage.getItem('adminAuth');
      const memberAuth = window.localStorage.getItem('memberAuth');
      if (adminAuth) {
        window.localStorage.removeItem('adminAuth');
        // Dispatch custom event to notify context
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { type: 'admin' } }));
      }
      if (memberAuth) {
        window.localStorage.removeItem('memberAuth');
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { type: 'member' } }));
      }
      throw new AuthenticationError(message);
    }
    
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


