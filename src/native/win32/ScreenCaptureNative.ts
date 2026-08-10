import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CaptureFrame {
  data: Buffer;
  width: number;
  height: number;
  stride: number;
  timestamp: number;
  format: 'bgra32' | 'nv12' | 'png';
}

export interface ScreenPng {
  buffer: Buffer;
  width: number;
  height: number;
  capturedAt: number;
}

const PS_CAPTURE_SCRIPT_V2 = `Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $screen.Size)
$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $ms.ToArray()
$graphics.Dispose()
$bitmap.Dispose()
$ms.Dispose()
Write-Output ("SIZE|" + $screen.Width + "|" + $screen.Height)
[System.Convert]::ToBase64String($bytes)`;

/** Capture the whole primary display as a PNG; returns buffer + real pixel
 *  dimensions (DPI-agreed with SetCursorPos through the same non-DPI-aware
 *  PowerShell coordinate space). */
export async function captureScreenPng(): Promise<ScreenPng | null> {
  const output = runPS(PS_CAPTURE_SCRIPT_V2);
  if (!output) return null;
  const lines = output.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sizeLine = lines.find(l => l.startsWith('SIZE|'));
  const b64Line = lines.filter(l => l.length > 100).pop();
  if (!b64Line) return null;
  let width = 1920;
  let height = 1080;
  if (sizeLine) {
    const parts = sizeLine.split('|');
    width = parseInt(parts[1], 10) || width;
    height = parseInt(parts[2], 10) || height;
  }
  return { buffer: Buffer.from(b64Line, 'base64'), width, height, capturedAt: Date.now() };
}

const PS_CAPTURE_SCRIPT = `Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $screen.Size)
$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $ms.ToArray()
$graphics.Dispose()
$bitmap.Dispose()
$ms.Dispose()
[System.Convert]::ToBase64String($bytes)`;

// Captures a specific window (by process name or title) even when it lives on
// another Windows virtual desktop or is not the foreground window.
const PS_WINDOW_CAPTURE_SCRIPT = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = @'
using System;
using System.Runtime.InteropServices;
namespace Win32 {
  public class CapW {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
  }
}
'@
Add-Type -TypeDefinition $src
function Get-TargetWindow($name) {
  $h = [Win32.CapW]::FindWindow($null, $name)
  if ($h -eq [IntPtr]::Zero) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      if ($p.MainWindowHandle -ne [IntPtr]::Zero) { $h = $p.MainWindowHandle; break }
    }
  }
  return $h
}
$h = Get-TargetWindow $args[0]
if ($h -eq [IntPtr]::Zero) { exit 2 }
$r = New-Object 'Win32.CapW+RECT'
[Win32.CapW]::GetWindowRect($h, [ref]$r) | Out-Null
$w = [Math]::Max(1, $r.R - $r.L)
$hh = [Math]::Max(1, $r.B - $r.T)
$bmp = New-Object System.Drawing.Bitmap $w, $hh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
try {
  [Win32.CapW]::PrintWindow($h, $hdc, 2) | Out-Null
} finally {
  $g.ReleaseHdc($hdc)
}
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $ms.ToArray()
$g.Dispose()
$bmp.Dispose()
$ms.Dispose()
[System.Convert]::ToBase64String($bytes)`;

let lastCapture: { data: Buffer; width: number; height: number } | null = null;

function ensureCacheDir(): string {
  const dir = path.join(process.env['USERPROFILE'] || 'C:\\Users\\default', '.umbra', 'tmp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runPS(script: string, scriptArgs: string[] = []): string | null {
  try {
    const tmpDir = ensureCacheDir();
    const psFile = path.join(tmpDir, `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
    fs.writeFileSync(psFile, script, 'utf-8');
    try {
      const quoted = scriptArgs.map(a => `"${a.replace(/"/g, '`"')}"`).join(' ');
      const output = execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}" ${quoted}`,
        { timeout: 15000, encoding: 'utf-8', windowsHide: true, maxBuffer: 15 * 1024 * 1024 },
      ).trim();
      return output;
    } finally {
      try { fs.unlinkSync(psFile); } catch { }
    }
  } catch {
    return null;
  }
}

export async function captureWindowPng(windowMatch: string): Promise<Buffer | null> {
  const output = runPS(PS_WINDOW_CAPTURE_SCRIPT, [windowMatch]);
  if (!output) return null;
  const lines = output.split('\n');
  const lastLine = lines.filter((l: string) => l.length > 100).pop();
  if (!lastLine) return null;
  return Buffer.from(lastLine.trim(), 'base64');
}

function runPSCapture(): Buffer | null {
  const output = runPS(PS_CAPTURE_SCRIPT);
  if (!output) return null;
  const lastLine = output.split('\n').filter((l: string) => l.trim().length > 100).pop();
  if (!lastLine) return null;
  return Buffer.from(lastLine.trim(), 'base64');
}

export async function captureDisplay(displayId: number): Promise<CaptureFrame | null> {
  void displayId;
  const pngBuffer = runPSCapture();
  if (!pngBuffer) {
    if (lastCapture) {
      return {
        data: lastCapture.data,
        width: lastCapture.width, height: lastCapture.height,
        stride: lastCapture.width * 4,
        timestamp: Date.now(), format: 'png',
      };
    }
    return null;
  }

  const width = 1920;
  const height = 1080;
  lastCapture = { data: pngBuffer, width, height };

  return {
    data: pngBuffer,
    width, height,
    stride: width * 4,
    timestamp: Date.now(),
    format: 'png',
  };
}

export async function captureRegion(
  displayId: number,
  _x: number, _y: number, _width: number, _height: number,
): Promise<CaptureFrame | null> {
  const full = await captureDisplay(displayId);
  if (!full) return null;
  return full;
}

export async function getDisplayList(): Promise<{ id: number; name: string; width: number; height: number; isVirtual: boolean }[]> {
  return [
    { id: 0, name: 'Primary Display', width: 1920, height: 1080, isVirtual: false },
  ];
}

export function frameToJPEG(frame: CaptureFrame, _quality: number = 80): Buffer {
  if (frame.format === 'png') {
    return frame.data;
  }
  return frame.data;
}

export function frameToBase64(frame: CaptureFrame): string {
  return frame.data.toString('base64');
}
