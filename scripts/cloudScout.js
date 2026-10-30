import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRemoteOkJobs } from '../modules/multiPlatformScout.js';
import { fetchLinkedInGuestJobs } from '../modules/linkedInGuestScout.js';
import { analyzeJob } from '../modules/jobAnalyzer.js';
import { notifyJob } from '../modules/telegramBot.js';
import { generateMarkdownReport } from '../modules/reportGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notifiedPath = path.join(__dirname, '../data/notified_jobs.json');
const jobsPath = path.join(__dirname, '../data/jobs_latest.json');

async function runCloudScout() {
  console.log('[INFO] Cloud Scout baslatildi...');

  let notifiedUrls = new Set();
  if (fs.existsSync(notifiedPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(notifiedPath, 'utf8'));
      if (Array.isArray(parsed)) {
        notifiedUrls = new Set(parsed);
      }
    } catch (e) {
      notifiedUrls = new Set();
    }
  }

  const allRawJobs = [];

  try {
    const remoteOkJobs = await fetchRemoteOkJobs();
    allRawJobs.push(...remoteOkJobs);
    console.log(`[INFO] RemoteOK taranan ilan: ${remoteOkJobs.length}`);
  } catch (e) {
    console.log('[WARN] RemoteOK tarama hatasi: ' + e.message);
  }

  const queries = [
    { kw: 'Full Stack', loc: 'Turkey' },
    { kw: 'Node.js', loc: 'Turkey' },
    { kw: 'Full Stack', loc: 'Worldwide' }
  ];

  for (const q of queries) {
    try {
      const guestJobs = await fetchLinkedInGuestJobs(q.kw, q.loc);
      allRawJobs.push(...guestJobs);
      console.log(`[INFO] LinkedIn Guest (${q.kw} - ${q.loc}) taranan: ${guestJobs.length}`);
    } catch (e) {
      console.log(`[WARN] LinkedIn Guest (${q.kw}) tarama hatasi: ${e.message}`);
    }
  }

  const seenUrls = new Set();
  const uniqueJobs = [];

  for (const j of allRawJobs) {
    if (!j.url || seenUrls.has(j.url)) continue;
    seenUrls.add(j.url);
    const analysis = j.analysis || analyzeJob(j);
    uniqueJobs.push({
      ...j,
      analysis
    });
  }

  uniqueJobs.sort((a, b) => b.analysis.score - a.analysis.score);

  let notifiedCount = 0;
  const minScore = 45;

  for (let i = 0; i < uniqueJobs.length; i++) {
    const job = uniqueJobs[i];
    if (job.analysis.score >= minScore && !notifiedUrls.has(job.url)) {
      try {
        await notifyJob(job, i);
        notifiedUrls.add(job.url);
        notifiedCount++;
        console.log(`[SUCCESS] Telegram bildirimi iletildi: ${job.company} - ${job.title} (%${job.analysis.score})`);
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.log('[WARN] Telegram bildirim hatasi: ' + err.message);
      }
    }
  }

  fs.writeFileSync(notifiedPath, JSON.stringify(Array.from(notifiedUrls), null, 2), 'utf8');

  let existingJobs = [];
  if (fs.existsSync(jobsPath)) {
    try {
      existingJobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    } catch (e) {
      existingJobs = [];
    }
  }

  const existingMap = new Map(existingJobs.map(j => [j.url, j]));
  for (const j of uniqueJobs) {
    if (!existingMap.has(j.url)) {
      existingJobs.push(j);
    }
  }

  existingJobs.sort((a, b) => b.analysis.score - a.analysis.score);
  fs.writeFileSync(jobsPath, JSON.stringify(existingJobs, null, 2), 'utf8');
  generateMarkdownReport();

  console.log(`[INFO] Cloud Scout tamamlandi. Toplam tekil ilan: ${uniqueJobs.length}, Yeni iletilen bildirim: ${notifiedCount}`);
}

runCloudScout().catch(err => {
  console.log('[ERROR] Cloud Scout basarisiz: ' + err.message);
  process.exit(1);
});

