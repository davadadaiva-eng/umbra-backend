import { ApiServer } from './ApiServer';

const PORT = 20000 + Math.floor(Math.random() * 10000);

function makeDeps() {
  return {
    getStatus: async () => ({ initialized: true, uptimeMs: 1 }),
    submitTask: async (description: string) => `task-${description.length}`,
    getTask: (id: string) => (id === 'missing' ? undefined : { id, status: 'completed' }),
    getActiveTasks: () => [{ id: 'a1', status: 'executing' }],
    executeDesktop2: async (action: string, params: Record<string, unknown>) => `did ${action} ${JSON.stringify(params)}`,
    requestConsent: async () => 'granted',
    getConsentState: () => ({ granted: true, denied: false, askOncePerSession: true }),
    isEmergencyStopArmed: () => false,
    armEmergencyStop: () => undefined,
    disarmEmergencyStop: () => undefined,
    searchKnowledge: async (q: string) => [{ id: 'n1', title: q }],
    getMacros: async () => [],
    getSessions: async () => [],
    getPrivacyStats: async () => ({ masked: 0 }),
    getActivitySummary: async () => ({}),
    getSwarmStatus: async () => ({}),
    getAuditStats: async () => ({}),
    getRepos: async () => [{ name: 'demo', path: 'C:\\demo', exists: true, isGit: true, branch: 'main', lastCommit: 'a1b2c3 init', dirty: 0 }],
    getMcpCatalog: async (opts?: Record<string, unknown>) => ({ count: 2, active: 0, entries: [], total: 2, categories: ['Developer'], ...opts }),
    connectMcp: async (id: string, opts: { baseUrl?: string; apiKey?: string; enabled?: boolean }) => ({ id, ...opts }),
    disconnectMcp: async (id: string) => ({ id, enabled: false, connected: false }),
    syncExternalConnectors: async () => ({ registered: 3, sources: ['smithery'], errors: [] }),
    getMeshStatus: async () => ({ running: true, paired_devices: 1 }),
    meshPair: async (ttl = 120) => ({ deviceId: 'mesh-1', exp: Date.now() + ttl * 1000 }),
    meshPairDemo: async () => ({ ok: true, match: true }),
    meshRevoke: async (deviceId: string) => ({ ok: true, deviceId }),
    getPlanUsage: async () => ({
      plan: 'pro',
      planName: 'Pro',
      monthlyPriceUsd: 19,
      budget: { monthlyBudgetUsd: 5, spentUsd: 0.5, remainingUsd: 4.5, slotBudgets: { fast: 1 }, spentBySlot: { fast: 0.2 } },
      metering: { tokensUsed: 1000, tokensLimit: 10000000 },
    }),
    getModelStatus: async () => ({
      provider: 'ollama',
      plan: 'pro',
      monthlyPriceUsd: 19,
      budget: { monthlyBudgetUsd: 5, spentUsd: 0.5, remainingUsd: 4.5, slotBudgets: { fast: 1, reasoning: 1, frontend: 1, difficult: 2 }, spentBySlot: { fast: 0.2, reasoning: 0.2, frontend: 0, difficult: 0.1 } },
      routing: { enabled: true, optimizations: { promptCaching: true, cacheHitRatio: 0.85, graphify: true, caveman: true }, maxOutputTokens: 800, tiers: {} },
      plans: [{ tier: 'pro', name: 'Pro', priceUsd: 19, budgetUsd: 5 }],
    }),
    testLlm: async () => ({ ok: true, model: 'test-fast', tokens: 30, latencyMs: 5 }),
    configureProvider: async (patch: Record<string, unknown>) => ({ applied: patch }),
    activatePlan: async (tier: string) => ({ plan: tier, budget: { monthlyBudgetUsd: 5, slotBudgets: { fast: 1, reasoning: 1, frontend: 1, difficult: 2 } } }),
    getProviderConfig: async () => ({ provider: 'openai', keys: { openai: '••••abcd' } }),
    listOpenMontageTools: async () => ({ installed: true, count: 2, tools: [{ name: 'video_compose' }, { name: 'piper_tts' }] }),
    generateImage: async (prompt: string) => ({ imagePath: `/tmp/${prompt.toLowerCase().replace(/\s+/g, '-')}.png`, provider: 'huggingface', model: 'FLUX.1-schnell' }),
    recallMemory: async (query: string) => ({ query, facts: [{ text: 'user prefers dark mode' }], similar: [{ text: 'built the routing engine', distance: 0.1 }], recent: [{ description: 'routing', status: 'completed' }] }),
    rememberMemory: async (text: string) => ({ id: 1, remembered: text, total: 1 }),
    listAudioDevices: async () => ({ available: true, devices: [{ id: '{x}.{y}', name: 'CABLE Input', flow: 'render', isDefault: false }] }),
    setAudioDefault: async (opts: { flow?: string; deviceId?: string }) => ({ result: `set ${opts?.flow ?? 'render'} ${opts?.deviceId}` }),
    delegateHermes: async (description: string, opts?: { provider?: string; model?: string; timeoutMs?: number }) => ({ description, ...opts }),
    generateJournalNow: async () => ({ ok: true }),
    voiceCommand: async (audio: string, opts?: { target?: string }) => ({ text: 'remind me to ship', dispatch: { taskId: 'task-7', target: opts?.target ?? 'desktop' } }),
    getVoiceStackHealth: async (refresh?: boolean) => ({
      ok: true,
      checkedAt: 123,
      components: [
        { component: 'stt', configured: true, ok: true, status: 'ok' },
        { component: 'tts', configured: true, ok: true, status: 'ok' },
        { component: 'asr', configured: true, ok: true, status: 'ok' },
        { component: 'cable', configured: true, ok: true, status: 'ok' },
        { component: 'loopback', configured: true, ok: true, status: 'ok' },
      ],
      refreshed: refresh === true,
    }),
    meetingMute: async (muted: boolean) => `mic ${muted ? 'muted' : 'unmuted'}`,
    meetingRaiseHand: async (raised: boolean) => `hand ${raised ? 'raised' : 'lowered'}`,
    meetingChat: async (message: string) => `sent: ${message}`,
    transcribeAudio: async (_audio: string) => ({ text: 'hello world', language: 'en' }),
    mcpHandle: async (message: Record<string, unknown>) => {
      if (message.method === 'initialize') {
        return { jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'umbra', version: '0.1.0' } } };
      }
      if (message.method === 'tools/list') {
        return { jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'communication-slack.invoke', description: 'Connector tool', inputSchema: { type: 'object', properties: {} } }] } };
      }
      if (message.method === 'tools/call') {
        return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'sent' }], isError: false } };
      }
      return null;
    },
  };
}

