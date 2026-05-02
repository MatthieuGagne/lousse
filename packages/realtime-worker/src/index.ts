export interface Env {
  CHANNEL: DurableObjectNamespace;
  MESSAGES: Fetcher;
}

interface User {
  id: string;
  username: string;
}

interface WsAttachment {
  user: User;
  channelId: string;
}

interface SavedMessage {
  id: string;
  content: string;
  createdAt: number;
  user: User;
}

export class ChannelDurableObject {
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = request.headers.get('X-User-Id');
    const username = request.headers.get('X-Username');
    if (!userId || !username) return new Response('Unauthorized', { status: 401 });

    const url = new URL(request.url);
    const channelId = url.pathname.slice(1);
    const user: User = { id: userId, username };

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user, channelId } satisfies WsAttachment);

    server.send(JSON.stringify({ type: 'connected', user, channelId }));
    this.broadcast({ type: 'user_joined', user }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const { user, channelId } = ws.deserializeAttachment() as WsAttachment;

    let data: { type?: string; content?: string };
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (data.type !== 'message' || typeof data.content !== 'string') {
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      return;
    }

    const content = data.content.trim();
    if (!content || content.length > 2000) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid content' }));
      return;
    }

    const resp = await this.env.MESSAGES.fetch('https://internal/internal/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, userId: user.id, username: user.username, content }),
    });

    if (!resp.ok) {
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to save message' }));
      return;
    }

    const saved = await resp.json<SavedMessage>();
    this.broadcast({ type: 'message', id: saved.id, content, user, createdAt: saved.createdAt });
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    const { user } = ws.deserializeAttachment() as WsAttachment;
    this.broadcast({ type: 'user_left', user }, ws);
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    const { user } = ws.deserializeAttachment() as WsAttachment;
    this.broadcast({ type: 'user_left', user }, ws);
  }

  private broadcast(data: unknown, exclude?: WebSocket): void {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude) {
        try {
          ws.send(msg);
        } catch {
          // client already disconnected
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (!match) return new Response('Not Found', { status: 404 });

    const channelId = match[1];
    const doId = env.CHANNEL.idFromName(channelId);
    const stub = env.CHANNEL.get(doId);

    const doUrl = new URL(request.url);
    doUrl.pathname = `/${channelId}`;
    return stub.fetch(new Request(doUrl.toString(), request));
  },
} satisfies ExportedHandler<Env>;
