# Lousse — MVP Design

## Overview

A Slack-like chat application with channels and real-time messaging, hosted entirely on Cloudflare. Personal side project.

---

## Architecture

```
Pages UI (React + Vite)
  │
  ├── REST → Gateway Worker → Auth / Channels / Messages Workers
  └── WS  → Gateway Worker → Realtime Worker → Channel Durable Object (pub/sub)
                                                       │
                                                       └── Service Binding → Messages Worker → D1
```

All workers communicate via **Cloudflare Service Bindings** (no HTTP round-trips).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Realtime | Durable Objects + WebSockets |
| Database | D1 (SQLite) |
| Auth | JWT (`jose` library), no expiry for MVP |
| Frontend | Cloudflare Pages — React + Vite + Tailwind CSS |
| IDs | `nanoid` |
| Tooling | pnpm workspaces + Wrangler |

---

## Data Model (D1)

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE channels (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
```

**Auth:** Registration creates a user row and returns a signed JWT `{ sub: userId, username }`. Token sent as `Authorization: Bearer <token>` on all requests. No login endpoint — token is your credential.

---

## Project Structure

```
lousse/
├── packages/
│   ├── gateway/          # Routing + JWT validation
│   ├── auth-worker/      # /api/auth
│   ├── channels-worker/  # /api/channels
│   ├── messages-worker/  # /api/messages
│   ├── realtime-worker/  # /ws + Durable Objects
│   └── web/              # React + Vite frontend
├── db/
│   └── schema.sql
├── package.json          # pnpm workspaces root
└── wrangler.jsonc
```

---

## API

### Auth Worker — `/api/auth`

| Method | Path | Body | Response | Auth |
|---|---|---|---|---|
| POST | `/register` | `{ username }` | `{ token, user }` | No |

### Channels Worker — `/api/channels`

| Method | Path | Body | Response | Auth |
|---|---|---|---|---|
| GET | `/` | — | `[{ id, name, createdBy }]` | Yes |
| POST | `/` | `{ name }` | `{ id, name }` | Yes |

### Messages Worker — `/api/messages`

| Method | Path | Query | Response | Auth |
|---|---|---|---|---|
| GET | `/:channelId` | `?before=<msgId>&limit=50` | `[{ id, content, user, createdAt }]` | Yes |

### Realtime Worker — `/ws`

| Path | Protocol | Auth |
|---|---|---|
| `/ws/:channelId?token=<jwt>` | WebSocket | Yes (JWT in query param) |

---

## WebSocket Message Protocol

```jsonc
// Server → Client: connection confirmed
{ "type": "connected", "user": { "id": "...", "username": "ada" }, "channelId": "..." }

// Server → ALL: someone joined
{ "type": "user_joined", "user": { "id": "...", "username": "ada" } }

// Server → ALL: someone left
{ "type": "user_left", "user": { "id": "...", "username": "ada" } }

// Client → Server: send a message
{ "type": "message", "content": "hello" }

// Server → ALL: new message broadcast
{ "type": "message", "id": "...", "content": "hello", "user": { "id": "...", "username": "ada" }, "createdAt": 1234567890 }

// Server → Client: error
{ "type": "error", "message": "unauthorized" }
```

**Connection flow:**
1. Client opens WS to `/ws/:channelId?token=<jwt>`
2. Server validates JWT → sends `connected` to that client
3. Server broadcasts `user_joined` to all other clients in the channel
4. On disconnect: server broadcasts `user_left` to remaining clients

---

## Durable Object Behavior

- One DO instance per channel, keyed by `channelId`
- Holds all active WebSocket connections in memory
- On incoming message: broadcasts to all connections, then calls Messages Worker (Service Binding) to persist to D1
- Supports DO hibernation — WebSocket connections survive worker restarts
