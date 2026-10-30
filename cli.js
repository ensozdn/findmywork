import { isChromeDebuggingOpen, ensureChromeReady } from './modules/chromeLauncher.js';
import { scanLinkedInJobs } from './modules/linkedInScout.js';
import { findHiringManagers } from './modules/hiringManagerScout.js';
import { autofillCurrentPage } from './modules/formAutofill.js';
import { performEasyApply } from './modules/easyApply.js';
import { sendOrDraftRecruiterMessage } from './modules/recruiterMessaging.js';
import { generateMarkdownReport } from './modules/reportGenerator.js';
import { getApplications, logApplication } from './modules/tracker.js';
import { chromium } from 'playwright-core';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`\n======================================================`);
  console.log(`FINDMYWORK - Is Arama ve Basvuru Yonetim Pipeline`);
  console.log(`======================================================`);

  if (command === 'check') {
    console.log(`\n1. Profil ve CV Kontrolu:`);
    const profilePath = path.join(__dirname, 'config/profile.json');
    const cvPath = path.join(__dirname, 'config/resume.pdf');
    
    if (fs.existsSync(profilePath)) {
      const p = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      console.log(`  [OK] Profil: ${p.personal.full_name} (${p.personal.title})`);
      console.log(`  [OK] Hedef Roller: ${p.preferences.target_roles.join(', ')}`);
      const expList = p.experience ? p.experience.map(e => `${e.company} (${e.role})`).join(', ') : '';
      console.log(`  [OK] Deneyimler: ${expList}`);
    }

    if (fs.existsSync(cvPath)) {
      console.log(`  [OK] Hazir CV: Mevcut (${cvPath})`);
    } else {
      console.log(`  [INFO] Hazir CV: config/resume.pdf bulunamadi.`);
    }

    console.log(`\n2. Chrome Baglanti Kontrolu:`);
    const chromeStatus = await ensureChromeReady();
    if (chromeStatus.ok) {
      console.log(`  [OK] ${chromeStatus.message}`);
    } else {
      console.log(`  [WARN] ${chromeStatus.message}`);
      console.log(`  [HINT] ${chromeStatus.hint}`);
    }
    return;
  }

  if (command === 'scan') {
    const keyword = args[1] || 'React Native';
    const isChromeReady = await isChromeDebuggingOpen();
    if (!isChromeReady) {
      console.log(`\n[ERROR] Chrome debug modunda acik degil. Port: 9222`);
      console.log(`Terminalde calistirin:\n`);
      console.log(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &\n`);
      return;
    }

    console.log(`\n[INFO] "${keyword}" anahtar kelimesiyle tarama baslatiliyor...`);
    try {
      await scanLinkedInJobs({
        keyword,
        maxJobs: 15,
        remoteOnly: false
      });
      console.log(`\n[INFO] Incelemek ve basvurmak icin: node cli.js review`);
    } catch (e) {
      console.error(`\n[ERROR] Tarama hatasi:`, e.message);
    }
    return;
  }

  if (command === 'review') {
    const dataPath = path.join(__dirname, 'data/jobs_latest.json');
    if (!fs.existsSync(dataPath)) {
      console.log(`\n[INFO] Taranmis ilan verisi bulunamadi. Once: node cli.js scan`);
      return;
    }

    const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const appliedList = getApplications();
    const appliedUrls = new Set(appliedList.map(a => a.url));
    const cvPath = path.join(__dirname, 'config/resume.pdf');

    const pendingJobs = jobs.filter(j => !appliedUrls.has(j.url));

    console.log(`\n[INFO] Incelenmeyi bekleyen ${pendingJobs.length} ilan var.\n`);
    if (pendingJobs.length === 0) {
      console.log(`[INFO] Tum taranan ilanlar incelenmis veya basvurulmus.`);
      return;
    }

    const isChromeReady = await isChromeDebuggingOpen();
    let browser;
    if (isChromeReady) {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    }

    for (let i = 0; i < pendingJobs.length; i++) {
      const j = pendingJobs[i];
      const a = j.analysis;

      console.log(`\n================================================================`);
      console.log(`[${i + 1}/${pendingJobs.length}] Skor: %${a.score} [${a.isGhostRisk ? 'GHOST RISKI' : 'UYGUN'}]`);
      console.log(`Pozisyon : ${j.title} @ ${j.company}`);
      console.log(`Konum    : ${j.meta}`);
      console.log(`Tur      : ${j.isEasyApply ? 'Kolay Basvuru (Easy Apply)' : 'Sirket Dis Linki'}`);
      console.log(`Eslenen  : ${a.matchedSkills.join(', ') || 'Temel mobil stack'}`);
      console.log(`URL      : ${j.url}`);
      console.log(`----------------------------------------------------------------`);
      console.log(`Iletisim Notu:`);
      console.log(`"${a.outreachMessage.split('\n')[0]}..."`);
      console.log(`----------------------------------------------------------------`);

      console.log(`Islem secin:`);
      console.log(`  [1] Onayla ve Otomatik Basvur (Easy Apply)`);
      console.log(`  [2] Chrome'da Ac (Incele / Dis Linkten Basvur)`);
      console.log(`  [3] Yoneticiye Mesaj / Baglanti Notu Hazirla`);
      console.log(`  [4] Pas Gec (Atla)`);
      console.log(`  [q] Cikis`);

      const choice = await askQuestion(`Secim (1/2/3/4/q): `);

      if (choice === 'q' || choice === 'Q') break;

      if (choice === '1') {
        if (!isChromeReady || !browser) {
          console.log(`[ERROR] Chrome bagli degil.`);
          continue;
        }
        const context = browser.contexts()[0];
        const page = await context.newPage();
        await page.goto(j.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const res = await performEasyApply(page, cvPath);
        if (res.success) {
          logApplication({
            company: j.company,
            role: j.title,
            url: j.url,
            status: 'APPLIED_EASY_APPLY',
            notes: 'Otomatik Easy Apply ile basvuruldu'
          });
          console.log(`[SUCCESS] Basvuru kaydedildi.`);
        } else {
          console.log(`[WARN] Basvuru tamamlanamadi: ${res.reason}`);
        }
      } else if (choice === '2') {
        if (browser) {
          const context = browser.contexts()[0];
          const page = await context.newPage();
          await page.goto(j.url);
          console.log(`[INFO] Sekme Chrome'da acildi.`);
        }
      } else if (choice === '3') {
        const leads = await findHiringManagers({ companyName: j.company });
        if (leads.length > 0) {
          console.log(`\nBulunan Yoneticiler:`);
          leads.forEach((l, idx) => console.log(`  ${idx + 1}. ${l.name} (${l.title})`));
          const leadPick = await askQuestion(`Kime mesaj notu hazirlansin? (1-${leads.length} / atla: Enter): `);
          const pickedIdx = parseInt(leadPick) - 1;
          if (!isNaN(pickedIdx) && leads[pickedIdx]) {
            await sendOrDraftRecruiterMessage({
              profileUrl: leads[pickedIdx].profileUrl,
              messageText: a.outreachMessage
            });
            logApplication({
              company: j.company,
              role: j.title,
              url: j.url,
              status: 'MESSAGED_LEAD',
              outreachPerson: `${leads[pickedIdx].name} (${leads[pickedIdx].title})`
            });
          }
        } else {
          console.log(`[INFO] Yonetici bulunamadi.`);
        }
      } else if (choice === '4') {
        console.log(`[INFO] Atlandi.`);
      }
    }

    return;
  }

  if (command === 'report') {
    const dataPath = path.join(__dirname, 'data/jobs_latest.json');
    if (!fs.existsSync(dataPath)) {
      console.log(`\n[INFO] Taranmis ilan verisi bulunamadi. Once: node cli.js scan`);
      return;
    }

    generateMarkdownReport();
    console.log(`\n[SUCCESS] Guncel Markdown raporu olusturuldu: REPORT.md`);

    const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`\nSON TARANAN ILANLAR RAPORU (${jobs.length} Ilan)\n`);

    jobs.forEach((j, index) => {
      const a = j.analysis;
      const statusLabel = a.isGhostRisk ? '[GHOST RISKI]' : '[UYGUN]';
      
      console.log(`----------------------------------------------------------------`);
      console.log(`#${index + 1} | Skor: %${a.score} ${statusLabel}`);
      console.log(`Pozisyon : ${j.title} @ ${j.company}`);
      console.log(`Konum    : ${j.meta}`);
      console.log(`Tur      : ${j.isEasyApply ? 'Kolay Basvuru (Easy Apply)' : 'Sirket Dis Linki'}`);
      console.log(`Eslenen  : ${a.matchedSkills.join(', ') || 'Temel mobil stack'}`);
      console.log(`Proje    : ${a.recommendedProject}`);

      if (a.redFlags.length > 0 || a.warnings.length > 0) {
        console.log(`Uyarilar : ${[...a.redFlags, ...a.warnings].join(' | ')}`);
      }

      console.log(`\nIletisim Notu:`);
      console.log(`"""\n${a.outreachMessage}\n"""`);
      console.log(`----------------------------------------------------------------\n`);
    });

    return;
  }

  if (command === 'track') {
    const apps = getApplications();
    console.log(`\nTAKIP EDILEN BASVURULAR (${apps.length} Kayit)\n`);
    if (apps.length === 0) {
      console.log(`Kayitli basvuru bulunmuyor.`);
      return;
    }
    apps.forEach((a, i) => {
      console.log(`${i + 1}. [${a.status}] ${a.role} @ ${a.company} (${new Date(a.appliedAt).toLocaleDateString()})`);
      if (a.outreachPerson) console.log(`   Iletisim: ${a.outreachPerson}`);
      if (a.notes) console.log(`   Not: ${a.notes}`);
    });
    return;
  }

  console.log(`\nKullanim:`);
  console.log(`  node cli.js check              -> Profil, CV ve Chrome baglantisini test eder`);
  console.log(`  node cli.js scan [rol]         -> LinkedIn'i arka planda tarar ve listeler`);
  console.log(`  node cli.js review             -> Ilanlari tek tek inceleyip onaylananlara basvurur`);
  console.log(`  node cli.js report             -> Taranan tum ilanlari ve hazir mesajlari listeler`);
  console.log(`  node cli.js track              -> Yapilan basvurulari ve takip durumunu gosterir\n`);
}

main().catch(console.error);
