import { nanoid } from 'nanoid';

export interface Env {
  DB: D1Database;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/internal/messages') {
      return persistMessage(request, env);
    }

    if (request.method === 'GET') {
      const match = url.pathname.match(/^\/([^/]+)$/);
      if (match) return getMessages(match[1], url, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function getMessages(channelId: string, url: URL, env: Env): Promise<Response> {
  const channel = await env.DB.prepare('SELECT id FROM channels WHERE id = ?')
    .bind(channelId)
    .first();
  if (!channel) return json({ error: 'Channel not found' }, 404);

  const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = isNaN(limitParam) ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);
  const beforeId = url.searchParams.get('before');

  let cursorTs: number | null = null;
  if (beforeId) {
    const cursor = await env.DB.prepare('SELECT created_at FROM messages WHERE id = ?')
      .bind(beforeId)
      .first<{ created_at: number }>();
    if (!cursor) return json({ error: 'Cursor message not found' }, 404);
    cursorTs = cursor.created_at;
  }

  const query = cursorTs
    ? `SELECT m.id, m.content, m.created_at, u.id as user_id, u.username
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.channel_id = ? AND m.created_at < ?
       ORDER BY m.created_at DESC LIMIT ?`
    : `SELECT m.id, m.content, m.created_at, u.id as user_id, u.username
       FROM messages m JOIN users u ON m.user_id = u.id
       WHERE m.channel_id = ?
       ORDER BY m.created_at DESC LIMIT ?`;

  const stmt = cursorTs
    ? env.DB.prepare(query).bind(channelId, cursorTs, limit)
    : env.DB.prepare(query).bind(channelId, limit);

  const { results } = await stmt.all<{
    id: string;
    content: string;
    created_at: number;
    user_id: string;
    username: string;
  }>();

  return json(
    results.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      user: { id: r.user_id, username: r.username },
    })),
  );
}

async function persistMessage(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { channelId, userId, username, content } = body as Record<string, unknown>;

  if (
    typeof channelId !== 'string' ||
    typeof userId !== 'string' ||
    typeof username !== 'string' ||
    typeof content !== 'string' ||
    !content.trim()
  ) {
    return json({ error: 'Invalid payload' }, 400);
  }

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'INSERT INTO messages (id, channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, channelId, userId, content, now)
    .run();

  return json({ id, content, createdAt: now, user: { id: userId, username } }, 201);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
