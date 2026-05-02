import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const USERNAME_RE = /^[a-zA-Z0-9-]{1,32}$/;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/register') {
      return handleRegister(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { username } = body as Record<string, unknown>;

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return json({ error: 'Invalid username' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>();

  if (existing) {
    return json({ error: 'Username already taken' }, 409);
  }

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)')
    .bind(id, username, now)
    .run();

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new SignJWT({ sub: id, username })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret);

  return json({ token, user: { id, username } }, 201);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
