import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilePath = path.join(__dirname, '../config/profile.json');
const templatesPath = path.join(__dirname, '../templates/messages.json');

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

/**
 * Evaluates a job listing for ghost indicators and ATS match against user's profile.
 */
export function analyzeJob(job) {
  const text = `${job.title} ${job.company} ${job.description || ''} ${job.meta || ''}`.toLowerCase();
  
  // 1. Ghost / Red Flag Heuristics (Can Değer - Anti-Fake filtresi)
  const redFlags = [];
  const warnings = [];

  if (job.applicantCount && job.applicantCount > 350) {
    warnings.push(`Yüksek başvuru sayısı (${job.applicantCount}+ aday). Erken başvuru avantajı kaçmış olabilir.`);
  }

  if (job.isReposted || text.includes('reposted') || text.includes('yeniden yayınlandı')) {
    warnings.push('İlan yeniden yayınlanmış (Reposted). Şirket uzun süredir kapatamadı veya data topluyor olabilir.');
  }

  if (text.includes('unpaid') || text.includes('gönüllü') || text.includes('ücretsiz')) {
    redFlags.push('Ücretsiz / Staj sömürüsü ibaresi içeriyor.');
  }

  // 2. Skill Match Scoring
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

  // Check some standard expected keywords for mobile roles that might be missing
  const commonTechs = ['GraphQL', 'CI/CD', 'Jest', 'Fastlane', 'Docker', 'Kotlin', 'Swift', 'Redux', 'Zustand'];
  commonTechs.forEach(tech => {
    if (new RegExp(`\\b${tech}\\b`, 'i').test(text) && !matchedSkills.includes(tech)) {
      missingKeywords.push(tech);
    }
  });

  // Calculate Match Score
  let score = 50; // base score if title matches target roles
  const titleLower = job.title.toLowerCase();
  const isTargetTitle = profile.preferences.target_roles.some(role => 
    titleLower.includes(role.toLowerCase().split(' ')[0])
  );

  if (isTargetTitle) score += 20;
  score += Math.min(matchedSkills.length * 5, 30);

  if (redFlags.length > 0) score -= 40;
  if (warnings.length > 0) score -= (warnings.length * 5);

  score = Math.max(10, Math.min(score, 98));

  // Determine which past project is most relevant to highlight
  let bestProject = profile.highlight_projects[0]; // Default: Trip Noute
  if (text.includes('audio') || text.includes('streaming') || text.includes('websocket') || text.includes('ses')) {
    bestProject = profile.highlight_projects[1]; // Convoy Radio
  }

  // 3. Generate Can Değer Style Outreach Message
  const primarySkillsStr = matchedSkills.slice(0, 3).join(', ') || 'React Native ve TypeScript';
  const outreachMessage = templates.cold_outreach.hiring_manager
    .replace('{{name}}', job.hiringManagerName || 'Yetkili')
    .replace('{{company}}', job.company || 'Şirketiniz')
    .replace('{{role}}', job.title)
    .replace('{{key_project}}', bestProject.name)
    .replace('{{core_skills}}', primarySkillsStr);

  // 4. Generate ATS Tailored Bullet Points
  const atsBullets = [
    `${bestProject.name} projesi kapsamında ${primarySkillsStr} ile production seviyesinde mobil mimari tasarımı ve optimizasyonu.`,
    `Sakarya Teknokent ve kurumsal projelerde modern state yönetimi, offline-first mimari ve performans odaklı geliştirme deneyimi.`,
    `İlanınızda belirtilen ${matchedSkills.slice(0, 4).join(', ') || 'modern mobil teknolojiler'} ile uçtan uca uygulama geliştirme ve mağaza dağıtım süreçleri.`
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

