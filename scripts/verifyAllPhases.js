import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTelegramAlert, notifyJob } from '../modules/telegramBot.js';
import { autofillCurrentPage, handleExternalApplyFlow } from '../modules/formAutofill.js';
import { verifyCompanyCareerSite } from '../modules/careerSiteVerifier.js';
import { classifyEmailContent, processIncomingEmail } from '../modules/emailTracker.js';
import { fetchRemoteOkJobs } from '../modules/multiPlatformScout.js';
import { generateTailoredResumeMarkdown } from '../modules/resumeTailor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('====================================================');
  console.log('FINDMYWORK - 5 FAZ KAPSAMLI DOGRULAMA TESTI');
  console.log('====================================================\n');

  let passed = 0;
  let total = 5;

  console.log('1. FAZ 1 TESTI (Telegram & Dis Form Modulu):');
  try {
    const isNotifyFn = typeof notifyJob === 'function';
    const isExtApplyFn = typeof handleExternalApplyFlow === 'function';
    const isAutofillFn = typeof autofillCurrentPage === 'function';
    if (isNotifyFn && isExtApplyFn && isAutofillFn) {
      console.log('  [OK] Telegram bildirim ve form autofill fonksiyonlari hazir.');
      passed++;
    } else {
      console.log('  [FAIL] Fonksiyon tanimlarinda eksiklik var.');
    }
  } catch (e) {
    console.log(`  [FAIL] Faz 1 Hatasi: ${e.message}`);
  }

  console.log('\n2. FAZ 2 TESTI (Anti-Ghost & Kariyer Sayfasi Dogrulayici):');
  try {
    const res = await verifyCompanyCareerSite({
      companyName: 'gitlab',
      jobTitle: 'Senior Fullstack Engineer'
    });
    if (res && typeof res.verified !== 'undefined') {
      console.log(`  [OK] Capraz kontrol calisiyor: ATS=${res.atsPlatform}, Durum=${res.statusLabel}`);
      passed++;
    } else {
      console.log('  [FAIL] Dogrulama sonucu gecersiz.');
    }
  } catch (e) {
    console.log(`  [FAIL] Faz 2 Hatasi: ${e.message}`);
  }

  console.log('\n3. FAZ 3 TESTI (E-Posta Red ve Mulakat Parser):');
  try {
    const interviewClass = classifyEmailContent('Technical Interview Invitation', 'We would like to invite you');
    const rejectionClass = classifyEmailContent('Update on your application', 'Unfortunately we decided not to move forward');
    if (interviewClass.type === 'INTERVIEW' && rejectionClass.type === 'REJECTION') {
      console.log('  [OK] E-posta siniflandirma dogru calisiyor (INTERVIEW & REJECTION tespit edildi).');
      passed++;
    } else {
      console.log('  [FAIL] Siniflandirma basarisiz.');
    }
  } catch (e) {
    console.log(`  [FAIL] Faz 3 Hatasi: ${e.message}`);
  }

  console.log('\n4. FAZ 4 TESTI (RemoteOK Global Remote Entegrasyonu):');
  try {
    const remoteJobs = await fetchRemoteOkJobs(['javascript']);
    if (Array.isArray(remoteJobs)) {
      console.log(`  [OK] RemoteOK API baglantisi basarili. Taranan ilan: ${remoteJobs.length}`);
      passed++;
    } else {
      console.log('  [FAIL] RemoteOK verisi alinamadi.');
    }
  } catch (e) {
    console.log(`  [FAIL] Faz 4 Hatasi: ${e.message}`);
  }

  console.log('\n5. FAZ 5 TESTI (Ilana Ozel ATS CV Motoru):');
  try {
    const sampleJob = {
      company: 'VerificationCorp',
      title: 'Full Stack NestJS Engineer',
      analysis: {
        matchedSkills: ['NestJS', 'TypeScript', 'PostgreSQL', 'Redis']
      }
    };
    const tailored = generateTailoredResumeMarkdown(sampleJob);
    if (fs.existsSync(tailored.mdPath)) {
      const content = fs.readFileSync(tailored.mdPath, 'utf8');
      const hasKeywords = content.includes('NestJS') && content.includes('TypeScript');
      if (hasKeywords) {
        console.log(`  [OK] ATS CV Markdown uretildi: ${path.basename(tailored.mdPath)}`);
        passed++;
      }
    } else {
      console.log('  [FAIL] CV dosyasi olusturulamadi.');
    }
  } catch (e) {
    console.log(`  [FAIL] Faz 5 Hatasi: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`SONUC: ${passed}/${total} FAZ BASARIYLA DOGRULANDI`);
  console.log('====================================================');
}

runVerification().catch(console.error);

