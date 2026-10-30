import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTelegramAlert } from './telegramBot.js';
import { getApplications } from './tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emailConfigPath = path.join(__dirname, '../config/email.json');
const dbPath = path.join(__dirname, '../data/applications.json');

export function classifyEmailContent(subject = '', body = '') {
  const text = `${subject} ${body}`.toLowerCase();

  const interviewKeywords = [
    'interview',
    'invitation',
    'mulakat',
    'gorusme',
    'screening call',
    'technical assessment',
    'next step',
    'next round',
    'congratulations',
    'shortlisted',
    'kodlama testi',
    'on gorusme'
  ];

  const rejectionKeywords = [
    'unfortunately',
    'not moving forward',
    'other candidates',
    'olumsuz',
    'baska adaylar',
    'regret to inform',
    'not selected',
    'we have decided not to',
    'uzulerek belirtmek',
    'pozisyon kapatilmis'
  ];

  for (const kw of interviewKeywords) {
    if (text.includes(kw)) {
      return {
        type: 'INTERVIEW',
        label: 'Mulakat / Ilerleme Daveti',
        matchedKeyword: kw
      };
    }
  }

  for (const kw of rejectionKeywords) {
    if (text.includes(kw)) {
      return {
        type: 'REJECTION',
        label: 'Standart Red Mektubu',
        matchedKeyword: kw
      };
    }
  }

  return {
    type: 'NEUTRAL',
    label: 'Genel Bilgilendirme / Diger',
    matchedKeyword: null
  };
}

export async function processIncomingEmail({ sender = '', subject = '', body = '' }) {
  const classification = classifyEmailContent(subject, body);
  if (classification.type === 'NEUTRAL') return null;

  const applications = getApplications();
  const lowerSender = sender.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  const matchedApp = applications.find(app => {
    const comp = app.company.toLowerCase();
    return lowerSender.includes(comp) || lowerSubject.includes(comp);
  });

  const companyName = matchedApp ? matchedApp.company : 'Bilinmeyen Sirket';

  if (matchedApp) {
    matchedApp.status = classification.type === 'INTERVIEW' ? 'INTERVIEW' : 'REJECTED';
    matchedApp.updatedAt = new Date().toISOString();
    matchedApp.notes = `${classification.label} alindi: ${subject}`;
    fs.writeFileSync(dbPath, JSON.stringify(applications, null, 2), 'utf8');
  }

  if (classification.type === 'INTERVIEW') {
    await sendTelegramAlert(
      `<b>[TEBRIKLER - MULAKAT DAVETI]</b>\n\n` +
      `<b>Sirket:</b> ${companyName}\n` +
      `<b>Konu:</b> ${subject}\n\n` +
      `Takip listeniz guncellendi. Detaylar icin e-postanizi kontrol edin!`
    );
  } else if (classification.type === 'REJECTION') {
    await sendTelegramAlert(
      `<b>[BASVURU DURUMU - RED]</b>\n\n` +
      `<b>Sirket:</b> ${companyName}\n` +
      `<b>Konu:</b> ${subject}\n\n` +
      `Takip listeniz 'REJECTED' olarak guncellendi.`
    );
  }

  return {
    company: companyName,
    type: classification.type,
    subject
  };
}

