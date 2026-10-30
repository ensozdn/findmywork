import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

export async function autofillPageForm(page, cvPath, coverLetter = '') {
  console.log(`[INFO] Dis kariyer formu taranıyor: ${page.url()}`);

  const fillResult = await page.evaluate(({ prof, letter }) => {
    const filled = [];

    const textMappings = [
      { keys: ['first_name', 'firstname', 'first-name', 'fname', 'first name', 'ad'], val: prof.personal.full_name.split(' ')[0] },
      { keys: ['last_name', 'lastname', 'last-name', 'lname', 'last name', 'soyad'], val: prof.personal.full_name.split(' ').slice(1).join(' ') },
      { keys: ['name', 'full_name', 'fullname', 'candidate_name', 'full name'], val: prof.personal.full_name },
      { keys: ['email', 'e-mail', 'eposta', 'e_mail'], val: prof.personal.email },
      { keys: ['phone', 'tel', 'mobile', 'telefon', 'phone_number', 'phone number'], val: prof.personal.phone },
      { keys: ['linkedin', 'linkedin_profile', 'linkedin_url', 'linkedin profile'], val: prof.personal.linkedin_url },
      { keys: ['github', 'github_url', 'github_profile', 'github profile'], val: prof.personal.github_url },
      { keys: ['city', 'location', 'sehir', 'current_city', 'current city'], val: prof.personal.location },
      { keys: ['cover_letter', 'coverletter', 'cover letter', 'comments', 'notes', 'on yazi', 'additional'], val: letter }
    ];

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]), textarea');

    inputs.forEach((input) => {
      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const aria = (input.getAttribute('aria-label') || '').toLowerCase();
      const label = input.closest('label')?.innerText.toLowerCase() || '';

      const match = textMappings.find(m =>
        m.keys.some(k => id.includes(k) || name.includes(k) || placeholder.includes(k) || aria.includes(k) || label.includes(k))
      );

      if (match && match.val && !input.value) {
        input.value = match.val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled.push(`${input.name || input.id || 'Metin Alani'}: ${match.val}`);
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
        label.includes('sozlesme')
      ) {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          filled.push(`Sozlesme kutusu onaylandi`);
        }
      }
    });

    return filled;
  }, { prof: profile, letter: coverLetter });

  let fileUploaded = false;
  if (cvPath && fs.existsSync(cvPath)) {
    const fileInputs = await page.$$('input[type="file"]');
    for (const fi of fileInputs) {
      try {
        await fi.setInputFiles(cvPath);
        fileUploaded = true;
        console.log(`[INFO] Hazir PDF CV forma yuklendi: ${path.basename(cvPath)}`);
        break;
      } catch (err) {
        continue;
      }
    }
  }

  return {
    url: page.url(),
    filledCount: fillResult.length,
    filledFields: fillResult,
    fileUploaded
  };
}

export async function handleExternalApplyFlow(browser, jobUrl, cvPath, coverLetter = '') {
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  console.log(`[INFO] Ilan aciliyor: ${jobUrl}`);
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const applyBtn = await page.$(
    '.jobs-apply-button--top-card button, .jobs-s-apply button, .jobs-apply-button, button[data-job-id]'
  );

  if (!applyBtn) {
    throw new Error('Basvuru butonu sayfada bulunamadi');
  }

  const [newPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    applyBtn.click()
  ]);

  const targetPage = newPage || page;
  await targetPage.waitForTimeout(3500);

  const fillReport = await autofillPageForm(targetPage, cvPath, coverLetter);
  return {
    success: true,
    targetPage,
    fillReport
  };
}
