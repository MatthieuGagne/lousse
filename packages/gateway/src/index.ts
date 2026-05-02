import { jwtVerify } from 'jose';

export interface Env {
  AUTH: Fetcher;
  CHANNELS: Fetcher;
  MESSAGES: Fetcher;
  REALTIME: Fetcher;
  JWT_SECRET: string;
}

interface JWTPayload {
  sub: string;
  username: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith('/api/auth/')) {
      const downstream = stripPrefix(request, '/api/auth');
      return withCors(await env.AUTH.fetch(downstream));
    }

    if (pathname.startsWith('/ws/')) {
      const token = url.searchParams.get('token');
      const user = token ? await verifyToken(token, env.JWT_SECRET) : null;
      if (!user) return unauthorized();
      return env.REALTIME.fetch(withUser(request, user));
    }

    const user = await verifyFromHeader(request, env.JWT_SECRET);
    if (!user) return unauthorized();

    if (pathname.startsWith('/api/channels/') || pathname === '/api/channels') {
      const downstream = stripPrefix(request, '/api/channels');
      return withCors(await env.CHANNELS.fetch(withUser(downstream, user)));
    }

    if (pathname.startsWith('/api/messages/') || pathname === '/api/messages') {
      const downstream = stripPrefix(request, '/api/messages');
      return withCors(await env.MESSAGES.fetch(withUser(downstream, user)));
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function verifyFromHeader(request: Request, secret: string): Promise<JWTPayload | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7), secret);
}

async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

function stripPrefix(request: Request, prefix: string): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(prefix.length) || '/';
  return new Request(url.toString(), request);
}

function withUser(request: Request, user: JWTPayload): Request {
  const headers = new Headers(request.headers);
  headers.set('X-User-Id', user.sub);
  headers.set('X-Username', user.username);
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  return new Request(request.url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
  });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function withCors(response: Response): Response {
  const res = new Response(response.body, response);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
