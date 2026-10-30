import { chromium } from 'playwright-core';
import { analyzeJob } from './jobAnalyzer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function scanLinkedInJobs({
  keyword = 'React Native',
  location = 'Turkey',
  remoteOnly = true,
  past24Hours = true,
  maxJobs = 15,
  cdpEndpoint = 'http://127.0.0.1:9222'
} = {}) {
  console.log(`[INFO] Chrome oturumuna baglaniliyor: ${cdpEndpoint}`);
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpEndpoint);
  } catch (err) {
    throw new Error(
      `Chrome baglantisi kurulamadi. Port: 9222\n` +
      `Komut: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222`
    );
  }

  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  
  let page = context.pages().find(p => p.url().includes('linkedin.com'));
  if (!page) {
    page = await context.newPage();
  }

  let searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;
  if (location) searchUrl += `&location=${encodeURIComponent(location)}`;
  if (past24Hours) searchUrl += `&f_TPR=r86400`;
  if (remoteOnly) searchUrl += `&f_WT=2`;

  console.log(`[INFO] URL aciliyor: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`[INFO] Ilan listesi okunuyor...`);
  const jobElements = await page.$$('.jobs-search-results-list li[data-occludable-job-id], .scaffold-layout__list-container li');
  
  console.log(`[INFO] Toplam ${jobElements.length} ilan tespit edildi.`);

  const results = [];
  const limit = Math.min(jobElements.length, maxJobs);

  for (let i = 0; i < limit; i++) {
    try {
      const el = jobElements[i];
      await el.scrollIntoViewIfNeeded();
      await el.click();
      await page.waitForTimeout(1500);

      const jobData = await page.evaluate(() => {
        const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title');
        const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
        const primaryMetaEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description');
        const descEl = document.querySelector('.jobs-description__content, .jobs-box__html-content');
        const isEasyApply = !!document.querySelector('.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button');
        const posterEl = document.querySelector('.hirer-card__hirer-information .jobs-poster__name, .jobs-poster-profile__name');
        
        return {
          title: titleEl ? titleEl.innerText.trim() : 'Bilinmeyen Baslik',
          company: companyEl ? companyEl.innerText.trim() : 'Bilinmeyen Sirket',
          meta: primaryMetaEl ? primaryMetaEl.innerText.trim() : '',
          description: descEl ? descEl.innerText.trim() : '',
          isEasyApply,
          hiringManagerName: posterEl ? posterEl.innerText.trim() : null,
          url: window.location.href
        };
      });

      const analysis = analyzeJob(jobData);
      
      results.push({
        ...jobData,
        analysis
      });

      console.log(`[STATUS] [%${analysis.score}] ${jobData.title} @ ${jobData.company} [${analysis.isGhostRisk ? 'RISK' : 'OK'}]`);
    } catch (itemErr) {
      console.warn(`[WARN] Ilan okunamadi: ${itemErr.message}`);
    }
  }

  results.sort((a, b) => b.analysis.score - a.analysis.score);

  const outputPath = path.join(__dirname, '../data/jobs_latest.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`[SUCCESS] ${results.length} ilan analiz edildi: data/jobs_latest.json`);
  return results;
}
