import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesPath = path.join(__dirname, '../templates/messages.json');
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

export function classifyPersona(title = '') {
  const t = title.toLowerCase();

  if (
    t.includes('founder') ||
    t.includes('co-founder') ||
    t.includes('ceo') ||
    t.includes('kurucu') ||
    t.includes('managing partner') ||
    t.includes('general manager')
  ) {
    return {
      type: 'founder',
      label: 'Kurucu / C-Level'
    };
  }

  if (
    t.includes('cto') ||
    t.includes('vp of engineering') ||
    t.includes('head of engineering') ||
    t.includes('engineering manager') ||
    t.includes('tech lead') ||
    t.includes('team lead') ||
    t.includes('architect') ||
    t.includes('principal') ||
    t.includes('lead engineer') ||
    t.includes('lead developer')
  ) {
    return {
      type: 'tech_lead',
      label: 'Teknik Lider / Muhendislik Yoneticisi'
    };
  }

  if (
    t.includes('talent') ||
    t.includes('recruiter') ||
    t.includes('recruitment') ||
    t.includes('human resources') ||
    t.includes('hr') ||
    t.includes('ik') ||
    t.includes('people') ||
    t.includes('ise alim')
  ) {
    return {
      type: 'recruiter',
      label: 'IK / Ise Alim Uzmani'
    };
  }

  if (
    t.includes('engineer') ||
    t.includes('developer') ||
    t.includes('yazilimci')
  ) {
    return {
      type: 'peer_developer',
      label: 'Takimdaki Yazilimci'
    };
  }

  return {
    type: 'general',
    label: 'Ilgili Yetkili'
  };
}

export function generatePersonaMessage({
  title = '',
  fullName = '',
  company = '',
  role = '',
  matchedSkills = []
} = {}) {
  const persona = classifyPersona(title);
  const firstName = fullName ? fullName.trim().split(' ')[0] : 'Yetkili';
  const cleanCompany = company.trim() || 'Sirketiniz';
  const cleanRole = role.trim() || 'Software Engineer';
  const skillsStr = matchedSkills.slice(0, 3).join(', ') || 'TypeScript ve NestJS';

  let templateStr = templates.cold_outreach[persona.type] || templates.cold_outreach.general;

  let message = templateStr
    .replace(/\{\{name\}\}/g, firstName)
    .replace(/\{\{company\}\}/g, cleanCompany)
    .replace(/\{\{role\}\}/g, cleanRole)
    .replace(/\{\{skills\}\}/g, skillsStr);

  if (message.length > 295) {
    message = message.slice(0, 290) + '...';
  }

  return {
    personaType: persona.type,
    personaLabel: persona.label,
    firstName,
    message,
    charLength: message.length
  };
}

