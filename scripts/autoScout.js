import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanLinkedInJobs } from '../modules/linkedInScout.js';
import { isChromeDebuggingOpen } from '../modules/chromeLauncher.js';
import { notifyJob, startTelegramListener } from '../modules/telegramBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notifiedPath = path.join(__dirname, '../data/notified_jobs.json');
const jobsPath = path.join(__dirname, '../data/jobs_latest.json');

const roles = ['Full Stack', 'NestJS', 'Backend Engineer'];
const intervalMs = 2 * 60 * 60 * 1000;

function loadNotifiedSet() {
  if (!fs.existsSync(notifiedPath)) return new Set();
  try {
    const list = JSON.parse(fs.readFileSync(notifiedPath, 'utf8'));
    return new Set(list);
  } catch (e) {
    return new Set();
  }
}

function saveNotifiedSet(set) {
  fs.writeFileSync(notifiedPath, JSON.stringify(Array.from(set), null, 2), 'utf8');
}

async function runBatch() {
  const isReady = await isChromeDebuggingOpen();
  if (!isReady) {
    console.log('[WARN] Chrome aktif degil. Tarama atlandi.');
    return;
  }

  const notifiedSet = loadNotifiedSet();

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

  if (fs.existsSync(jobsPath)) {
    const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (j.url && !notifiedSet.has(j.url)) {
        await notifyJob(j, i);
        notifiedSet.add(j.url);
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    saveNotifiedSet(notifiedSet);
  }

  console.log('[DAEMON] Tum roller tarandi ve yeni bildirimler iletildi.');
}

console.log('[DAEMON] Arka plan tarayici ve Telegram dinleyicisi baslatildi.');
startTelegramListener().catch(console.error);
runBatch();
setInterval(runBatch, intervalMs);
