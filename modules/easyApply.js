import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

export async function performEasyApply(page, cvPath) {
  console.log(`[INFO] Easy Apply akisi baslatildi.`);

  const applyBtn = await page.$('.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button');
  if (!applyBtn) {
    console.log(`[WARN] Easy Apply butonu bulunamadi.`);
    return { success: false, reason: 'BUTTON_NOT_FOUND' };
  }

  await applyBtn.click();
  await page.waitForTimeout(2000);

  const modal = await page.$('.jobs-easy-apply-modal, [role="dialog"]');
  if (!modal) {
    console.log(`[WARN] Basvuru modali acilmadi.`);
    return { success: false, reason: 'MODAL_NOT_OPENED' };
  }

  let stepCount = 0;
  const maxSteps = 8;

  while (stepCount < maxSteps) {
    stepCount++;
    await page.waitForTimeout(1000);

    await page.evaluate((prof) => {
      const phoneInput = document.querySelector('input[id*="phoneNumber"], input[name*="phoneNumber"]');
      if (phoneInput && !phoneInput.value) {
        phoneInput.value = prof.personal.phone;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, profile);

    if (cvPath && fs.existsSync(cvPath)) {
      const fileInput = await page.$('input[type="file"][id*="resume"], input[type="file"]');
      if (fileInput) {
        try {
          await fileInput.setInputFiles(cvPath);
          console.log(`[INFO] CV yuklendi: ${path.basename(cvPath)}`);
          await page.waitForTimeout(1500);
        } catch (e) {
          console.log(`[INFO] Mevcut kayitli CV kullaniliyor.`);
        }
      }
    }

    const submitBtn = await page.$('button[aria-label="Submit application"], button[aria-label="Başvuruyu ilet"]');
    if (submitBtn) {
      console.log(`[INFO] Basvuru iletiliyor...`);
      await submitBtn.click();
      await page.waitForTimeout(2000);
      
      const dismissBtn = await page.$('button[aria-label="Dismiss"], button[data-test-modal-close-btn]');
      if (dismissBtn) await dismissBtn.click();

      console.log(`[SUCCESS] Basvuru tamamlandi.`);
      return { success: true };
    }

    const nextBtn = await page.$('button[aria-label="Continue to next step"], button[aria-label="Sonraki adıma geç"], button[aria-label="Review your application"]');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1200);
    } else {
      console.log(`[WARN] Ek soru bulundu. Manuel kontrol bekleniyor.`);
      return { success: false, reason: 'CUSTOM_QUESTIONS_REQUIRED' };
    }
  }

  return { success: false, reason: 'TIMEOUT_OR_COMPLEX_FORM' };
}
