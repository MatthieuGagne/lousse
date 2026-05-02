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
