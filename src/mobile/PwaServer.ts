import { createServer, Server } from 'http';
import * as url from 'url';
import QRCode from 'qrcode';
import { PairingManager, PairingPayload } from '../p2p/PairingManager';
import { getLogger } from '../core/Logger';
import { pwaHtml } from './pwa/indexHtml';

export interface PwaServerOptions {
  webPort: number;
  signalingPort: number;
  pairing: PairingManager;
  getStatus: () => { active: boolean; clients: number; pairedDevices: number };
}

/**
 * PwaServer — serves the secure Progressive Web App for smartphone control.
 *
 * Routes:
 *   GET  /               → the PWA (pairing + live control)
 *   GET  /pair           → QR pairing page (rendered server-side with qrcode)
 *   POST /api/pairing    → fresh pairing payload (JSON)
 *   GET  /health         → status
 *
 * The app and all state live on the PC; the phone only renders what the PC
 * streams. No data transits any central server.
 */
export class PwaServer {
  private options: PwaServerOptions;
  private server: Server | null = null;

  constructor(options: PwaServerOptions) {
    this.options = options;
  }

  start(): void {
    if (this.server) return;
    this.server = createServer((req, res) => this.route(req, res));
    this.server.listen(this.options.webPort, () => {
      getLogger().info({ port: this.options.webPort }, 'PWA server listening');
    });
  }

  stop(): void {
    if (this.server) {
      try { this.server.close(); } catch { }
      this.server = null;
    }
  }

  private route(req: import('http').IncomingMessage, res: import('http').ServerResponse): void {
    const parsed = url.parse(req.url || '/', true);

    if (req.method === 'POST' && parsed.pathname === '/api/pairing') {
      const payload = this.newPayload();
      this.json(res, 200, { payload, expiresInMs: payload.expiresAt - Date.now() });
      return;
    }

    switch (parsed.pathname) {
      case '/':
      case '/index.html':
        this.html(res, pwaHtml);
        break;
      case '/pair':
        this.pairPage()
          .then(page => this.html(res, page))
          .catch(() => this.html(res, '<h1>QR generation failed — retry</h1>'));
        break;
      case '/health':
        this.json(res, 200, { ok: true, ...this.options.getStatus() });
        break;
      default:
        this.json(res, 404, { error: 'Not found' });
    }
  }

  private newPayload(): PairingPayload {
    return this.options.pairing.createSession(this.lanHost(), this.options.signalingPort);
  }

  private lanHost(): string {
    const candidates = this.localAddresses();
    return candidates[0] || 'localhost';
  }

  private localAddresses(): string[] {
    try {
      const nets = require('os').networkInterfaces();
      const out: string[] = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) out.push(net.address);
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  private async pairPage(): Promise<string> {
    const payload = this.newPayload();
    let qrImg = '';
    try {
      qrImg = await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', width: 512 });
    } catch {
      qrImg = '';
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pair Umbra OS</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1117;color:#e6e6e6;display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px}h1{font-size:20px}code{background:#1c1f27;padding:8px 12px;border-radius:6px;word-break:break-all;max-width:640px}</style></head>
<body><h1>Scan this QR with the Umbra phone app</h1>${qrImg ? `<img src="${qrImg}" alt="pairing QR" width="300"/>` : ''}
<details><summary>Raw pairing payload</summary><code>${JSON.stringify(payload)}</code></details></body></html>`;
  }

  private html(res: import('http').ServerResponse, body: string): void {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  private json(res: import('http').ServerResponse, code: number, body: Record<string, unknown>): void {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
}