async function api(path2: string, method = 'GET', body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path2}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json()) as any };
}

describe('ApiServer', () => {
  let server: ApiServer;

  beforeAll(() => {
    server = new ApiServer(makeDeps() as any, PORT);
    server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  test('health', async () => {
    const res = await api('/api/health');
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
  });

  test('status', async () => {
    const res = await api('/api/status');
    expect(res.status).toBe(200);
    expect(res.json.initialized).toBe(true);
  });

  test('consent get', async () => {
    const res = await api('/api/consent');
    expect(res.status).toBe(200);
    expect(res.json.emergencyStopArmed).toBe(false);
  });

  test('consent request', async () => {
    const res = await api('/api/consent', 'POST', { action: 'request', reason: 'test' });
    expect(res.status).toBe(200);
    expect(res.json.result).toBe('granted');
  });

  test('consent unknown action returns 500', async () => {
    const res = await api('/api/consent', 'POST', { action: 'nope' });
    expect(res.status).toBe(500);
  });

  test('task submit and fetch', async () => {
    const created = await api('/api/task', 'POST', { description: 'hello' });
    expect(created.status).toBe(200);
    expect(created.json.taskId).toBe('task-5');

    const fetched = await api('/api/task/task-5');
    expect(fetched.json.task.status).toBe('completed');
  });

  test('task missing returns 500', async () => {
    const res = await api('/api/task/missing');
    expect(res.status).toBe(500);
  });

  test('task requires description', async () => {
    const res = await api('/api/task', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('desktop2 action', async () => {
    const res = await api('/api/desktop2/action', 'POST', { action: 'navigate', params: { url: 'x' } });
    expect(res.status).toBe(200);
    expect(res.json.result).toContain('navigate');
  });

  test('repos list', async () => {
    const res = await api('/api/repos');
    expect(res.status).toBe(200);
    expect(res.json.repos).toHaveLength(1);
    expect(res.json.repos[0].branch).toBe('main');
  });

  test('audio devices list', async () => {
    const res = await api('/api/audio/devices');
    expect(res.status).toBe(200);
    expect(res.json.audio.available).toBe(true);
    expect(res.json.audio.devices[0].name).toBe('CABLE Input');
  });

  test('audio set-default requires deviceId', async () => {
    const res = await api('/api/audio/set-default', 'POST', { flow: 'render' });
    expect(res.status).toBe(500);
  });

  test('audio set-default', async () => {
    const res = await api('/api/audio/set-default', 'POST', { flow: 'capture', deviceId: '{x}.{out}' });
    expect(res.status).toBe(200);
    expect(res.json.result).toBe('set capture {x}.{out}');
  });

  test('mcp catalog', async () => {
    const res = await api('/api/mcp/catalog');
    expect(res.status).toBe(200);
    expect(res.json.catalog.count).toBe(2);
    expect(res.json.catalog.active).toBe(0);
  });

  test('mcp connect requires id', async () => {
    const res = await api('/api/mcp/connect', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('mcp connect applies options', async () => {
    const res = await api('/api/mcp/connect', 'POST', { id: 'stripe', baseUrl: 'https://x', enabled: true });
    expect(res.status).toBe(200);
    expect(res.json.connector.id).toBe('stripe');
    expect(res.json.connector.enabled).toBe(true);
  });

  test('mcp sync invokes external registry sync', async () => {
    const res = await api('/api/mcp/sync', 'POST', { maxPerSource: 5 });
    expect(res.status).toBe(200);
    expect(res.json.sync.registered).toBe(3);
    expect(res.json.sync.sources).toContain('smithery');
  });

  test('llm models returns budget + routing status', async () => {
    const res = await api('/api/llm/models');
    expect(res.status).toBe(200);
    expect(res.json.plan).toBe('pro');
    expect(res.json.monthlyPriceUsd).toBe(19);
    expect(res.json.budget.monthlyBudgetUsd).toBe(5);
    expect(res.json.budget.slotBudgets.difficult).toBe(2);
    expect(res.json.budget.slotBudgets.fast).toBe(1);
    expect(res.json.routing.optimizations.cacheHitRatio).toBe(0.85);
    expect(res.json.routing.optimizations.graphify).toBe(true);
    expect(res.json.routing.maxOutputTokens).toBe(800);
  });

  test('llm test runs a live validation call', async () => {
    const res = await api('/api/llm/test', 'POST');
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.model).toBe('test-fast');
  });

  test('provider config get masks keys', async () => {
    const res = await api('/api/config/provider');
    expect(res.status).toBe(200);
    expect(res.json.keys.openai).toBe('••••abcd');
  });

  test('provider config set applies patch', async () => {
    const res = await api('/api/config/provider', 'POST', { provider: 'openai', apiKey: 'sk-123', tier: 'pro' });
    expect(res.status).toBe(200);
    expect(res.json.applied.provider).toBe('openai');
    expect(res.json.applied.apiKey).toBe('sk-123');
  });

  test('plan activate assigns the token budget after payment', async () => {
    const res = await api('/api/plan/activate', 'POST', { tier: 'pro' });
    expect(res.status).toBe(200);
    expect(res.json.plan).toBe('pro');
    expect(res.json.budget.monthlyBudgetUsd).toBe(5);
    expect(res.json.budget.slotBudgets.difficult).toBe(2);
  });

  test('plan activate requires a tier', async () => {
    const res = await api('/api/plan/activate', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('openmontage tools lists the registry', async () => {
    const res = await api('/api/openmontage/tools');
    expect(res.status).toBe(200);
    expect(res.json.openmontage.installed).toBe(true);
    expect(res.json.openmontage.count).toBe(2);
  });

  test('image generate dispatches Flux Schnell', async () => {
    const res = await api('/api/image/generate', 'POST', { prompt: 'a neon fox', width: 1024, height: 1024 });
    expect(res.status).toBe(200);
    expect(res.json.image.model).toBe('FLUX.1-schnell');
    expect(res.json.image.imagePath).toContain('a-neon-fox');
  });

  test('image generate requires a prompt', async () => {
    const res = await api('/api/image/generate', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('memory recall returns past sessions + user facts', async () => {
    const res = await api('/api/memory/recall?q=routing');
    expect(res.status).toBe(200);
    expect(res.json.facts[0].text).toBe('user prefers dark mode');
    expect(res.json.similar[0].text).toBe('built the routing engine');
    expect(res.json.recent[0].status).toBe('completed');
  });

  test('memory remember stores a permanent user fact', async () => {
    const res = await api('/api/memory/remember', 'POST', { text: 'my name is Alex' });
    expect(res.status).toBe(200);
    expect(res.json.remembered).toBe('my name is Alex');
    expect(res.json.total).toBe(1);
  });

  test('memory remember requires text', async () => {
    const res = await api('/api/memory/remember', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('agent delegate requires description', async () => {
    const res = await api('/api/agent/delegate', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('agent delegate hands off to hermes', async () => {
    const res = await api('/api/agent/delegate', 'POST', { description: 'Summarize the repo', model: 'openrouter:deepseek/deepseek-r1' });
    expect(res.status).toBe(200);
    expect(res.json.output.description).toBe('Summarize the repo');
    expect(res.json.output.model).toBe('openrouter:deepseek/deepseek-r1');
  });

  test('unknown route returns 404', async () => {
    const res = await api('/api/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('invalid json returns 500', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    expect(res.status).toBe(500);
  });

  test('mcp initialize handshake', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.result.protocolVersion).toBe('2025-03-26');
    expect(json.result.serverInfo.name).toBe('umbra');
  });

  test('mcp tools/list returns registered connectors', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.result.tools).toContainEqual(expect.objectContaining({ name: 'communication-slack.invoke' }));
  });

  test('mcp tools/call dispatches a connector', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'communication-slack.invoke', arguments: { channel: '#general', text: 'hi' } } }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.result.content[0].text).toBe('sent');
    expect(json.result.isError).toBe(false);
  });

  test('mcp notifications answer 202 with no body', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(res.status).toBe(202);
  });

  test('mcp catalog supports query filtering + pagination', async () => {
    const res = await api('/api/mcp/catalog?q=slack&category=Developer&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.json.catalog.q).toBe('slack');
    expect(res.json.catalog.category).toBe('Developer');
    expect(res.json.catalog.limit).toBe(10);
  });

  test('mcp connectors lists only enabled ones', async () => {
    const res = await api('/api/mcp/connectors');
    expect(res.status).toBe(200);
    expect(res.json.connectors.enabled).toBe(true);
  });

  test('mcp disconnect requires an id', async () => {
    const res = await api('/api/mcp/disconnect', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('mcp disconnect disables a connector', async () => {
    const res = await api('/api/mcp/disconnect', 'POST', { id: 'communication-slack' });
    expect(res.status).toBe(200);
    expect(res.json.connector.enabled).toBe(false);
  });

  test('mesh status reports the daemon', async () => {
    const res = await api('/api/mesh/status');
    expect(res.status).toBe(200);
    expect(res.json.running).toBe(true);
    expect(res.json.paired_devices).toBe(1);
  });

  test('mesh pair creates a pairing payload', async () => {
    const res = await api('/api/mesh/pair', 'POST', { ttl: 60 });
    expect(res.status).toBe(200);
    expect(res.json.pair.deviceId).toBe('mesh-1');
  });

  test('mesh revoke requires a deviceId', async () => {
    const res = await api('/api/mesh/revoke', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('mesh revoke removes a paired device', async () => {
    const res = await api('/api/mesh/revoke', 'POST', { deviceId: 'mesh-1' });
    expect(res.status).toBe(200);
    expect(res.json.revoked.ok).toBe(true);
  });

  test('voice command transcribes and dispatches a task', async () => {
    const res = await api('/api/voice/command', 'POST', { audio: 'QUJD', target: 'local' });
    expect(res.status).toBe(200);
    expect(res.json.command.text).toBe('remind me to ship');
    expect(res.json.command.dispatch.target).toBe('local');
  });

  test('voice command requires audio', async () => {
    const res = await api('/api/voice/command', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('meeting mute toggles the mic', async () => {
    const res = await api('/api/meeting/mute', 'POST', { muted: true });
    expect(res.status).toBe(200);
    expect(res.json.result).toBe('mic muted');
  });

  test('meeting raise-hand toggles the hand', async () => {
    const res = await api('/api/meeting/raise-hand', 'POST', { raised: true });
    expect(res.status).toBe(200);
    expect(res.json.result).toBe('hand raised');
  });

  test('meeting chat requires a message', async () => {
    const res = await api('/api/meeting/chat', 'POST', {});
    expect(res.status).toBe(500);
  });

  test('meeting chat sends a message', async () => {
    const res = await api('/api/meeting/chat', 'POST', { message: 'brb' });
    expect(res.status).toBe(200);
    expect(res.json.result).toBe('sent: brb');
  });

  test('plan usage returns the spend dashboard', async () => {
    const res = await api('/api/plan/usage');
    expect(res.status).toBe(200);
    expect(res.json.plan).toBe('pro');
    expect(res.json.budget.remainingUsd).toBe(4.5);
    expect(res.json.metering.tokensLimit).toBe(10000000);
  });

  test('voice health returns the cached stack report', async () => {
    const res = await api('/api/voice/health');
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.components).toHaveLength(5);
  });

  test('voice health refresh re-runs the probes', async () => {
    const res = await api('/api/voice/health?refresh=1');
    expect(res.status).toBe(200);
    expect(res.json.refreshed).toBe(true);
  });
});
