import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HermesAgentBridge } from './HermesAgent';

describe('HermesAgentBridge', () => {
  let fakeBin: string;

  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbra-hermes-'));
    fakeBin = path.join(dir, 'fake-hermes.cmd');
    fs.writeFileSync(
      fakeBin,
      `@echo off\r\nif "%1"=="-z" (\r\n  echo FAKE_HERMES_OUTPUT: %2\r\n  exit /b 0\r\n)\r\nexit /b 1\r\n`,
      'utf-8',
    );
  });

  it('reports not installed when no binary is present', () => {
    const bridge = new HermesAgentBridge({ bin: 'definitely-not-a-real-hermes-bin' });
    expect(bridge.isInstalled()).toBe(false);
  });

  it('runs a headless one-shot task through the configured binary', async () => {
    const bridge = new HermesAgentBridge({ bin: fakeBin, timeoutMs: 30_000 });
    expect(bridge.isInstalled()).toBe(true);
    const res = await bridge.runTask('do the thing');
    expect(res.ok).toBe(true);
    expect(res.output).toContain('FAKE_HERMES_OUTPUT');
    expect(res.exitCode).toBe(0);
  });

  it('surfaces a nonzero exit as failure', async () => {
    const failing = path.join(path.dirname(fakeBin), 'fail-hermes.cmd');
    fs.writeFileSync(failing, '@echo off\r\necho boom >&2\r\nexit /b 3\r\n', 'utf-8');
    const bridge = new HermesAgentBridge({ bin: failing, timeoutMs: 30_000 });
    const res = await bridge.runTask('x');
    expect(res.ok).toBe(false);
    expect(res.exitCode).toBe(3);
    expect(res.error).toBeDefined();
  });

  it('times out slow tasks', async () => {
    const slow = path.join(path.dirname(fakeBin), 'slow-hermes.cmd');
    fs.writeFileSync(slow, '@echo off\r\nping -n 6 127.0.0.1 >nul\r\nexit /b 0\r\n', 'utf-8');
    const bridge = new HermesAgentBridge({ bin: slow, timeoutMs: 10 });
    const res = await bridge.runTask('slow');
    expect(res.timedOut).toBe(true);
    expect(res.ok).toBe(false);
  });
});