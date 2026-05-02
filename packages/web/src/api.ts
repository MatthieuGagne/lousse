const BASE = import.meta.env.VITE_API_URL ?? '';

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = Object.assign(new Error((data as { error?: string }).error ?? 'Request failed'), {
      status: res.status,
    });
    throw err;
  }
  return data;
}

export interface Channel {
  id: string;
  name: string;
  createdBy: string;
}

export interface Message {
  id: string;
  content: string;
  createdAt: number;
  user: { id: string; username: string };
}

export const api = {
  register: (username: string) =>
    request<{ token: string; user: { id: string; username: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  listChannels: () => request<Channel[]>('/api/channels'),

  createChannel: (name: string) =>
    request<{ id: string; name: string }>('/api/channels', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getMessages: (channelId: string, before?: string) =>
    request<Message[]>(`/api/messages/${channelId}${before ? `?before=${before}` : ''}`),
};

export function wsUrl(channelId: string): string {
  const base = (import.meta.env.VITE_API_URL ?? window.location.origin).replace(/^http/, 'ws');
  return `${base}/ws/${channelId}?token=${getToken() ?? ''}`;
}
