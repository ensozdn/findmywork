import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeJob } from './jobAnalyzer.js';
import { generateMarkdownReport } from './reportGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '../data/jobs_latest.json');

export async function fetchRemoteOkJobs(tags = ['javascript', 'typescript', 'react', 'node', 'full-stack']) {
  console.log(`[INFO] RemoteOK API uzerinden global remote ilanlar taranıyor...`);

  return new Promise((resolve) => {
    const url = 'https://remoteok.com/api';
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`[WARN] RemoteOK API yanit vermedi: ${res.statusCode}`);
        resolve([]);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const raw = JSON.parse(data);
          const items = raw.filter(item => item.position && item.company);

          const matchedJobs = [];
          for (const item of items) {
            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            const hasTag = tags.some(t => itemTags.includes(t.toLowerCase()) || (item.position || '').toLowerCase().includes(t.toLowerCase()));

            if (hasTag) {
              const jobData = {
                title: item.position,
                company: item.company,
                meta: `${item.location || 'Worldwide Remote'} · RemoteOK`,
                description: item.description || '',
                isEasyApply: false,
                hiringManagerName: null,
                url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
                platform: 'RemoteOK'
              };

              const analysis = analyzeJob(jobData);
              if (analysis.score >= 45) {
                matchedJobs.push({
                  ...jobData,
                  analysis
                });
                console.log(`[STATUS] [%${analysis.score}] ${jobData.title} @ ${jobData.company} [RemoteOK]`);
              }
            }
          }

          resolve(matchedJobs);
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
  });
}

export async function syncAllPlatforms() {
  const remoteJobs = await fetchRemoteOkJobs();
  let existingJobs = [];

  if (fs.existsSync(outputPath)) {
    try {
      existingJobs = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (e) {
      existingJobs = [];
    }
  }

  const existingUrls = new Set(existingJobs.map(j => j.url));
  const newJobs = remoteJobs.filter(rj => !existingUrls.has(rj.url));

  const merged = [...existingJobs, ...newJobs];
  merged.sort((a, b) => b.analysis.score - a.analysis.score);

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  generateMarkdownReport();

  console.log(`[SUCCESS] ${newJobs.length} yeni global remote ilan eklendi. Toplam liste: ${merged.length}`);
  return merged;
}

