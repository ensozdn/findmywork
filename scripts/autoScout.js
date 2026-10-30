import { scanLinkedInJobs } from '../modules/linkedInScout.js';
import { isChromeDebuggingOpen } from '../modules/chromeLauncher.js';

const roles = ['Full Stack', 'NestJS', 'Backend Engineer'];
const intervalMs = 2 * 60 * 60 * 1000;

async function runBatch() {
  const isReady = await isChromeDebuggingOpen();
  if (!isReady) {
    console.log('[WARN] Chrome aktif degil. Tarama atlandi.');
    return;
  }

  for (const role of roles) {
    try {
      console.log(`[DAEMON] Tarama baslatiliyor: ${role}`);
      await scanLinkedInJobs({
        keyword: role,
        maxJobs: 10,
        remoteOnly: false
      });
    } catch (err) {
      console.error(`[DAEMON ERROR] ${role} taramasinda hata: ${err.message}`);
    }
  }

  console.log('[DAEMON] Tum roller tarandi. Sonraki dongu bekleniyor.');
}

console.log('[DAEMON] Arka plan tarayici baslatildi.');
runBatch();
setInterval(runBatch, intervalMs);
