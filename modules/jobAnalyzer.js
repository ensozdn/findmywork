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
    ...profile.skills.core,
    ...profile.skills.mobile,
    ...profile.skills.backend_and_data,
    ...profile.skills.devops_and_tools
  ];

  const matchedSkills = [];
  const missingKeywords = [];

  allUserSkills.forEach(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      matchedSkills.push(skill);
    }
  });

  const commonTechs = ['GraphQL', 'CI/CD', 'Jest', 'Fastlane', 'Docker', 'Kotlin', 'Swift', 'Redux', 'Zustand'];
  commonTechs.forEach(tech => {
    if (new RegExp(`\\b${tech}\\b`, 'i').test(text) && !matchedSkills.includes(tech)) {
      missingKeywords.push(tech);
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

  let bestProject = profile.highlight_projects[0];
  if (text.includes('audio') || text.includes('streaming') || text.includes('websocket') || text.includes('ses')) {
    bestProject = profile.highlight_projects[1];
  }

  const primarySkillsStr = matchedSkills.slice(0, 3).join(', ') || 'React Native ve TypeScript';
  const outreachMessage = templates.cold_outreach.hiring_manager
    .replace('{{name}}', job.hiringManagerName || 'Yetkili')
    .replace('{{company}}', job.company || 'Sirketiniz')
    .replace('{{role}}', job.title)
    .replace('{{key_project}}', bestProject.name)
    .replace('{{core_skills}}', primarySkillsStr);

  const atsBullets = [
    `${bestProject.name} projesi kapsaminda ${primarySkillsStr} ile production seviyesinde mobil mimari tasarimi.`,
    `Kurumsal projelerde modern state yonetimi, offline-first mimari ve performans odakli gelistirme deneyimi.`,
    `Ilanda belirtilen ${matchedSkills.slice(0, 4).join(', ') || 'modern mobil teknolojiler'} ile ucuca uygulama gelistirme.`
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
    recommendedProject: bestProject.name,
    outreachMessage,
    atsBullets
  };
}
