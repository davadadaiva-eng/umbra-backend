/**
 * HermesAgentBridge — delegates agent tasks to Hermes Agent by Nous Research.
 *
 * Uses the documented one-shot CLI mode: `hermes -z "<prompt>"` returns only the
 * agent's final response text on stdout (no banner, no session lines), which
 * makes it safe for programmatic callers. Windows-native installs live under
 * %LOCALAPPDATA%\hermes; the binary is auto-detected unless overridden.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import { getLogger } from '../Logger';

export interface HermesTaskOptions {
  provider?: string;
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
}

export interface HermesTaskResult {
  ok: boolean;
  output: string;
  exitCode: number;
  durationMs: number;
  timedOut?: boolean;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 300_000;

export class HermesAgentBridge {
  private bin: string;
  private timeoutMs: number;

  constructor(options: { bin?: string; timeoutMs?: number } = {}) {
    this.bin = options.bin || this.detectBin();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Auto-detect the hermes CLI binary across supported Windows layouts. */
  detectBin(): string {
    const candidates = [
      process.env['HERMES_BIN'],
      process.env['LOCALAPPDATA'] ? `${process.env['LOCALAPPDATA']}\\hermes\\bin\\hermes.exe` : undefined,
      process.env['USERPROFILE'] ? `${process.env['USERPROFILE']}\\.hermes\\venv\\Scripts\\hermes.exe` : undefined,
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
    return 'hermes';
  }

  isInstalled(): boolean {
    if (this.bin !== 'hermes') {
      return fs.existsSync(this.bin);
    }
    return process.env['HERMES_BIN'] !== undefined || this.hasOnPath('hermes');
  }

  private hasOnPath(bin: string): boolean {
    const pathDirs = (process.env['PATH'] || '').split(';').filter(Boolean);
    return pathDirs.some(dir => {
      try {
        return (
          fs.existsSync(`${dir}\\${bin}.exe`) ||
          fs.existsSync(`${dir}\\${bin}.cmd`) ||
          fs.existsSync(`${dir}\\${bin}.bat`)
        );
      } catch {
        return false;
      }
    });
  }

  /** Run a single agent task headlessly and return only the final response. */
  async runTask(prompt: string, options: HermesTaskOptions = {}): Promise<HermesTaskResult> {
    if (!this.isInstalled()) {
      return { ok: false, output: '', exitCode: -1, durationMs: 0, error: 'Hermes not installed' };
    }
    const started = Date.now();
    const args = ['-z', prompt];
    if (options.provider) args.push('--provider', options.provider);
    if (options.model) {
      args.push('-m', options.model);
    } else if (options.maxTurns) {
      args.push('--max-turns', String(options.maxTurns));
    }

    return new Promise<HermesTaskResult>(resolve => {
      const timeoutMs = options.timeoutMs ?? this.timeoutMs;
      let child;
      try {
        child = spawn(this.bin, args, { windowsHide: true, shell: process.platform === 'win32' });
      } catch (err) {
        resolve({ ok: false, output: '', exitCode: -1, durationMs: Date.now() - started, error: String(err) });
        return;
      }

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        resolve({
          ok: false,
          output: stdout.trim(),
          exitCode: -1,
          durationMs: Date.now() - started,
          timedOut: true,
          error: `Hermes task timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
      }, timeoutMs);

      child.stdout.on('data', d => (stdout += d.toString()));
      child.stderr.on('data', d => (stderr += d.toString()));
      child.on('error', err => {
        clearTimeout(timer);
        getLogger().warn({ err }, 'Hermes spawn failed');
        resolve({ ok: false, output: stdout.trim(), exitCode: -1, durationMs: Date.now() - started, error: String(err) });
      });
      child.on('close', code => {
        clearTimeout(timer);
        const output = stdout.trim();
        const dirty = stderr.trim();
        if (code === 0) {
          resolve({ ok: true, output, exitCode: code, durationMs: Date.now() - started });
        } else {
          resolve({
            ok: false,
            output,
            exitCode: code ?? -1,
            durationMs: Date.now() - started,
            error: dirty.split('\n').pop() || `exit ${code}`,
          });
        }
      });
    });
  }
}