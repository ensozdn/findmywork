import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

export async function autofillPageForm(page, cvPath, coverLetter = '') {
  console.log(`[INFO] Form doldurma motoru calisiyor: ${page.url()}`);
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForTimeout(2000);

  let fileUploaded = false;
  if (cvPath && fs.existsSync(cvPath)) {
    const frames = [page, ...page.frames()];
    for (const frame of frames) {
      try {
        const fileInputs = await frame.$$('input[type="file"]');
        for (const fi of fileInputs) {
          await fi.setInputFiles(cvPath);
          fileUploaded = true;
          console.log(`[INFO] PDF CV basariyla yuklendi: ${path.basename(cvPath)}`);
          break;
        }
        if (fileUploaded) break;
      } catch (err) {
        continue;
      }
    }
  }

  if (fileUploaded) {
    await page.waitForTimeout(2500);
  }

  const fillReport = {
    filledCount: 0,
    filledFields: [],
    fileUploaded
  };

  const frames = [page, ...page.frames()];

  for (const frame of frames) {
    try {
      const result = await frame.evaluate(({ prof, letter }) => {
        const filled = [];

        const textMappings = [
          { keys: ['first_name', 'firstname', 'first-name', 'fname', 'first name', 'ad'], val: prof.personal.full_name.split(' ')[0] },
          { keys: ['last_name', 'lastname', 'last-name', 'lname', 'last name', 'soyad'], val: prof.personal.full_name.split(' ').slice(1).join(' ') },
          { keys: ['name', 'full_name', 'fullname', 'candidate_name', 'full name', 'ad soyad'], val: prof.personal.full_name },
          { keys: ['email', 'e-mail', 'eposta', 'e_mail', 'mail'], val: prof.personal.email },
          { keys: ['phone', 'tel', 'mobile', 'telefon', 'phone_number', 'phone number', 'contact_number'], val: prof.personal.phone },
          { keys: ['linkedin', 'linkedin_profile', 'linkedin_url', 'linkedin profile', 'linkedin url'], val: prof.personal.linkedin_url },
          { keys: ['github', 'github_url', 'github_profile', 'github profile', 'github url'], val: prof.personal.github_url },
          { keys: ['city', 'location', 'sehir', 'current_city', 'current city', 'address'], val: prof.personal.location },
          { keys: ['cover_letter', 'coverletter', 'cover letter', 'comments', 'notes', 'on yazi', 'additional', 'summary'], val: letter }
        ];

        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'));

        inputs.forEach((input) => {
          const id = (input.id || '').toLowerCase();
          const name = (input.name || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const aria = (input.getAttribute('aria-label') || '').toLowerCase();
          const label = input.closest('label')?.innerText.toLowerCase() || '';

          const match = textMappings.find(m =>
            m.keys.some(k => id.includes(k) || name.includes(k) || placeholder.includes(k) || aria.includes(k) || label.includes(k))
          );

          if (match && match.val && (!input.value || input.value.trim() === '')) {
            input.value = match.val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filled.push(`${input.name || input.id || 'Metin'}: ${match.val}`);
          }
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb) => {
          const label = cb.closest('label')?.innerText.toLowerCase() || '';
          if (
            label.includes('privacy') ||
            label.includes('terms') ||
            label.includes('kvkk') ||
            label.includes('consent') ||
            label.includes('agree') ||
            label.includes('sozlesme') ||
            label.includes('policy')
          ) {
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event('change', { bubbles: true }));
              filled.push('Onay kutusu isaretlendi');
            }
          }
        });

        return filled;
      }, { prof: profile, letter: coverLetter });

      fillReport.filledCount += result.length;
      fillReport.filledFields.push(...result);
    } catch (frameErr) {
      continue;
    }
  }

  return fillReport;
}

export async function handleExternalApplyFlow(browser, jobUrl, cvPath, coverLetter = '') {
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  console.log(`[INFO] Ilan sayfasi aciliyor: ${jobUrl}`);
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2500);

  const applyBtn = await page.$(
    '.jobs-apply-button--top-card button, .jobs-s-apply button, .jobs-apply-button, button[data-job-id]'
  );

  if (!applyBtn) {
    throw new Error('LinkedIn uzerindeki basvuru butonu bulunamadi');
  }

  let targetPage = page;
  try {
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 12000 }).catch(() => null),
      applyBtn.click()
    ]);
    if (newPage) {
      targetPage = newPage;
    }
  } catch (clickErr) {
    await applyBtn.click();
  }

  await targetPage.bringToFront().catch(() => null);
  await targetPage.waitForTimeout(4000);

  const fillReport = await autofillPageForm(targetPage, cvPath, coverLetter);

  console.log(`[SUCCESS] Dis form islemi tamamlandi. Toplam doldurulan: ${fillReport.filledCount}, CV: ${fillReport.fileUploaded ? 'Yuklendi' : 'Bulunamadi'}`);
  return {
    success: true,
    targetPage,
    fillReport
  };
}

export const autofillCurrentPage = autofillPageForm;
