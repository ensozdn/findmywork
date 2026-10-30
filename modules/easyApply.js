import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

async function handleResumeStep(page, cvPath) {
  const existingResumes = await page.$$('.jobs-document-upload__resume-card, [data-test-document-upload-resume-card], .jobs-resume-picker__resume-list-item');
  const resumeRadios = await page.$$('input[type="radio"][name*="resume"], .jobs-document-upload input[type="radio"], input[type="radio"][id*="resume"]');

  let hasVisibleResume = false;
  for (const el of [...existingResumes, ...resumeRadios]) {
    if (await el.isVisible().catch(() => false)) {
      hasVisibleResume = true;
      break;
    }
  }

  if (hasVisibleResume || existingResumes.length > 0 || resumeRadios.length > 0) {
    const checkedRadio = await page.$('input[type="radio"][name*="resume"]:checked, .jobs-document-upload input[type="radio"]:checked, input[type="radio"][id*="resume"]:checked');
    if (!checkedRadio && resumeRadios.length > 0) {
      for (const r of resumeRadios) {
        if (await r.isVisible().catch(() => false)) {
          await r.click().catch(() => null);
          console.log('[INFO] Ilk kayitli CV secildi.');
          break;
        }
      }
    } else if (!checkedRadio && existingResumes.length > 0) {
      for (const c of existingResumes) {
        if (await c.isVisible().catch(() => false)) {
          await c.click().catch(() => null);
          console.log('[INFO] Ilk kayitli CV karti tiklandi.');
          break;
        }
      }
    } else {
      console.log('[INFO] Profildeki kayitli LinkedIn CV kullaniliyor.');
    }
    return true;
  }

  if (cvPath && fs.existsSync(cvPath)) {
    const fileInputs = await page.$$('input[type="file"][id*="resume"], input[type="file"]');
    for (const fi of fileInputs) {
      try {
        await fi.setInputFiles(cvPath);
        console.log(`[INFO] Profilde CV yok, dosya yuklendi: ${path.basename(cvPath)}`);
        await page.waitForTimeout(1500);
        return true;
      } catch (e) {
        console.log('[WARN] CV yukleme hatasi: ' + e.message);
      }
    }
  }

  return false;
}

