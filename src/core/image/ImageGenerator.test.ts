import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ImageGenerator } from './ImageGenerator';
import { UmbraConfig } from '../../types';

const dir = path.join(os.tmpdir(), `umbra-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function makeConfig(image: Partial<UmbraConfig['image']> = {}): UmbraConfig {
  return {
    provider: 'ollama',
    models: { provider: 'ollama', reasoning: 'r', vision: 'v', fast: 'f' },
    hotkeys: { overlay: '', pause: '', togglePreview: '' },
    workspace: { maxSwarmDisplays: 1, displayWidth: 0, displayHeight: 0, displayFps: 0, cpuLimit: 0, gpuLimit: 0 },
    paths: { dataDir: dir, knowledgeDir: dir, recallDb: dir, vaultDir: dir, logsDir: dir },
    audio: { enabled: false, gestureCooldownMs: 0 },
    realDesktop: { chromePath: '', cdpPort: 0, windowWidth: 0, windowHeight: 0, enabled: false },
    repos: [],
    logging: { level: 'warn', prettyPrint: false },
    p2p: { enabled: false, webPort: 0, signalingPort: 0, stunServers: [], relayFps: 0 },
    plan: { tier: 'free', apiCreditPool: 0, imagesMonthly: 0, videoMonthly: 0 },
    graphify: { enabled: false, maxContextTokens: 0, summaryTokens: 0, chunkTokens: 0 },
    compiler: { enabled: false, backend: 'none', outputDir: dir },
    mcp: { enabled: false, connectors: [] },
    shadow: { enabled: false, capture: 'gdi', fps: 0 },
    meeting: { enabled: false, stt: 'none', tts: 'none', loopbackEnabled: true, chunkSec: 12 },
    awareness: { enabled: true },
    telco: { enabled: false, provider: 'telnyx', fromNumber: '' },
    docker: { enabled: false, socketPath: '', defaultCpus: 0, defaultMemoryMb: 0 },
    billing: { enabled: false, provider: 'stripe', secretKey: '', webhookSecret: '', priceIds: { pro: '', ultimate: '' }, publicUrl: '' },
    image: { enabled: true, provider: 'huggingface', model: 'black-forest-labs/FLUX.1-schnell', apiKey: 'hf-test', ...image },
    hermes: { enabled: true, bin: '', taskTimeoutMs: 300_000, autoDelegate: true },
    devices: { enabled: true, hubPort: 8788, hubUrl: '', name: 'test', role: 'desktop' },
    voice: { enabled: false, sttProvider: 'none', sttEndpoint: '', sttApiKey: '', sttModel: 'whisper-1' },
  };
}

describe('ImageGenerator', () => {
  it('generates an image through the Hugging Face (Flux Schnell) API', async () => {
    let receivedPrompt = '';
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        receivedPrompt = JSON.parse(body).inputs;
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(PNG);
      });
    });
    await new Promise<void>(r => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const gen = new ImageGenerator(makeConfig({ endpoint: `http://127.0.0.1:${port}` }));
    const result = await gen.generate('a neon fox');
    expect(receivedPrompt).toBe('a neon fox');
    expect(result.provider).toBe('huggingface');
    expect(fs.existsSync(result.imagePath)).toBe(true);
    expect(result.bytes).toBe(PNG.length);

    await new Promise<void>(r => server.close(() => r()));
  });

  it('polls a Replicate prediction until it succeeds and downloads the output', async () => {
    let polls = 0;
    let server: http.Server;
    server = http.createServer((req, res) => {
      const port = (server.address() as AddressInfo).port;
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url?.startsWith('/predictions/')) {
        polls++;
        res.end(JSON.stringify(
          polls >= 2
            ? { status: 'succeeded', output: [`http://127.0.0.1:${port}/img.png`] }
            : { status: 'processing' },
        ));
        return;
      }
      if (req.method === 'POST' && req.url?.endsWith('/predictions')) {
        res.end(JSON.stringify({ id: 'p1', status: 'processing', urls: { get: '' } }));
        return;
      }
      if (req.url?.endsWith('/img.png')) {
        res.setHeader('Content-Type', 'image/png');
        res.end(PNG);
        return;
      }
      res.writeHead(404);
      res.end('{}');
    });
    await new Promise<void>(r => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const gen = new ImageGenerator(makeConfig({
      provider: 'replicate',
      model: 'flux-schnell',
      endpoint: `http://127.0.0.1:${port}`,
    }));
    const result = await gen.generate('a neon fox');
    expect(result.provider).toBe('replicate');
    expect(fs.existsSync(result.imagePath)).toBe(true);

    await new Promise<void>(r => server.close(() => r()));
  });

  it('rejects when disabled or missing a prompt', async () => {
    const disabled = new ImageGenerator(makeConfig({ enabled: false }));
    await expect(disabled.generate('x')).rejects.toThrow(/disabled/);
    const enabled = new ImageGenerator(makeConfig());
    await expect(enabled.generate('')).rejects.toThrow(/prompt is required/);
  });
});
