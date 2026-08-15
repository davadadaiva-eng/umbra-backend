import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface WindowInfo {
  appName: string;
  windowTitle: string;
  url?: string;
  filePath?: string;
}

let cachedInfo: WindowInfo = { appName: 'desktop', windowTitle: '' };

const PS_SCRIPT = `$sig = @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
'@
$null = Add-Type -MemberDefinition $sig -Name "Win32API" -Namespace Win32 -PassThru
$hwnd = [Win32.Win32API]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { exit }
$sb = New-Object System.Text.StringBuilder 256
[Win32.Win32API]::GetWindowText($hwnd, $sb, 256) | Out-Null
$procId = 0
[Win32.Win32API]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "" }
$title = $sb.ToString()
Write-Output ($name + "|" + $title)`;

export interface CursorPos {
  x: number;
  y: number;
}

const PS_CURSOR_SCRIPT = `$sig = @'
[DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
public struct POINT { public int X; public int Y; }
'@
$null = Add-Type -MemberDefinition $sig -Name "CursorAPI" -Namespace Win32 -PassThru
$p = New-Object Win32.CursorAPI+POINT
if ([Win32.CursorAPI]::GetCursorPos([ref]$p)) {
  Write-Output ($p.X + "|" + $p.Y)
} else {
  Write-Output "-1|-1"
}`;

/**
 * Current mouse cursor position in screen coordinates (used by screen
 * awareness so Umbra knows exactly what you're pointing at).
 */
export function getCursorPos(): CursorPos {
  try {
    const tmpDir = (() => {
      const d = path.join(process.env['USERPROFILE'] || 'C:\\Users\\default', '.umbra', 'tmp');
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      return d;
    })();
    const psFile = path.join(tmpDir, 'get-cursor.ps1');
    fs.writeFileSync(psFile, PS_CURSOR_SCRIPT, 'utf-8');

    const output = execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: 3000, encoding: 'utf-8', windowsHide: true, maxBuffer: 4096 },
    ).trim();

    const parts = output.split('|');
    if (parts.length === 2) {
      const x = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      if (!isNaN(x) && !isNaN(y)) return { x, y };
    }
  } catch {}
  return { x: 0, y: 0 };
}

export function getForegroundWindowInfo(): WindowInfo {
  try {
    const tmpDir = (() => {
      const d = path.join(process.env['USERPROFILE'] || 'C:\\Users\\default', '.umbra', 'tmp');
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      return d;
    })();
    const psFile = path.join(tmpDir, 'get-foreground.ps1');
    fs.writeFileSync(psFile, PS_SCRIPT, 'utf-8');

    const output = execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: 3000, encoding: 'utf-8', windowsHide: true, maxBuffer: 4096 },
    ).trim();

    if (output) {
      const parts = output.split('|');
      if (parts.length >= 2) {
        const appName = (parts[0] || 'unknown') + '.exe';
        const windowTitle = parts.slice(1).join('|');
        let url: string | undefined;
        const base = appName.toLowerCase().replace('.exe', '');
        if (['chrome', 'msedge', 'firefox', 'brave', 'opera'].includes(base)) {
          url = 'https://browser-page';
        }
        cachedInfo = { appName, windowTitle, url };
      }
    }
  } catch {}
  return cachedInfo;
}
