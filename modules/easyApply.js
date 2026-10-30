import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

/**
 * Automates the LinkedIn Easy Apply flow with safety checks and user's ready CV.
 * @param {import('playwright-core').Page} page
 * @param {string} cvPath - Path to Enes's PDF resume
 */
export async function performEasyApply(page, cvPath) {
  console.log(`\n⚡ Easy Apply süreci başlatılıyor...`);

  // 1. Easy Apply butonunu bul ve tıkla
  const applyBtn = await page.$('.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button');
  if (!applyBtn) {
    console.log(`⚠️ Easy Apply butonu bulunamadı veya daha önce başvurulmuş.`);
    return { success: false, reason: 'BUTTON_NOT_FOUND' };
  }

  await applyBtn.click();
  await page.waitForTimeout(2000);

  // Modal diyaloğunu kontrol et
  const modal = await page.$('.jobs-easy-apply-modal, [role="dialog"]');
  if (!modal) {
    console.log(`⚠️ Başvuru modalı açılmadı.`);
    return { success: false, reason: 'MODAL_NOT_OPENED' };
  }

  let stepCount = 0;
  const maxSteps = 8;

  while (stepCount < maxSteps) {
    stepCount++;
    await page.waitForTimeout(1000);

    // Form alanlarını doldur (telefon, vb.)
    await page.evaluate((prof) => {
      const phoneInput = document.querySelector('input[id*="phoneNumber"], input[name*="phoneNumber"]');
      if (phoneInput && !phoneInput.value) {
        phoneInput.value = prof.personal.phone;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, profile);

    // CV yükleme alanı varsa ve cvPath verilmişse yükle
    if (cvPath && fs.existsSync(cvPath)) {
      const fileInput = await page.$('input[type="file"][id*="resume"], input[type="file"]');
      if (fileInput) {
        try {
          await fileInput.setInputFiles(cvPath);
          console.log(`  📎 Hazır CV yüklendi: ${path.basename(cvPath)}`);
          await page.waitForTimeout(1500);
        } catch (e) {
          console.log(`  ℹ️ CV yükleme alanı mevcut CV'yi kullanıyor.`);
        }
      }
    }

    // Butonları kontrol et: "Submit application", "Review", "Next"
    const submitBtn = await page.$('button[aria-label="Submit application"], button[aria-label="Başvuruyu ilet"]');
    if (submitBtn) {
      console.log(`  🚀 "Başvuruyu İlet" aşamasına gelindi.`);
      await submitBtn.click();
      await page.waitForTimeout(2000);
      
      // Başarı modalını kapat
      const dismissBtn = await page.$('button[aria-label="Dismiss"], button[data-test-modal-close-btn]');
      if (dismissBtn) await dismissBtn.click();

      console.log(`  ✅ Başvuru başarıyla tamamlandı!`);
      return { success: true };
    }

    const nextBtn = await page.$('button[aria-label="Continue to next step"], button[aria-label="Sonraki adıma geç"], button[aria-label="Review your application"]');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1200);
    } else {
      console.log(`  ⚠️ Ek özel sorular (deneyim yılı, vize vb.) bulundu. Tarayıcıda kontrol etmen için bekleniyor...`);
      return { success: false, reason: 'CUSTOM_QUESTIONS_REQUIRED' };
    }
  }

  return { success: false, reason: 'TIMEOUT_OR_COMPLEX_FORM' };
}

