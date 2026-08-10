import * as os from 'os';
import * as path from 'path';
import { McpRegistry } from './McpRegistry';
import { McpRouter } from './McpRouter';
import { McpHttpConnector } from './McpHttpConnector';
import { CredentialVault } from '../vault/CredentialVault';

const dir = path.join(os.tmpdir(), `umbra-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const freshDir = () => path.join(dir, Math.random().toString(36).slice(2, 10));

describe('MCP Registry + Router', () => {
  it('registers and resolves tool bindings', () => {
    const registry = new McpRegistry();
    registry.register('web-research', 'search', { endpoint: 'https://example.invalid/rpc' });
    const binding = registry.resolve('web-research', 'search');
    expect(binding?.transport).toBe('http');
    expect(binding?.key).toBe('web-research.search');
  });

  it('routes prompt-based tools without an endpoint', async () => {
    const registry = new McpRegistry();
    registry.register('notes', 'capture');
    const router = new McpRouter(registry);
    const result = await router.call('notes', 'capture', { text: 'hello' });
    expect(result.ok).toBe(true);
    expect(result.transport).toBe('prompt');
  });

  it('routes native tools to registered handlers', async () => {
    const registry = new McpRegistry();
    registry.register('math', 'double', { transport: 'native' });
    const router = new McpRouter(registry, {
      nativeHandlers: new Map([['math.double', input => (Number(input.value) || 0) * 2]]),
    });
    const result = await router.call('math', 'double', { value: 21 });
    expect(result.ok).toBe(true);
    expect(result.output).toBe(42);
  });

  it('returns an error result for unknown tools', async () => {
    const router = new McpRouter(new McpRegistry());
    const result = await router.call('nope', 'missing', {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown tool/);
  });
});

describe('McpHttpConnector + CredentialVault', () => {
  it('injects vault credentials via a test endpoint', async () => {
    const vault = new CredentialVault({ dataDir: freshDir(), hwid: 'test-hwid' });
    vault.unlock();
    vault.set({ service: 'telnyx', username: 'u', secret: 's3cret' });

    const server = require('http').createServer((req: any, res: any) => {
      let body = '';
      req.on('data', (c: any) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ auth: req.headers['authorization'], payload: JSON.parse(body) }));
      });
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const registry = new McpRegistry();
      registry.register('telco', 'send-sms', { endpoint: `http://127.0.0.1:${port}/rpc`, credentialService: 'telnyx' });
      const connector = new McpHttpConnector({ vault });
      const router = new McpRouter(registry, { connector });
      const result = await router.call('telco', 'send-sms', { to: '+1555' });
      expect(result.ok).toBe(true);
      const payload = result.output as any;
      expect(payload.auth).toBe('Basic ' + Buffer.from('u:s3cret').toString('base64'));
      expect(payload.payload.tool).toBe('send-sms');
    } finally {
      server.close();
    }
  });

  it('calls without credentials when none are needed', async () => {
    const vault = new CredentialVault({ dataDir: freshDir(), hwid: 'h' });
    vault.unlock();
    const registry = new McpRegistry();
    registry.register('meta', 'ping', { endpoint: 'https://example.invalid/ping' });
    const connector = new McpHttpConnector({ vault });
    const router = new McpRouter(registry, { connector });
    const result = await router.call('meta', 'ping', {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/500|fetch|abort|ENOTFOUND|EAI_AGAIN|returned/i);
  });
});

