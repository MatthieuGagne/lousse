export interface Env {
  DB: D1Database;
}

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('messages-worker stub', { status: 200 });
  },
} satisfies ExportedHandler<Env>;
