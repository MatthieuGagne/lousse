import { nanoid } from 'nanoid';

export interface Env {
  DB: D1Database;
}

const CHANNEL_NAME_RE = /^[a-z0-9-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      if (request.method === 'GET') return listChannels(env);
      if (request.method === 'POST') return createChannel(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function listChannels(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT id, name, created_by FROM channels ORDER BY created_at ASC',
  ).all<{ id: string; name: string; created_by: string }>();

  return json(results.map((r) => ({ id: r.id, name: r.name, createdBy: r.created_by })));
}

async function createChannel(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !CHANNEL_NAME_RE.test(name)) {
    return json({ error: 'Invalid channel name' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM channels WHERE name = ?')
    .bind(name)
    .first();

  if (existing) return json({ error: 'Channel name already taken' }, 409);

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'INSERT INTO channels (id, name, created_by, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(id, name, userId, now)
    .run();

  return json({ id, name }, 201);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
