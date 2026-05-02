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
