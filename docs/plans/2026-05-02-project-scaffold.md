# [Infra] Project Scaffold — Monorepo & Wrangler Setup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap a pnpm monorepo with all Cloudflare Worker packages, shared TypeScript config, Service Binding declarations, and a Vite + React + Tailwind frontend stub.

**Architecture:** Six packages under `packages/` — five Cloudflare Workers (gateway, auth-worker, channels-worker, messages-worker, realtime-worker) plus a React/Vite web app. Workers communicate via Service Bindings declared in each package's `wrangler.toml`. All TypeScript configs extend a shared root `tsconfig.json`.

**Tech Stack:** pnpm workspaces, Wrangler v3, TypeScript 5, @cloudflare/workers-types 4, React 18, Vite 5, Tailwind CSS 3.

---

### Task 1: Root workspace config

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 2: Create root package.json**

```json
{
  "name": "lousse",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "type-check": "pnpm -r run type-check",
    "dev:gateway": "pnpm --filter @lousse/gateway dev",
    "dev:auth": "pnpm --filter @lousse/auth-worker dev",
    "dev:channels": "pnpm --filter @lousse/channels-worker dev",
    "dev:messages": "pnpm --filter @lousse/messages-worker dev",
    "dev:realtime": "pnpm --filter @lousse/realtime-worker dev",
    "dev:web": "pnpm --filter @lousse/web dev",
    "deploy": "pnpm -r run deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.4.0",
    "wrangler": "^3.60.0"
  }
}
```

**Step 3: Create base tsconfig.json**

No `include` here — this is a base config only. Each package extends it and declares its own `include`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
.wrangler/
dist/
.dev.vars
*.local
```

**Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.json .gitignore
git commit -m "chore: init pnpm workspace root"
```

---

### Task 2: D1 schema

**Files:**
- Create: `db/schema.sql`

**Step 1: Create db/schema.sql**

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

**Step 2: Commit**

```bash
git add db/schema.sql
git commit -m "chore: add D1 schema"
```

---

### Task 3: auth-worker skeleton

**Files:**
- Create: `packages/auth-worker/src/index.ts`
- Create: `packages/auth-worker/tsconfig.json`
- Create: `packages/auth-worker/wrangler.toml`
- Create: `packages/auth-worker/package.json`

**Step 1: Write the stub — this is the type contract for the auth worker**

`packages/auth-worker/src/index.ts`:
```typescript
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('auth-worker stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
```

`_` prefixes on unused params are required — TypeScript's `noUnusedParameters` is enabled globally.

**Step 2: Run tsc to confirm it fails before setup**

```bash
cd packages/auth-worker && npx tsc --noEmit 2>&1 | head -5
```
Expected: error — no tsconfig found or workers-types missing.

**Step 3: Create packages/auth-worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create packages/auth-worker/wrangler.toml**

```toml
name = "lousse-auth"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
# Use `wrangler secret put JWT_SECRET` in production — never commit real secrets
JWT_SECRET = "dev-secret-change-in-production"

[[d1_databases]]
binding = "DB"
database_name = "lousse"
# Replace after running: wrangler d1 create lousse
database_id = "placeholder-replace-with-d1-id"
```

**Step 5: Create packages/auth-worker/package.json**

```json
{
  "name": "@lousse/auth-worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  }
}
```

**Step 6: Commit**

```bash
git add packages/auth-worker/
git commit -m "chore: scaffold auth-worker"
```

---

### Task 4: channels-worker skeleton

**Files:**
- Create: `packages/channels-worker/src/index.ts`
- Create: `packages/channels-worker/tsconfig.json`
- Create: `packages/channels-worker/wrangler.toml`
- Create: `packages/channels-worker/package.json`

**Step 1: Write the stub**

`packages/channels-worker/src/index.ts`:
```typescript
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('channels-worker stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
```

**Step 2: Create packages/channels-worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/channels-worker/wrangler.toml**

```toml
name = "lousse-channels"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "lousse"
# Replace after running: wrangler d1 create lousse
database_id = "placeholder-replace-with-d1-id"
```

**Step 4: Create packages/channels-worker/package.json**

```json
{
  "name": "@lousse/channels-worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  }
}
```

**Step 5: Commit**

```bash
git add packages/channels-worker/
git commit -m "chore: scaffold channels-worker"
```

---

### Task 5: messages-worker skeleton

**Files:**
- Create: `packages/messages-worker/src/index.ts`
- Create: `packages/messages-worker/tsconfig.json`
- Create: `packages/messages-worker/wrangler.toml`
- Create: `packages/messages-worker/package.json`

**Step 1: Write the stub**

`packages/messages-worker/src/index.ts`:
```typescript
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('messages-worker stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
```

**Step 2: Create packages/messages-worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/messages-worker/wrangler.toml**

```toml
name = "lousse-messages"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "lousse"
# Replace after running: wrangler d1 create lousse
database_id = "placeholder-replace-with-d1-id"
```