async function fillQuestions(page) {
  return await page.evaluate((prof) => {
    let filled = 0;
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"]') || document;

    const phoneInput = modal.querySelector('input[id*="phoneNumber"], input[name*="phoneNumber"]');
    if (phoneInput && phoneInput.offsetParent !== null && !phoneInput.value) {
      phoneInput.value = prof.personal.phone;
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
      phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      filled++;
    }

    const allSkills = [
      ...prof.skills.languages,
      ...prof.skills.frameworks_and_tools,
      ...prof.skills.databases_and_caching,
      ...prof.skills.cloud_and_devops,
      ...prof.skills.architecture_and_messaging
    ].map(s => s.toLowerCase());

    const fieldsets = modal.querySelectorAll('fieldset');
    fieldsets.forEach((fs) => {
      if (fs.offsetParent === null) return;
      const text = (fs.querySelector('legend')?.innerText || fs.innerText || '').toLowerCase();
      const radios = Array.from(fs.querySelectorAll('input[type="radio"]'));
      if (radios.length === 0) return;
      if (radios.some(r => r.checked)) return;

      const isSponsorship = text.includes('sponsor') || text.includes('visa') || text.includes('vize');
      let target = null;

      if (isSponsorship) {
        target = radios.find(r => {
          const val = (r.value || '').toLowerCase();
          const lbl = (r.closest('label')?.innerText || '').toLowerCase();
          return val === 'no' || val === 'hayır' || val === 'hayir' || lbl.includes('no') || lbl.includes('hayır') || lbl.includes('hayir');
        });
      } else {
        target = radios.find(r => {
          const val = (r.value || '').toLowerCase();
          const lbl = (r.closest('label')?.innerText || '').toLowerCase();
          return val === 'yes' || val === 'evet' || lbl.includes('yes') || lbl.includes('evet');
        });
      }

      if (!target && radios.length > 0) {
        target = isSponsorship ? radios[radios.length - 1] : radios[0];
      }

      if (target) {
        target.checked = true;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        target.dispatchEvent(new Event('click', { bubbles: true }));
        filled++;
      }
    });

    const selects = modal.querySelectorAll('select');
    selects.forEach((sel) => {
      if (sel.offsetParent === null) return;
      if (sel.value && sel.value !== '' && sel.selectedIndex > 0) return;
      const label = (sel.closest('.fb-form-element')?.innerText || sel.getAttribute('aria-label') || '').toLowerCase();
      const options = Array.from(sel.options);

      let target = null;
      if (label.includes('english') || label.includes('ingilizce') || label.includes('language') || label.includes('dil')) {
        target = options.find(o => {
          const t = o.text.toLowerCase();
          return t.includes('professional') || t.includes('fluent') || t.includes('native') || t.includes('ileri') || t.includes('bilingual');
        });
      } else if (label.includes('sponsor') || label.includes('visa')) {
        target = options.find(o => {
          const t = o.text.toLowerCase();
          return t === 'no' || t === 'hayır' || t.startsWith('no');
        });
      } else if (label.includes('authorized') || label.includes('yetkili') || label.includes('work in')) {
        target = options.find(o => {
          const t = o.text.toLowerCase();
          return t === 'yes' || t === 'evet' || t.startsWith('yes');
        });
      }

      if (!target && options.length > 1) {
        target = options.find((o, idx) => idx > 0 && o.value !== '');
      }

      if (target) {
        sel.value = target.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    const inputs = modal.querySelectorAll('input[type="text"], input[type="number"], input:not([type]), textarea');
    inputs.forEach((input) => {
      if (input.offsetParent === null) return;
      if (input.type === 'file' || input.type === 'radio' || input.type === 'checkbox' || input.type === 'hidden') return;
      if (input.id && (input.id.includes('phoneNumber') || input.id.includes('search'))) return;
      if (input.value && input.value.trim() !== '') return;

      const container = input.closest('.fb-form-element, .jobs-easy-apply-form-section') || input.parentElement;
      const text = (container?.innerText || input.getAttribute('aria-label') || input.placeholder || '').toLowerCase();

      if (text.includes('year') || text.includes('yıl') || text.includes('yil') || text.includes('experience') || text.includes('deneyim') || text.includes('tecrübe')) {
        const matchesSkill = allSkills.some(skill => text.includes(skill));
        input.value = matchesSkill ? '3' : '2';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('notice') || text.includes('ihbar') || text.includes('start date') || text.includes('availability') || text.includes('ne zaman')) {
        input.value = 'Immediate';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('salary') || text.includes('maaş') || text.includes('compensation') || text.includes('ücret')) {
        input.value = input.type === 'number' ? '0' : 'Negotiable';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('city') || text.includes('location') || text.includes('şehir') || text.includes('nerede')) {
        input.value = 'Istanbul';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('github') || text.includes('git')) {
        input.value = prof.personal.github_url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('linkedin')) {
        input.value = prof.personal.linkedin_url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (text.includes('website') || text.includes('portfolio') || text.includes('web')) {
        input.value = prof.personal.github_url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        return;
      }

      if (input.required || input.getAttribute('aria-required') === 'true') {
        input.value = input.type === 'number' ? '2' : 'Yes';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      if (cb.offsetParent === null) return;
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    return filled;
  }, profile);
}

export async function performEasyApply(page, cvPath) {
  console.log('[INFO] Easy Apply akisi baslatildi.');

  const applyBtn = await page.$('.jobs-apply-button--top-card button.jobs-apply-button, .jobs-s-apply button, button.jobs-apply-button');
  if (!applyBtn) {
    console.log('[WARN] Easy Apply butonu bulunamadi.');
    return { success: false, reason: 'BUTTON_NOT_FOUND' };
  }

  await applyBtn.click();
  await page.waitForTimeout(2000);

  const modal = await page.$('.jobs-easy-apply-modal, [role="dialog"]');
  if (!modal) {
    console.log('[WARN] Basvuru modali acilmadi.');
    return { success: false, reason: 'MODAL_NOT_OPENED' };
  }

  let stepCount = 0;
  const maxSteps = 10;

  while (stepCount < maxSteps) {
    stepCount++;
    await page.waitForTimeout(1000);

    await handleResumeStep(page, cvPath);
    const filledCount = await fillQuestions(page);
    if (filledCount > 0) {
      console.log(`[INFO] Adimda ${filledCount} adet alan otomatik dolduruldu.`);
      await page.waitForTimeout(600);
    }

    const submitButtons = await page.$$(
      'button[aria-label="Submit application"], button[aria-label="Başvuruyu ilet"], button[aria-label="Başvuruyu gönder"], button[aria-label*="Submit" i], button[aria-label*="İlet" i]'
    );
    let submitBtn = null;
    for (const btn of submitButtons) {
      if (await btn.isVisible().catch(() => false)) {
        submitBtn = btn;
        break;
      }
    }

    if (submitBtn) {
      console.log('[INFO] Basvuru iletiliyor...');
      await submitBtn.click();
      await page.waitForTimeout(2500);

      const dismissBtn = await page.$(
        'button[aria-label="Dismiss"], button[aria-label="Kapat"], button[data-test-modal-close-btn], button.artdeco-modal__dismiss'
      );
      if (dismissBtn) await dismissBtn.click().catch(() => null);

      console.log('[SUCCESS] Basvuru tamamlandi.');
      return { success: true };
    }

    const nextButtons = await page.$$(
      'button[aria-label="Continue to next step"], button[aria-label="Sonraki adıma geç"], button[aria-label="Review your application"], button[aria-label="Başvurunuzu gözden geçirin"], button[aria-label*="Continue" i], button[aria-label*="Review" i], button[aria-label*="Sonraki" i], button[aria-label*="İlerle" i], button[data-easy-apply-next-button], footer button.artdeco-button--primary'
    );
    let nextBtn = null;
    for (const btn of nextButtons) {
      if (await btn.isVisible().catch(() => false)) {
        nextBtn = btn;
        break;
      }
    }

    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1500);

      const hasErrors = await page.$('.artdeco-inline-feedback--error, .fb-form-element--error');
      if (hasErrors) {
        console.log('[WARN] Eksik zorunlu alan algilandi, tekrar deneniyor...');
        await fillQuestions(page);
        await page.waitForTimeout(500);
        await nextBtn.click().catch(() => null);
        await page.waitForTimeout(1500);
      }
    } else {
      console.log('[WARN] Ilerleme butonu bulunamadi.');
      return { success: false, reason: 'NEXT_BUTTON_NOT_FOUND' };
    }
  }

  return { success: false, reason: 'TIMEOUT_OR_COMPLEX_FORM' };
}
