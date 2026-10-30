import { chromium } from 'playwright-core';

/**
 * Searches for key decision makers (Engineering Manager, Mobile Lead, Tech Recruiter) for a target company.
 */
export async function findHiringManagers({
  companyName,
  roleTarget = 'Mobile OR Engineering Manager OR Tech Recruiter',
  cdpEndpoint = 'http://127.0.0.1:9222'
}) {
  console.log(`\n🔎 [${companyName}] için karar vericiler aranıyor...`);
  
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  
  const page = await context.newPage();
  
  const query = `"${companyName}" (${roleTarget})`;
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const people = await page.evaluate(() => {
    const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result__item');
    const list = [];
    cards.forEach((c) => {
      const nameEl = c.querySelector('.entity-result__title-text a span[aria-hidden="true"], .app-aware-link');
      const titleEl = c.querySelector('.entity-result__primary-subtitle');
      const linkEl = c.querySelector('a.app-aware-link');
      
      if (nameEl && titleEl) {
        list.push({
          name: nameEl.innerText.trim(),
          title: titleEl.innerText.trim(),
          profileUrl: linkEl ? linkEl.href : ''
        });
      }
    });
    return list.slice(0, 5);
  });

  await page.close();
  return people;
}