**Step 4: Create packages/messages-worker/package.json**

```json
{
  "name": "@lousse/messages-worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  }
}
```

**Step 5: Commit**

```bash
git add packages/messages-worker/
git commit -m "chore: scaffold messages-worker"
```

---

### Task 6: realtime-worker skeleton

This package exports both the default fetch handler **and** `ChannelDurableObject`. Both exports must be named in `wrangler.toml` for Cloudflare to wire them correctly.

**Files:**
- Create: `packages/realtime-worker/src/index.ts`
- Create: `packages/realtime-worker/tsconfig.json`
- Create: `packages/realtime-worker/wrangler.toml`
- Create: `packages/realtime-worker/package.json`

**Step 1: Write the stub**

`packages/realtime-worker/src/index.ts`:
```typescript
export interface Env {
  CHANNEL: DurableObjectNamespace;
  MESSAGES: Fetcher;
}

export class ChannelDurableObject implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response('channel-do stub', { status: 200 });
  }
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('realtime-worker stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
```

**Step 2: Create packages/realtime-worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/realtime-worker/wrangler.toml**

```toml
name = "lousse-realtime"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[durable_objects.bindings]]
name = "CHANNEL"
class_name = "ChannelDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["ChannelDurableObject"]

[[services]]
binding = "MESSAGES"
service = "lousse-messages"
```

**Step 4: Create packages/realtime-worker/package.json**

```json
{
  "name": "@lousse/realtime-worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  }
}
```

**Step 5: Commit**

```bash
git add packages/realtime-worker/
git commit -m "chore: scaffold realtime-worker with Durable Object"
```

---

### Task 7: gateway skeleton

The gateway has Service Bindings to all four workers and validates JWTs on every authenticated request.

**Files:**
- Create: `packages/gateway/src/index.ts`
- Create: `packages/gateway/tsconfig.json`
- Create: `packages/gateway/wrangler.toml`
- Create: `packages/gateway/package.json`

**Step 1: Write the stub**

`packages/gateway/src/index.ts`:
```typescript
export interface Env {
  AUTH: Fetcher;
  CHANNELS: Fetcher;
  MESSAGES: Fetcher;
  REALTIME: Fetcher;
  JWT_SECRET: string;
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('gateway stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
```

**Step 2: Create packages/gateway/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/gateway/wrangler.toml**

```toml
name = "lousse-gateway"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
# Use `wrangler secret put JWT_SECRET` in production — never commit real secrets
JWT_SECRET = "dev-secret-change-in-production"

[[services]]
binding = "AUTH"
service = "lousse-auth"

[[services]]
binding = "CHANNELS"
service = "lousse-channels"

[[services]]
binding = "MESSAGES"
service = "lousse-messages"

[[services]]
binding = "REALTIME"
service = "lousse-realtime"
```

**Step 4: Create packages/gateway/package.json**

```json
{
  "name": "@lousse/gateway",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "type-check": "tsc --noEmit"
  }
}
```

**Step 5: Commit**

```bash
git add packages/gateway/
git commit -m "chore: scaffold gateway with service bindings"
```

---

### Task 8: web skeleton

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/postcss.config.js`
- Create: `packages/web/tailwind.config.ts`
- Create: `packages/web/src/index.css`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`

**Step 1: Create packages/web/package.json**

```json
{
  "name": "@lousse/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "wrangler pages deploy dist",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0"
  }
}
```

**Step 2: Create packages/web/tsconfig.json**

Web needs DOM types in addition to ES2022 — workers don't, so this diverges from the base `lib`.

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src/**/*", "vite.config.ts"]
}
```

**Step 3: Create packages/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**Step 4: Create packages/web/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lousse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create packages/web/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 6: Create packages/web/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

**Step 7: Create packages/web/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 8: Create packages/web/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Step 9: Create packages/web/src/App.tsx**

```tsx
export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <h1 className="text-2xl font-bold">Lousse</h1>
    </div>
  );
}
```

**Step 10: Commit**

```bash
git add packages/web/
git commit -m "chore: scaffold web package (React + Vite + Tailwind)"
```

---

### Task 9: Install dependencies and verify all type-checks pass

This is the verification step — all the stubs were written to type-check correctly; this confirms they do.

**Step 1: Install all workspace dependencies from the root**

```bash
pnpm install
```
Expected: All packages resolved, lockfile written, zero errors.

**Step 2: Run type-check across all packages**

```bash
pnpm -r run type-check
```
Expected: Each of the 6 packages reports "Found 0 errors." and exits 0.

**Step 3: If a worker fails type-check**

Common causes and fixes:
- `Cannot find name 'D1Database'` → `tsconfig.json` missing `"types": ["@cloudflare/workers-types"]`
- `Unused parameter` error → parameter name must be prefixed with `_`
- `Property 'fetch' does not exist on type 'DurableObject'` → check workers-types version supports the interface

**Step 4: Commit the lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: add pnpm lockfile"
```
