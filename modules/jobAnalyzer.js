import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilePath = path.join(__dirname, '../config/profile.json');
const templatesPath = path.join(__dirname, '../templates/messages.json');

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

export function analyzeJob(job) {
  const text = `${job.title} ${job.company} ${job.description || ''} ${job.meta || ''}`.toLowerCase();
  
  const redFlags = [];
  const warnings = [];

  if (job.applicantCount && job.applicantCount > 350) {
    warnings.push(`Yuksek basvuru sayisi (${job.applicantCount}+ aday).`);
  }

  if (job.isReposted || text.includes('reposted') || text.includes('yeniden yayinlandi')) {
    warnings.push('Ilan yeniden yayinlanmis (Reposted).');
  }

  if (text.includes('unpaid') || text.includes('gonullu') || text.includes('ucretsiz')) {
    redFlags.push('Ucretsiz veya staj ibaresi iceriyor.');
  }

  const allUserSkills = [
    ...profile.skills.languages,
    ...profile.skills.frameworks_and_tools,
    ...profile.skills.databases_and_caching,
    ...profile.skills.architecture_and_messaging,
    ...profile.skills.testing_and_methodologies,
    ...profile.skills.ai_and_workflows,
    ...profile.skills.cloud_and_devops
  ];

  const matchedSkills = [];
  const missingKeywords = [];

  allUserSkills.forEach(skill => {
    const cleanSkill = skill.replace(/\s*\([^)]*\)/g, '');
    const regex = new RegExp(`\\b${cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      matchedSkills.push(skill);
    }
  });

  const commonKeywords = ['GraphQL', 'Kubernetes', 'CI/CD', 'Microservices', 'Elasticsearch', 'RabbitMQ'];
  commonKeywords.forEach(kw => {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(text) && !matchedSkills.includes(kw)) {
      missingKeywords.push(kw);
    }
  });

  let score = 50;
  const titleLower = job.title.toLowerCase();
  const isTargetTitle = profile.preferences.target_roles.some(role => 
    titleLower.includes(role.toLowerCase().split(' ')[0])
  );

  if (isTargetTitle) score += 20;
  score += Math.min(matchedSkills.length * 5, 30);

  if (redFlags.length > 0) score -= 40;
  if (warnings.length > 0) score -= (warnings.length * 5);

  score = Math.max(10, Math.min(score, 98));

  let relevantExp = profile.experience[0];
  if (/\bjava\b/i.test(text) || text.includes('spring')) {
    relevantExp = profile.experience[2];
  } else if (text.includes('vue') || text.includes('nuxt') || text.includes('comfyui') || text.includes('video')) {
    relevantExp = profile.experience[1];
  }

  const primarySkillsStr = matchedSkills.slice(0, 3).join(', ') || 'TypeScript, NestJS ve PostgreSQL';
  const outreachMessage = templates.cold_outreach.hiring_manager
    .replace('{{name}}', job.hiringManagerName || 'Yetkili')
    .replace('{{company}}', job.company || 'Sirketiniz')
    .replace('{{role}}', job.title)
    .replace('{{key_project}}', `${relevantExp.company} (${relevantExp.role})`)
    .replace('{{core_skills}}', primarySkillsStr);

  const atsBullets = [
    `${relevantExp.company} bunyesinde ${primarySkillsStr} ile production seviyesinde olceklenebilir mimari gelistirme.`,
    `NestJS, Next.js, Spring Boot ve PostgreSQL ile mikroservis ve RESTful API tasarimi.`,
    `Ilanda talep edilen ${matchedSkills.slice(0, 4).join(', ') || 'modern full-stack teknolojileri'} ile ucuca sistem entegrasyonu.`
  ];

  return {
    jobTitle: job.title,
    company: job.company,
    score,
    isGhostRisk: redFlags.length > 0 || warnings.length >= 2,
    redFlags,
    warnings,
    matchedSkills,
    missingKeywords,
    recommendedProject: `${relevantExp.company} (${relevantExp.role})`,
    outreachMessage,
    atsBullets
  };
}
