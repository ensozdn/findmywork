import { chromium } from 'playwright-core';

/**
 * Opens the recruiter/hiring manager profile in Chrome and assists in sending the short connection note.
 */
export async function sendOrDraftRecruiterMessage({
  profileUrl,
  messageText,
  cdpEndpoint = 'http://127.0.0.1:9222'
}) {
  console.log(`\n📬 İK / Hiring Manager profili açılıyor: ${profileUrl}`);
  
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);

  console.log(`👤 Profil yüklendi. Bağlantı / Mesaj butonu kontrol ediliyor...`);

  // Try to find "Connect" or "More actions" -> "Connect"
  let connectBtn = await page.$('button:has-text("Connect"), button:has-text("Bağlantı kur")');
  
  if (!connectBtn) {
    // Check inside "More" / "Daha Fazla" dropdown
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

    // Click "Add a note" / "Not ekle"
    const addNoteBtn = await page.$('button[aria-label="Add a note"], button:has-text("Add a note"), button:has-text("Not ekle")');
    if (addNoteBtn) {
      await addNoteBtn.click();
      await page.waitForTimeout(800);

      const textarea = await page.$('textarea[name="message"]');
      if (textarea) {
        // LinkedIn connection note limit is 300 chars, so trim if needed
        const trimmedMessage = messageText.length > 295 ? messageText.slice(0, 290) + '...' : messageText;
        await textarea.fill(trimmedMessage);
        console.log(`\n✍️ Not kutusuna Can Değer tarzı kısa mesaj yazıldı:\n"${trimmedMessage}"`);
        console.log(`\n👉 Gönder butonuna basman veya incelemen için Chrome'da açık bırakıldı!`);
        return { success: true, mode: 'DRAFTED_NOTE' };
      }
    }
  }

  console.log(`ℹ️ Doğrudan bağlantı butonu yerine mesaj veya takip modu mevcut. Sekme açık bırakıldı.`);
  return { success: true, mode: 'PAGE_OPEN' };
}
