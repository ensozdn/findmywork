import { exec } from 'child_process';
import http from 'http';

/**
 * Checks if Chrome is currently reachable on the remote debugging port.
 */
export function isChromeDebuggingOpen(port = 9222) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Explains how to start Chrome with debugging port or starts an instance.
 */
export async function ensureChromeReady(port = 9222) {
  const isOpen = await isChromeDebuggingOpen(port);
  if (isOpen) {
    return { ok: true, message: `Chrome zaten ${port} portunda aktif.` };
  }

  const launchCmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=${port} --no-first-run --no-default-browser-check &`;
  
  return {
    ok: false,
    message: `Chrome henüz remote debugging modunda açık değil.`,
    hint: `Şu komutla kendi Chrome'unu debug modunda açabilirsin:\n${launchCmd}`,
    command: launchCmd
  };
}

