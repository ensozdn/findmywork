import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { chromium } from 'playwright-core';
import { performEasyApply } from './easyApply.js';
import { logApplication } from './tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../config/telegram.json');
const jobsPath = path.join(__dirname, '../data/jobs_latest.json');
const cvPath = path.join(__dirname, '../config/resume.pdf');

function getTelegramConfig() {
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function callTelegramApi(endpoint, body) {
  const cfg = getTelegramConfig();
  if (!cfg || !cfg.bot_token) return Promise.reject(new Error('Telegram token bulunamadi'));

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${cfg.bot_token}/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ ok: false, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function sendTelegramAlert(text, replyMarkup = null) {
  const cfg = getTelegramConfig();
  if (!cfg || !cfg.enabled || !cfg.chat_id) return null;

  const payload = {
    chat_id: cfg.chat_id,
    text,
    parse_mode: 'HTML'
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return callTelegramApi('sendMessage', payload);
}

export async function notifyJob(job, jobIndex) {
  const cfg = getTelegramConfig();
  if (!cfg || !cfg.enabled) return;

  const a = job.analysis;
  if (a.score < (cfg.min_score_threshold || 45)) return;

  const title = `<b>[YENI ILAN - %${a.score} UYUM]</b>`;
  const pos = `<b>Pozisyon:</b> ${job.title}`;
  const comp = `<b>Sirket:</b> ${job.company}`;
  const type = `<b>Tur:</b> ${job.isEasyApply ? 'Easy Apply' : 'Dis Link'}`;
  const skills = `<b>Eslenenler:</b> ${a.matchedSkills.slice(0, 5).join(', ') || 'Temel Stack'}`;
  const persona = `<b>Hedef Persona:</b> ${a.personaLabel || 'Genel'}`;

  const messageText = `${title}\n\n${pos}\n${comp}\n${type}\n${skills}\n${persona}`;

  const keyboardButtons = [];

  if (job.isEasyApply) {
    keyboardButtons.push([
      { text: 'Basvur (Easy Apply)', callback_data: `apply:${jobIndex}` }
    ]);
  }

  keyboardButtons.push([
    { text: 'Mesaj Notunu Gor', callback_data: `msg:${jobIndex}` },
    { text: 'Ilana Git', url: job.url }
  ]);

  keyboardButtons.push([
    { text: 'Pas Gec', callback_data: `skip:${jobIndex}` }
  ]);

  const replyMarkup = {
    inline_keyboard: keyboardButtons
  };

  return sendTelegramAlert(messageText, replyMarkup);
}

export async function startTelegramListener() {
  const cfg = getTelegramConfig();
  if (!cfg || !cfg.enabled) {
    console.log('[WARN] Telegram bot aktif degil.');
    return;
  }

  console.log('[INFO] Telegram onay dinleyicisi baslatildi...');
  let offset = 0;

  while (true) {
    try {
      const res = await callTelegramApi('getUpdates', {
        offset,
        timeout: 20
      });

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;

          if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function handleCallbackQuery(cb) {
  const data = cb.data || '';
  const [action, idxStr] = data.split(':');
  const jobIdx = parseInt(idxStr, 10);

  if (!fs.existsSync(jobsPath)) {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Ilan verisi bulunamadi.'
    });
    return;
  }

  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  const targetJob = jobs[jobIdx];

  if (!targetJob) {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Ilan sirasi bulunamadi.'
    });
    return;
  }

  if (action === 'apply') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Basvuru baslatiliyor...'
    });

    try {
      const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      const context = browser.contexts()[0];
      const page = await context.newPage();
      await page.goto(targetJob.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const res = await performEasyApply(page, cvPath);
      if (res.success) {
        logApplication({
          company: targetJob.company,
          role: targetJob.title,
          url: targetJob.url,
          status: 'APPLIED_VIA_TELEGRAM',
          notes: 'Telegram onayi ile basvuruldu'
        });
        await sendTelegramAlert(`<b>[BASARILI]</b> ${targetJob.company} - ${targetJob.title} basvurusu tamamlandi.`);
      } else {
        await sendTelegramAlert(`<b>[UYARI]</b> ${targetJob.company} basvurusu tamamlanamadi: ${res.reason}`);
      }
    } catch (e) {
      await sendTelegramAlert(`<b>[HATA]</b> Basvuru sirasinda hata: ${e.message}`);
    }
  } else if (action === 'msg') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Mesaj gonderildi.'
    });

    const msg = targetJob.analysis.outreachMessage;
    await sendTelegramAlert(`<b>Iletisim Notu (${targetJob.analysis.personaLabel}):</b>\n\n<code>${msg}</code>`);
  } else if (action === 'skip') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'Pas gecildi.'
    });
    await sendTelegramAlert(`<b>[BILGI]</b> ${targetJob.company} ilani atlandi.`);
  }
}
