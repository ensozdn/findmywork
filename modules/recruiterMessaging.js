import { chromium } from 'playwright-core';

export async function sendOrDraftRecruiterMessage({
  profileUrl,
  messageText,
  cdpEndpoint = 'http://127.0.0.1:9222'
}) {
  console.log(`[INFO] Profil aciliyor: ${profileUrl}`);
  
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);

  let connectBtn = await page.$('button:has-text("Connect"), button:has-text("Bağlantı kur")');
  
  if (!connectBtn) {
    const moreBtn = await page.$('button[aria-label="More actions"], button:has-text("More"), button:has-text("Daha fazla")');
    if (moreBtn) {
      await moreBtn.click();
      await page.waitForTimeout(800);
      connectBtn = await page.$('.artdeco-dropdown__content button:has-text("Connect"), .artdeco-dropdown__content button:has-text("Bağlantı kur")');
    }
  }

  if (connectBtn) {
    await connectBtn.click();
    await page.waitForTimeout(1000);

    const addNoteBtn = await page.$('button[aria-label="Add a note"], button:has-text("Add a note"), button:has-text("Not ekle")');
    if (addNoteBtn) {
      await addNoteBtn.click();
      await page.waitForTimeout(800);

      const textarea = await page.$('textarea[name="message"]');
      if (textarea) {
        const trimmedMessage = messageText.length > 295 ? messageText.slice(0, 290) + '...' : messageText;
        await textarea.fill(trimmedMessage);
        console.log(`[INFO] Baglanti notu hazirlandi: "${trimmedMessage}"`);
        return { success: true, mode: 'DRAFTED_NOTE' };
      }
    }
  }

  console.log(`[INFO] Baglanti butonu yerine profil acildi.`);
  return { success: true, mode: 'PAGE_OPEN' };
}
