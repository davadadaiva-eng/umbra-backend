import * as http from 'http';
import { URL } from 'url';
import WebSocket from 'ws';
import { eventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';

export interface ApiServerDeps {
  getStatus(): Promise<Record<string, unknown>>;
  submitTask(description: string, priority?: number): Promise<string>;
  getTask(id: string): unknown;
  getActiveTasks(): unknown;
  executeDesktop2(action: string, params: Record<string, unknown>): Promise<string>;
  executeGhost(action: string, params: Record<string, unknown>): Promise<string>;
  captureGhost(): Promise<string | null>;
  requestConsent(reason: string): Promise<string>;
  getConsentState(): Record<string, unknown>;
  isEmergencyStopArmed(): boolean;
  armEmergencyStop(): void;
  disarmEmergencyStop(): void;
  searchKnowledge(q: string): Promise<unknown>;
  getMacros(): Promise<unknown>;
  getSessions(): Promise<unknown>;
  getPrivacyStats(): Promise<unknown>;
  getActivitySummary(): Promise<unknown>;
  getSwarmStatus(): Promise<unknown>;
  getAuditStats(): Promise<unknown>;
  getRepos(): Promise<unknown>;
  getMcpCatalog(): Promise<unknown>;
  connectMcp(id: string, opts: { baseUrl?: string; apiKey?: string; enabled?: boolean }): Promise<unknown>;
  syncExternalConnectors(opts?: { maxPerSource?: number }): Promise<unknown>;
  delegateHermes(description: string, opts?: { provider?: string; model?: string; timeoutMs?: number }): Promise<unknown>;
  generateJournalNow(): Promise<unknown>;
  shutdown(): void;
}

type Handler = (url: URL, body: Record<string, unknown>, match?: RegExpMatchArray) => Promise<unknown>;

const MAX_BODY_BYTES = 1 * 1024 * 1024;

export class ApiServer {
  private server: http.Server | null = null;
  private wss: WebSocket.Server | null = null;
  private deps: ApiServerDeps;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(deps: ApiServerDeps, port: number = 8787) {
    this.deps = deps;
    this.port = port;
  }

  start(): void {
    if (this.server) return;
    this.server = http.createServer((req, res) => this.handleRequest(req, res).catch(err => {
      this.sendJson(res, 500, { error: err.message || 'Internal error' });
    }));

    this.wss = new WebSocket.Server({ server: this.server, path: '/api/ws' });
    this.wss.on('connection', ws => this.handleWsConnection(ws));

    this.server.listen(this.port, '127.0.0.1');
    this.subscribeBus();
    getLogger().info({ port: this.port }, 'API server listening on 127.0.0.1');
  }

  async stop(): Promise<void> {
    this.unsubscribeBus();

    if (this.wss) {
      for (const client of this.clients) {
        try { client.close(); } catch { }
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      if (typeof (this.server as any).closeAllConnections === 'function') {
        (this.server as any).closeAllConnections();
      }
      await new Promise<void>(resolve => {
        this.server!.close(() => resolve());
        setTimeout(resolve, 2000);
      });
      this.server = null;
    }
  }

  // ── HTTP ──────────────────────────────────────────────────

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const route = `${req.method} ${url.pathname}`;

    let body: Record<string, unknown> = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await this.readBody(req);
    }

    const handler = this.routeHandler(route);
    if (!handler) {
      this.sendJson(res, 404, { error: `No route: ${route}` });
      return;
    }

    try {
      const result = await handler(url, body);
      this.sendJson(res, 200, result);
    } catch (err: any) {
      getLogger().warn({ route, err: err.message }, 'API route failed');
      this.sendJson(res, 500, { error: err.message || 'Internal error' });
    }
  }

  private routeHandler(route: string): Handler | null {
    const map: Array<[RegExp, Handler]> = [
      [/^GET \/api\/health$/, async () => ({ ok: true, uptimeMs: process.uptime() * 1000 })],
      [/^GET \/api\/status$/, async () => this.deps.getStatus()],
      [/^GET \/api\/tasks$/, async () => ({ tasks: this.deps.getActiveTasks() })],
      [/^GET \/api\/task\/([\w-]+)$/, async (_url, _body, match) => {
        const task = this.deps.getTask(match![1]);
        if (!task) throw new Error('Task not found');
        return { task };
      }],
      [/^POST \/api\/task$/, async (_url, body) => {
        const description = String(body.description || '').trim();
        if (!description) throw new Error('description is required');
        const priority = Number(body.priority || 0);
        const taskId = await this.deps.submitTask(description, priority);
        return { taskId };
      }],
      [/^POST \/api\/desktop2\/action$/, async (_url, body) => {
        const action = String(body.action || '');
        if (!action) throw new Error('action is required');
        const params = (body.params && typeof body.params === 'object') ? body.params as Record<string, unknown> : {};
        return { result: await this.deps.executeDesktop2(action, params) };
      }],
      [/^POST \/api\/ghost\/action$/, async (_url, body) => {
        const action = String(body.action || '');
        if (!action) throw new Error('action is required');
        const params = (body.params && typeof body.params === 'object') ? body.params as Record<string, unknown> : {};
        return { result: await this.deps.executeGhost(action, params) };
      }],
      [/^GET \/api\/ghost\/capture$/, async () => {
        const png = await this.deps.captureGhost();
        if (!png) throw new Error('No capture available — open Chrome or an app on Desktop 2 first');
        return { image: png };
      }],
      [/^GET \/api\/consent$/, async () => ({
        ...this.deps.getConsentState(),
        emergencyStopArmed: this.deps.isEmergencyStopArmed(),
      })],
      [/^POST \/api\/consent$/, async (_url, body) => {
        const action = String(body.action || '');
        if (action === 'request') {
          const reason = String(body.reason || 'Request from UI');
          return { result: await this.deps.requestConsent(reason) };
        }
        if (action === 'arm') {
          this.deps.armEmergencyStop();
          return { result: 'armed' };
        }
        if (action === 'disarm') {
          this.deps.disarmEmergencyStop();
          return { result: 'disarmed' };
        }
        throw new Error(`Unknown consent action: ${action}`);
      }],
      [/^GET \/api\/knowledge\/search$/, async url => ({ results: await this.deps.searchKnowledge(url.searchParams.get('q') || '') })],
      [/^GET \/api\/macros$/, async () => ({ macros: await this.deps.getMacros() })],
      [/^GET \/api\/sessions$/, async () => ({ sessions: await this.deps.getSessions() })],
      [/^GET \/api\/privacy\/stats$/, async () => this.deps.getPrivacyStats()],
      [/^GET \/api\/activity\/summary$/, async () => this.deps.getActivitySummary()],
      [/^GET \/api\/swarm$/, async () => ({ swarm: await this.deps.getSwarmStatus() })],
      [/^GET \/api\/vault\/stats$/, async () => ({ vault: await this.deps.getAuditStats() })],
      [/^GET \/api\/repos$/, async () => ({ repos: await this.deps.getRepos() })],
      [/^GET \/api\/mcp\/catalog$/, async () => ({ catalog: await this.deps.getMcpCatalog() })],
      [/^POST \/api\/mcp\/connect$/, async (_url, body) => {
        const id = String(body.id || '');
        if (!id) throw new Error('id is required');
        const opts = {
          baseUrl: body.baseUrl !== undefined ? String(body.baseUrl) : undefined,
          apiKey: body.apiKey !== undefined ? String(body.apiKey) : undefined,
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        };
        return { connector: await this.deps.connectMcp(id, opts) };
      }],
      [/^POST \/api\/mcp\/sync$/, async (_url, body) => {
        const maxPerSource = body.maxPerSource !== undefined ? Number(body.maxPerSource) : 100;
        return { sync: await this.deps.syncExternalConnectors({ maxPerSource }) };
      }],
      [/^POST \/api\/agent\/delegate$/, async (_url, body) => {
        const description = String(body.description || '');
        if (!description) throw new Error('description is required');
        const opts = {
          provider: body.provider !== undefined ? String(body.provider) : undefined,
          model: body.model !== undefined ? String(body.model) : undefined,
          timeoutMs: body.timeoutMs !== undefined ? Number(body.timeoutMs) : undefined,
        };
        return { output: await this.deps.delegateHermes(description, opts) };
      }],
      [/^POST \/api\/journal\/generate$/, async () => ({ journal: await this.deps.generateJournalNow() })],
      [/^POST \/api\/shutdown$/, async () => {
        this.deps.shutdown();
        return { ok: true };
      }],
    ];

    for (const [pattern, handler] of map) {
      const match = route.match(pattern);
      if (match) {
        return (url, body) => handler(url, body, match);
      }
    }
    return null;
  }

  private readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
        if (data.length > MAX_BODY_BYTES) {
          reject(new Error('Request body too large'));
          req.destroy();
        }
      });
      req.on('end', () => {
        if (!data.trim()) { resolve({}); return; }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  private setCors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  private sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
    const text = JSON.stringify(payload);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(text);
  }

  // ── WebSocket ─────────────────────────────────────────────

  private handleWsConnection(ws: WebSocket): void {
    this.clients.add(ws);

    this.deps.getStatus().then(status => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'snapshot', status }));
      }
    }).catch(() => { });

    ws.on('close', () => this.clients.delete(ws));
    ws.on('error', () => this.clients.delete(ws));
  }

  private broadcast(payload: Record<string, unknown>): void {
    const text = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(text); } catch { }
      }
    }
  }

  private busHandlers: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  private eventNames = [
    'app:ready', 'app:shutdown',
    'task:created', 'task:started', 'task:completed', 'task:failed', 'task:cancelled',
    'swarm:allocated', 'swarm:freed',
    'display:created', 'display:destroyed',
    'healing:recovered', 'healing:failed',
    'recall:macro-detected',
    'audio:gesture',
    'config:changed',
    'knowledge:updated',
    'vault:entry',
    'overlay:toggle', 'overlay:command',
    'stream:started', 'stream:stopped',
  ] as const;

  private subscribeBus(): void {
    for (const name of this.eventNames) {
      const fn = (...args: unknown[]): void => {
        this.broadcast({ type: 'event', name, payload: args.length === 1 ? args[0] : args });
      };
      const list = this.busHandlers.get(name) || [];
      list.push(fn);
      this.busHandlers.set(name, list);
      eventBus.on(name as any, fn as any);
    }
  }

  private unsubscribeBus(): void {
    for (const name of this.eventNames) {
      const handlers = this.busHandlers.get(name);
      if (handlers) {
        for (const fn of handlers) eventBus.off(name as any, fn as any);
      }
    }
    this.busHandlers.clear();
  }
}

export default ApiServer;
