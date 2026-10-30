import { chromium } from 'playwright-core';
import { analyzeJob } from './jobAnalyzer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Connects to user's existing Chrome session over CDP and scans LinkedIn jobs.
 */
export async function scanLinkedInJobs({
  keyword = 'React Native',
  location = 'Turkey',
  remoteOnly = true,
  past24Hours = true,
  maxJobs = 15,
  cdpEndpoint = 'http://127.0.0.1:9222'
} = {}) {
  console.log(`\n🔍 Chrome oturumuna bağlanılıyor (${cdpEndpoint})...`);
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpEndpoint);
  } catch (err) {
    throw new Error(
      `Chrome ile bağlantı kurulamadı. Lütfen Chrome'u debug modunda açtığından emin ol.\n` +
      `Komut: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222`
    );
  }

  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  
  // Find existing LinkedIn tab or open a new one
  let page = context.pages().find(p => p.url().includes('linkedin.com'));
  if (!page) {
    page = await context.newPage();
  }

  // Construct search query
  // f_TPR=r86400 -> Past 24 hours
  // f_WT=2 -> Remote, f_WT=1 -> On-site, f_WT=3 -> Hybrid
  let searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;
  if (location) searchUrl += `&location=${encodeURIComponent(location)}`;
  if (past24Hours) searchUrl += `&f_TPR=r86400`;
  if (remoteOnly) searchUrl += `&f_WT=2`;

  console.log(`🌐 Arama URL'ine gidiliyor: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Allow LinkedIn cards to render
  await page.waitForTimeout(3000);

  // Collect job cards
  console.log(`📋 İlan listesi taranıyor...`);
  const jobElements = await page.$$('.jobs-search-results-list li[data-occludable-job-id], .scaffold-layout__list-container li');
  
  console.log(`Toplam ${jobElements.length} ilan bulundu. Detaylar analiz ediliyor...`);

  const results = [];
  const limit = Math.min(jobElements.length, maxJobs);

  for (let i = 0; i < limit; i++) {
    try {
      const el = jobElements[i];
      // Click on the job card to load right-pane details
      await el.scrollIntoViewIfNeeded();
      await el.click();
      await page.waitForTimeout(1500);

      const jobData = await page.evaluate(() => {
        // Top card details
        const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title');
        const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
        const primaryMetaEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description');
        const descEl = document.querySelector('.jobs-description__content, .jobs-box__html-content');
        
        // Check for Easy Apply
        const isEasyApply = !!document.querySelector('.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button');
        
        // Check poster / hiring manager
        const posterEl = document.querySelector('.hirer-card__hirer-information .jobs-poster__name, .jobs-poster-profile__name');
        
        return {
          title: titleEl ? titleEl.innerText.trim() : 'Bilinmeyen Başlık',
          company: companyEl ? companyEl.innerText.trim() : 'Bilinmeyen Şirket',
          meta: primaryMetaEl ? primaryMetaEl.innerText.trim() : '',
          description: descEl ? descEl.innerText.trim() : '',
          isEasyApply,
          hiringManagerName: posterEl ? posterEl.innerText.trim() : null,
          url: window.location.href
        };
      });

      // Analyze job with AI & Ghost detector
      const analysis = analyzeJob(jobData);
      
      results.push({
        ...jobData,
        analysis
      });

      console.log(`  ✓ [Skor: %${analysis.score}] ${jobData.title} @ ${jobData.company} ${analysis.isGhostRisk ? '⚠️ (Fake/Riskli)' : '✅'}`);
    } catch (itemErr) {
      console.warn(`  ⚠️ İlan #${i + 1} okunurken atlandı: ${itemErr.message}`);
    }
  }

  // Sort by match score descending
  results.sort((a, b) => b.analysis.score - a.analysis.score);

  // Save results to file
  const outputPath = path.join(__dirname, '../data/jobs_latest.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n🎉 Tarama tamamlandı! ${results.length} ilan analiz edilip kaydedildi: data/jobs_latest.json`);
  return results;
}

