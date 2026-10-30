import { chromium } from 'playwright-core';
import { generatePersonaMessage, classifyPersona } from './personaEngine.js';

export async function findHiringManagers({
  companyName,
  jobRole = 'Full Stack Engineer',
  matchedSkills = [],
  roleTarget = 'Founder OR CEO OR CTO OR "Engineering Manager" OR "Tech Lead" OR "Talent Acquisition"',
  cdpEndpoint = 'http://127.0.0.1:9222'
}) {
  console.log(`[INFO] Yonetici araniyor: ${companyName}`);
  
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  
  const page = await context.newPage();
  
  const query = `"${companyName}" (${roleTarget})`;
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const rawPeople = await page.evaluate(() => {
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

  const enrichedPeople = rawPeople.map(p => {
    const personaMeta = generatePersonaMessage({
      title: p.title,
      fullName: p.name,
      company: companyName,
      role: jobRole,
      matchedSkills
    });

    return {
      name: p.name,
      title: p.title,
      profileUrl: p.profileUrl,
      personaType: personaMeta.personaType,
      personaLabel: personaMeta.personaLabel,
      customMessage: personaMeta.message,
      charLength: personaMeta.charLength
    };
  });

  return enrichedPeople;
}
