/**
 * WindowsTts — Windows built-in text-to-speech (SAPI 5) via PowerShell's
 * System.Speech.Synthesis.SpeechSynthesizer. Zero dependencies, works
 * offline, and is the "Umbra speaks" path for meetings and the HUD.
 *
 * Note for meetings: SAPI plays through the default speakers. To have the
 * meeting actually hear Umbra, route that audio to the call's mic input with
 * a virtual cable (VB-Cable / Stereo Mix) — the same routing the loopback
 * recorder documents for hearing. Outside a meeting, `speak` just talks out
 * loud on the PC.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../Logger';

const PS_SPEAK = `param([string]$Text, [int]$Rate)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = $Rate
$s.Speak($Text)
$s.Dispose()
`;

export interface SpeakOptions {
  /** Speech rate: -10 (slow) .. 10 (fast); 0 is normal. */
  rate?: number;
}

export class WindowsTts {
  private tmpDir: string;

  constructor(dataDir: string) {
    this.tmpDir = path.join(dataDir, 'tmp');
  }

  /** SAPI is built into Windows — available on win32 only. */
  get available(): boolean {
    return process.platform === 'win32';
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<string> {
    if (!this.available) {
      throw new Error('Windows TTS is only available on Windows');
    }
    const t = text.trim();
    if (!t) return 'Nothing to say';

    fs.mkdirSync(this.tmpDir, { recursive: true });
    const psPath = path.join(this.tmpDir, 'tts-speak.ps1');
    fs.writeFileSync(psPath, PS_SPEAK, 'utf-8');

    // Budget ~2x the text length so long phrases don't get cut off.
    const timeoutMs = Math.max(8000, Math.min(120000, 2000 + t.length * 120));
    try {
      execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}" "${t.replace(/"/g, '`"')}" ${opts.rate ?? 0}`,
        { timeout: timeoutMs, windowsHide: true, maxBuffer: 4096 },
      );
      getLogger().info({ chars: t.length }, 'Spoke via Windows SAPI TTS');
      return 'Spoke';
    } catch (err: any) {
      const msg = (err.stderr || err.message || '').toString().slice(0, 300);
      getLogger().warn({ err: msg }, 'Windows TTS speak failed');
      throw new Error(`TTS failed: ${msg || 'unknown error'}`);
    }
  }
}
