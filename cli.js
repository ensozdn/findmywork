import { isChromeDebuggingOpen, ensureChromeReady } from './modules/chromeLauncher.js';
import { scanLinkedInJobs } from './modules/linkedInScout.js';
import { findHiringManagers } from './modules/hiringManagerScout.js';
import { autofillCurrentPage } from './modules/formAutofill.js';
import { getApplications, logApplication } from './modules/tracker.js';
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`\n======================================================`);
  console.log(`🎯  JOB HUNTER AGENT (Can Değer Stratejisi & AI Pipeline)`);
  console.log(`======================================================`);

  if (command === 'check') {
    console.log(`\n1. Profil Kontrolü:`);
    const profilePath = path.join(__dirname, 'config/profile.json');
    if (fs.existsSync(profilePath)) {
      const p = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      console.log(`  ✅ Profil yüklendi: ${p.personal.full_name} (${p.personal.title})`);
      console.log(`  🎯 Hedef Roller: ${p.preferences.target_roles.join(', ')}`);
      console.log(`  ⭐ Öne Çıkan Projeler: ${p.highlight_projects.map(pr => pr.name).join(', ')}`);
    } else {
      console.log(`  ❌ profile.json bulunamadı!`);
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
      console.log(`\n❌ Chrome debug modunda açık değil!`);
      console.log(`Terminalde şu komutla Chrome'u başlatabilirsin:\n`);
      console.log(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &\n`);
      return;
    }

    console.log(`\n🚀 "${keyword}" anahtar kelimesiyle tarama başlatılıyor...`);
    try {
      await scanLinkedInJobs({
        keyword,
        maxJobs: 10,
        remoteOnly: false
      });
      console.log(`\nRaporu incelemek için: node cli.js report`);
    } catch (e) {
      console.error(`\n❌ Tarama hatası:`, e.message);
    }
    return;
  }

  if (command === 'lead') {
    const company = args[1];
    if (!company) {
      console.log(`\nKullanım: node cli.js lead "Şirket Adı"`);
      return;
    }

    const isChromeReady = await isChromeDebuggingOpen();
    if (!isChromeReady) {
      console.log(`\n❌ Chrome debug modunda açık değil! Port: 9222`);
      return;
    }

    const leads = await findHiringManagers({ companyName: company });
    console.log(`\n👔 [${company}] İçin Bulunan Karar Vericiler / İK:\n`);
    leads.forEach((l, idx) => {
      console.log(`${idx + 1}. ${l.name} - ${l.title}`);
      console.log(`   Profil: ${l.profileUrl}\n`);
    });
    return;
  }

  if (command === 'autofill') {
    const isChromeReady = await isChromeDebuggingOpen();
    if (!isChromeReady) {
      console.log(`\n❌ Chrome debug modunda açık değil! Port: 9222`);
      return;
    }

    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0]?.pages().slice(-1)[0];
    if (!page) {
      console.log(`Açık sekme bulunamadı!`);
      return;
    }

    console.log(`Şu anki aktif sekme: ${page.url()}`);
    await autofillCurrentPage(page);
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
      console.log(`Eşleşen Yetkinlikler: ${a.matchedSkills.join(', ') || 'Temel yazılım'}`);
      console.log(`Öne Çıkarılan Proje : ${a.recommendedProject}`);

      if (a.redFlags.length > 0 || a.warnings.length > 0) {
        console.log(`Uyarılar: ${[...a.redFlags, ...a.warnings].join(' | ')}`);
      }

      console.log(`\n💬 CAN DEĞER TARZI İLETİŞİM MESAJI (Hiring Manager / İK İçin):`);
      console.log(`"""\n${a.outreachMessage}\n"""`);
      console.log(`\n📝 ATS İÇİN ÖZEL CV MADDELERİ:`);
      a.atsBullets.forEach(b => console.log(`  • ${b}`));
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
  console.log(`  node cli.js check              -> Profil ve Chrome bağlantısını test eder`);
  console.log(`  node cli.js scan [rol]         -> Belirtilen rol için LinkedIn'i tarar & analiz eder`);
  console.log(`  node cli.js report             -> Taranan ilanları ve hazır mesajları gösterir`);
  console.log(`  node cli.js lead "Şirket Adı"  -> İlgili şirketteki Engineering Manager / İK'yı bulur`);
  console.log(`  node cli.js autofill           -> Açık olan iş başvuru formunu tek tıkla otomatik doldurur`);
  console.log(`  node cli.js track              -> Yapılan başvuruları ve durumlarını listeler\n`);
}

main().catch(console.error);
