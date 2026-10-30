import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/profile.json'), 'utf8'));

/**
 * Injects and auto-fills common job application form fields (Workday, Greenhouse, Lever, generic inputs).
 * @param {import('playwright-core').Page} page 
 */
export async function autofillCurrentPage(page) {
  console.log(`\n⚡ Sayfadaki form alanları taranıyor ve dolduruluyor...`);

  const fillResult = await page.evaluate((prof) => {
    const filled = [];
    
    const mappings = [
      { keys: ['first_name', 'firstname', 'first-name', 'fname', 'ad'], val: prof.personal.full_name.split(' ')[0] },
      { keys: ['last_name', 'lastname', 'last-name', 'lname', 'soyad'], val: prof.personal.full_name.split(' ').slice(1).join(' ') },
      { keys: ['name', 'full_name', 'fullname', 'candidate_name'], val: prof.personal.full_name },
      { keys: ['email', 'e-mail', 'eposta'], val: prof.personal.email },
      { keys: ['phone', 'tel', 'mobile', 'telefon'], val: prof.personal.phone },
      { keys: ['linkedin', 'linkedin_profile', 'linkedin_url'], val: prof.personal.linkedin_url },
      { keys: ['github', 'github_url', 'github_profile'], val: prof.personal.github_url },
      { keys: ['city', 'location', 'sehir'], val: prof.personal.location }
    ];

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea');

    inputs.forEach((input) => {
      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const label = input.closest('label')?.innerText.toLowerCase() || '';

      const match = mappings.find(m => 
        m.keys.some(k => id.includes(k) || name.includes(k) || placeholder.includes(k) || label.includes(k))
      );

      if (match && !input.value) {
        input.value = match.val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled.push(`${input.name || input.id || 'Field'}: ${match.val}`);
      }
    });

    return filled;
  }, profile);

  console.log(`✅ ${fillResult.length} alan otomatik dolduruldu:`);
  fillResult.forEach(f => console.log(`  • ${f}`));
  return fillResult;
}

