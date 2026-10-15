import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const exe = process.argv[2] === 'brave' ? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' : undefined;
const b = await chromium.launch({ headless: false, ...(exe ? { executablePath: exe } : { channel: 'chrome' }), args: ['--window-position=20,20', '--window-size=1500,950'] });
const page = await (await b.newContext({ viewport: null })).newPage();
await page.goto('http://localhost:5173/?perf#/tool/keychain');
await page.locator('.info-line').getByText('triángulos').waitFor({ timeout: 60000 });
await page.bringToFront();
await page.waitForTimeout(1500);
const geo = await page.evaluate(() => {
  const r = document.querySelector('.viewer-canvas').getBoundingClientRect();
  return { x: window.screenX + (window.outerWidth - window.innerWidth) / 2 + r.x + r.width / 2, y: window.screenY + (window.outerHeight - window.innerHeight) - (window.outerWidth - window.innerWidth) / 2 + r.y + r.height / 2, dpr: devicePixelRatio, sw: screen.width, sh: screen.height };
});
console.log(JSON.stringify(geo));
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (n) => { window.__frames.push(n - last); last = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public class M { [DllImport("user32.dll")] public static extern void mouse_event(int f,int dx,int dy,int d,int e); [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[M]::SetProcessDPIAware() | Out-Null
$cx=${Math.round(geo.x)}; $cy=${Math.round(geo.y)}
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($cx,$cy)
Start-Sleep -Milliseconds 300
[M]::mouse_event(2,0,0,0,0)
for($i=0;$i -lt 400;$i++){
  $x=[int]($cx + 250*[Math]::Sin($i/20)); $y=[int]($cy + 120*[Math]::Cos($i/15))
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x,$y)
  Start-Sleep -Milliseconds 4
}
[M]::mouse_event(4,0,0,0,0)
`;
await new Promise((res) => { const p = spawn('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' }); p.on('exit', res); });
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(() => {
  const f = window.__frames.slice(2).sort((a, c) => a - c);
  return { n: f.length, median: f[Math.floor(f.length / 2)].toFixed(1), p95: f[Math.floor(f.length * 0.95)].toFixed(1), p99: f[Math.floor(f.length * 0.99)].toFixed(1), max: f[f.length - 1].toFixed(1), over33: f.filter((x) => x > 33).length };
})));
console.log('HUD:', JSON.stringify(await page.locator('.viewer-perf').textContent()));
await b.close();
