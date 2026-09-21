import { createServer, IncomingMessage, Server } from 'http';
import type { AddressInfo } from 'net';

export interface HubCall {
  method: string;
  path: string;
  authorization?: string;
  body?: unknown;
}

// Hub de mentira: segue o contrato de docs/arquitetura-hub.md do repo do hub.
export class MockHub {
  readonly calls: HubCall[] = [];
  readonly validTokens = new Set<string>();
  private server!: Server;
  private issued = 0;

  constructor(private readonly participantToken: string) {}

  get url() {
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async start() {
    this.server = createServer(async (req, res) => {
      const body = await readBody(req);
      const call: HubCall = {
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        authorization: req.headers.authorization,
        body,
      };
      this.calls.push(call);

      const reply = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const bearer = call.authorization?.replace(/^Bearer /, '');

      if (call.path === '/health') return reply(200, { status: 'ok' });

      if (call.path === '/auth' && call.method === 'POST') {
        if (bearer !== this.participantToken) return reply(401, {});
        const token = `user-token-${++this.issued}`;
        this.validTokens.add(token);
        return reply(201, { token });
      }

      if (call.path === '/checkins' && call.method === 'POST') {
        if (!bearer || !this.validTokens.has(bearer)) return reply(401, {});
        return reply(200, { checkpoint: (body as { checkpoint: string }).checkpoint });
      }

      reply(404, {});
    });

    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
  }

  stop() {
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  callsTo(path: string) {
    return this.calls.filter((c) => c.path === path);
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : undefined;
}
