import { isChromeDebuggingOpen, ensureChromeReady } from './modules/chromeLauncher.js';
import { scanLinkedInJobs } from './modules/linkedInScout.js';
import { findHiringManagers } from './modules/hiringManagerScout.js';
import { autofillCurrentPage } from './modules/formAutofill.js';
import { performEasyApply } from './modules/easyApply.js';
import { sendOrDraftRecruiterMessage } from './modules/recruiterMessaging.js';
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
  console.log(`🎯  FINDMYWORK (Can Değer Stratejisi & AI Pipeline)`);
  console.log(`======================================================`);

  if (command === 'check') {
    console.log(`\n1. Profil & CV Kontrolü:`);
    const profilePath = path.join(__dirname, 'config/profile.json');
    const cvPath = path.join(__dirname, 'config/resume.pdf');
    
    if (fs.existsSync(profilePath)) {
      const p = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      console.log(`  ✅ Profil: ${p.personal.full_name} (${p.personal.title})`);
      console.log(`  🎯 Hedef Roller: ${p.preferences.target_roles.join(', ')}`);
      console.log(`  ⭐ Projeler: ${p.highlight_projects.map(pr => pr.name).join(', ')}`);
    }

    if (fs.existsSync(cvPath)) {
      console.log(`  📎 Hazır CV (PDF): Mevcut (${cvPath})`);
    } else {
      console.log(`  ℹ️  Hazır CV: config/resume.pdf bulunamadı (Hazır CV'ni bu konuma koyabilirsin).`);
    }

    console.log(`\n2. Chrome Bağlantı Kontrolü:`);
    const chromeStatus = await ensureChromeReady();
    if (chromeStatus.ok) {
      console.log(`  ✅ ${chromeStatus.message}`);
    } else {
      console.log(`  ⚠️  ${chromeStatus.message}`);
      console.log(`  👉 ${chromeStatus.hint}`);
    }
    return;
  }

  if (command === 'scan') {
    const keyword = args[1] || 'React Native';
    const isChromeReady = await isChromeDebuggingOpen();
    if (!isChromeReady) {
      console.log(`\n❌ Chrome debug modunda açık değil! Port: 9222`);
      console.log(`Terminalde şu komutla başlatabilirsin:\n`);
      console.log(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &\n`);
      return;
    }

    console.log(`\n🚀 "${keyword}" anahtar kelimesiyle tarama başlatılıyor...`);
    try {
      await scanLinkedInJobs({
        keyword,
        maxJobs: 15,
        remoteOnly: false
      });
      console.log(`\n👉 Şimdi onaylayıp başvurmak için: node cli.js review`);
    } catch (e) {
      console.error(`\n❌ Tarama hatası:`, e.message);
    }
    return;
  }

  if (command === 'review') {
    const dataPath = path.join(__dirname, 'data/jobs_latest.json');
    if (!fs.existsSync(dataPath)) {
      console.log(`\nHenüz taranmış ilan verisi bulunamadı. Önce: node cli.js scan`);
      return;
    }

    const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const appliedList = getApplications();
    const appliedUrls = new Set(appliedList.map(a => a.url));
    const cvPath = path.join(__dirname, 'config/resume.pdf');

    const pendingJobs = jobs.filter(j => !appliedUrls.has(j.url));

    console.log(`\n📋 İNCELENMEYİ BEKLEYEN ${pendingJobs.length} İLAN VAR.\n`);
    if (pendingJobs.length === 0) {
      console.log(`Tüm taranan ilanlar incelenmiş veya başvurulmuş!`);
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
      console.log(`[${i + 1}/${pendingJobs.length}] Skor: %${a.score} ${a.isGhostRisk ? '⚠️ [GHOST RİSKİ]' : '✨ [YÜKSEK UYUM]'}`);
      console.log(`Pozisyon : ${j.title} @ ${j.company}`);
      console.log(`Konum    : ${j.meta}`);
      console.log(`Tür      : ${j.isEasyApply ? '⚡ Kolay Başvuru (Easy Apply)' : '🔗 Şirket Dış Linki'}`);
      console.log(`Eşleşenler: ${a.matchedSkills.join(', ') || 'Temel Mobil Yetkinlikler'}`);
      console.log(`URL      : ${j.url}`);
      console.log(`----------------------------------------------------------------`);
      console.log(`💬 CAN DEĞER İLETİŞİM NOTU (İK / Hiring Manager İçin):`);
      console.log(`"${a.outreachMessage.split('\n')[0]}..."`);
      console.log(`----------------------------------------------------------------`);

      console.log(`Ne yapmak istersin?`);
      console.log(`  [1] ⚡ Onayla ve Otomatik Başvur (Easy Apply)`);
      console.log(`  [2] 🌐 Chrome'da Aç (İncele veya Dış Linkten Başvur)`);
      console.log(`  [3] 💬 İK / Hiring Manager'a Mesaj / Bağlantı Notu Hazırla`);
      console.log(`  [4] ⏩ Pas Geç (Atla)`);
      console.log(`  [q] ❌ Çıkış`);

      const choice = await askQuestion(`Seçimin (1/2/3/4/q): `);

      if (choice === 'q' || choice === 'Q') break;

      if (choice === '1') {
        if (!isChromeReady || !browser) {
          console.log(`Chrome bağlı değil! Lütfen Chrome'u debug modunda aç.`);
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
            notes: 'Otomatik Easy Apply ile başvuruldu'
          });
          console.log(`🎉 Başvuru kaydedildi ve takip listene eklendi!`);
        } else {
          console.log(`⚠️ Başvuru tamamlanamadı (${res.reason}). Sayfa sekmede açık bırakıldı.`);
        }
      } else if (choice === '2') {
        if (browser) {
          const context = browser.contexts()[0];
          const page = await context.newPage();
          await page.goto(j.url);
          console.log(`🔗 Sekme Chrome'da açıldı.`);
        }
      } else if (choice === '3') {
        if (j.hiringManagerName) {
          console.log(`İlanı yayınlayan: ${j.hiringManagerName}`);
        }
        // Şirketin liderlerini bulup mesaj hazırlama modülü
        const leads = await findHiringManagers({ companyName: j.company });
        if (leads.length > 0) {
          console.log(`\nBulunan Yöneticiler:`);
          leads.forEach((l, idx) => console.log(`  ${idx + 1}. ${l.name} (${l.title})`));
          const leadPick = await askQuestion(`Kime mesaj notu hazırlansın? (1-${leads.length} / atla: Enter): `);
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
          console.log(`Yönetici bulunamadı.`);
        }
      } else if (choice === '4') {
        console.log(`Atlandı.`);
      }
    }

    return;
  }

  if (command === 'report') {
    const dataPath = path.join(__dirname, 'data/jobs_latest.json');
    if (!fs.existsSync(dataPath)) {
      console.log(`\nHenüz taranmış ilan verisi bulunamadı. Önce: node cli.js scan`);
      return;
    }

    const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`\n📊 EN SON TARANAN İLANLAR RAPORU (${jobs.length} İlan)\n`);

    jobs.forEach((j, index) => {
      const a = j.analysis;
      const statusIcon = a.isGhostRisk ? '⚠️ [ŞÜPHELİ / GHOST]' : '✨ [YÜKSEK UYUM]';
      
      console.log(`----------------------------------------------------------------`);
      console.log(`#${index + 1} | Skor: %${a.score} ${statusIcon}`);
      console.log(`Pozisyon : ${j.title} @ ${j.company}`);
      console.log(`Konum/Meta: ${j.meta}`);
      console.log(`Başvuru Türü: ${j.isEasyApply ? '⚡ Kolay Başvuru (Easy Apply)' : '🔗 Şirket Sitesi'}`);
      console.log(`Eşleşen Yetkinlikler: ${a.matchedSkills.join(', ') || 'Temel mobil stack'}`);
      console.log(`Öne Çıkarılan Proje : ${a.recommendedProject}`);

      if (a.redFlags.length > 0 || a.warnings.length > 0) {
        console.log(`Uyarılar: ${[...a.redFlags, ...a.warnings].join(' | ')}`);
      }

      console.log(`\n💬 CAN DEĞER TARZI İLETİŞİM MESAJI (Hiring Manager / İK İçin):`);
      console.log(`"""\n${a.outreachMessage}\n"""`);
      console.log(`----------------------------------------------------------------\n`);
    });

    return;
  }

  if (command === 'track') {
    const apps = getApplications();
    console.log(`\n📋 TAKİP EDİLEN BAŞVURULAR (${apps.length} Kayıt)\n`);
    if (apps.length === 0) {
      console.log(`Henüz kayıtlı başvuru yok.`);
      return;
    }
    apps.forEach((a, i) => {
      console.log(`${i + 1}. [${a.status}] ${a.role} @ ${a.company} (${new Date(a.appliedAt).toLocaleDateString()})`);
      if (a.outreachPerson) console.log(`   İletişim: ${a.outreachPerson}`);
      if (a.notes) console.log(`   Not: ${a.notes}`);
    });
    return;
  }

  // Help display
  console.log(`\nKullanım:`);
  console.log(`  node cli.js check              -> Profil, CV ve Chrome bağlantısını test eder`);
  console.log(`  node cli.js scan [rol]         -> LinkedIn'i arka planda tarar ve listeler`);
  console.log(`  node cli.js review             -> 🎯 İlanları tek tek önüne getirir, onayladıklarına başvurur`);
  console.log(`  node cli.js report             -> Taranan tüm ilanları ve hazır mesajları listeler`);
  console.log(`  node cli.js track              -> Yapılan başvuruları ve takip durumunu gösterir\n`);
}

main().catch(console.error);
