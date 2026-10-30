import { chromium } from 'playwright-core';
import { analyzeJob } from './jobAnalyzer.js';
import { generateMarkdownReport } from './reportGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function scanLinkedInJobs({
  keyword = 'Full Stack',
  location = 'Turkey',
  remoteOnly = false,
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
  
  let page = context.pages().find(p => p.url().includes('linkedin.com/jobs'));
  if (!page) {
    page = await context.newPage();
  }

  let searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;
  if (location) searchUrl += `&location=${encodeURIComponent(location)}`;
  if (past24Hours) searchUrl += `&f_TPR=r86400`;
  if (remoteOnly) searchUrl += `&f_WT=2`;

  const currentUrl = page.url();
  if (!currentUrl.includes(encodeURIComponent(keyword))) {
    console.log(`[INFO] URL aciliyor: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } else {
    console.log(`[INFO] Mevcut arama sekmesi kullaniliyor: ${currentUrl}`);
  }

  console.log(`[INFO] Ilan listesi taranıyor...`);
  
  const jobCardSelector = 'li[data-occludable-job-id], .scaffold-layout__list-item';
  await page.waitForSelector(jobCardSelector, { timeout: 10000 }).catch(() => null);

  const jobElements = await page.$$(jobCardSelector);
  console.log(`[INFO] Toplam ${jobElements.length} ilan karti tespit edildi.`);

  const results = [];
  const limit = Math.min(jobElements.length, maxJobs);

  for (let i = 0; i < limit; i++) {
    try {
      const el = jobElements[i];
      await el.scrollIntoViewIfNeeded();

      const clickable = await el.$('a.job-card-container__link, .job-card-list__title, a[data-control-id]');
      if (clickable) {
        await clickable.click();
      } else {
        await el.click();
      }

      await page.waitForTimeout(1800);

      const jobData = await page.evaluate(() => {
        const titleEl = document.querySelector(
          '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24'
        );
        const companyEl = document.querySelector(
          '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description a'
        );
        const metaEl = document.querySelector(
          '.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description, .job-details-jobs-unified-top-card__tertiary-description'
        );
        const descEl = document.querySelector(
          '.jobs-description__content, .jobs-box__html-content, #job-details'
        );
        const isEasyApply = !!document.querySelector(
          '.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button, button[data-job-id]'
        );
        const posterEl = document.querySelector(
          '.hirer-card__hirer-information .jobs-poster__name, .jobs-poster-profile__name'
        );

        return {
          title: titleEl ? titleEl.innerText.trim() : 'Ilan Basligi',
          company: companyEl ? companyEl.innerText.trim() : 'Sirket',
          meta: metaEl ? metaEl.innerText.trim() : '',
          description: descEl ? descEl.innerText.trim() : '',
          isEasyApply,
          hiringManagerName: posterEl ? posterEl.innerText.trim() : null,
          url: window.location.href
        };
      });

      if (jobData.title && jobData.title !== 'Ilan Basligi') {
        const analysis = analyzeJob(jobData);
        results.push({
          ...jobData,
          analysis
        });
        console.log(`[STATUS] [%${analysis.score}] ${jobData.title} @ ${jobData.company} [${analysis.isGhostRisk ? 'RISK' : 'UYGUN'}]`);
      }
    } catch (itemErr) {
      console.warn(`[WARN] Ilan #${i + 1} atlandi: ${itemErr.message}`);
    }
  }

  results.sort((a, b) => b.analysis.score - a.analysis.score);

  const outputPath = path.join(__dirname, '../data/jobs_latest.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  generateMarkdownReport();

  console.log(`[SUCCESS] ${results.length} ilan basariyla analiz edildi ve kaydedildi: data/jobs_latest.json & REPORT.md`);
  return results;
}
