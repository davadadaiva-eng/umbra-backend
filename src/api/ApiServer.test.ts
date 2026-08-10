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
    generateJournalNow: async () => ({ ok: true }),
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
});
