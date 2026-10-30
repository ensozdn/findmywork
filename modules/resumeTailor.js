import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilePath = path.join(__dirname, '../config/profile.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

export function generateTailoredResumeMarkdown(job) {
  const p = profile.personal;
  const matched = job.analysis?.matchedSkills || [];
  const primarySkills = matched.slice(0, 4).join(', ') || 'TypeScript, NestJS, Next.js, PostgreSQL';

  const slug = `${job.company}_${job.title}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const targetDir = path.join(__dirname, '../data/tailored_resumes');
  const mdPath = path.join(targetDir, `${slug}_CV.md`);

  let md = `# ${p.full_name}\n`;
  md += `**${p.title}** | ${p.location} | ${p.phone} | ${p.email}\n`;
  md += `[LinkedIn](${p.linkedin_url}) | [GitHub](${p.github_url})\n\n`;
  md += `---\n\n`;

  md += `## PROFESSIONAL SUMMARY\n`;
  md += `Software Engineer with strong production experience in building scalable full-stack applications and event-driven architectures. Specialized in ${primarySkills}, microservices, and AI workflow integrations. Proven track record at Emlak24 and Pro Sicht delivering high-performance APIs and reactive frontends tailored for enterprise requirements.\n\n`;

  md += `## CORE TECHNICAL SKILLS\n`;
  const skillsList = [
    `**Targeted Skills:** ${primarySkills}`,
    `**Languages:** ${profile.skills.languages.join(', ')}`,
    `**Frameworks & Tools:** ${profile.skills.frameworks_and_tools.join(', ')}`,
    `**Databases & Caching:** ${profile.skills.databases_and_caching.join(', ')}`,
    `**Architecture & Messaging:** ${profile.skills.architecture_and_messaging.join(', ')}`,
    `**DevOps & Cloud:** ${profile.skills.cloud_and_devops.join(', ')}`
  ];
  md += skillsList.join('\n\n') + `\n\n`;

  md += `## WORK EXPERIENCE\n\n`;
  profile.experience.forEach(exp => {
    md += `### ${exp.role} - ${exp.company} (${exp.location}) | ${exp.period}\n`;
    exp.highlights.forEach(h => {
      md += `- ${h}\n`;
    });
    md += `\n`;
  });

  md += `## EDUCATION\n`;
  md += `- **${profile.education.degree}** - ${profile.education.institution} (${profile.education.period})\n`;

  fs.writeFileSync(mdPath, md, 'utf8');
  return { mdPath, slug };
}

export async function exportTailoredResumePdf(job, cdpEndpoint = 'http://127.0.0.1:9222') {
  const { mdPath, slug } = generateTailoredResumeMarkdown(job);
  const pdfPath = path.join(__dirname, `../data/tailored_resumes/${slug}_CV.pdf`);

  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; line-height: 1.45; color: #111; margin: 30px; }
h1 { font-size: 18px; margin: 0 0 4px; text-transform: uppercase; }
h2 { font-size: 12px; margin: 12px 0 6px; border-bottom: 1px solid #333; padding-bottom: 2px; text-transform: uppercase; }
h3 { font-size: 11px; margin: 8px 0 3px; }
p, ul { margin: 3px 0; padding-left: 16px; }
li { margin-bottom: 3px; }
hr { border: none; border-top: 1px solid #999; margin: 6px 0 10px; }
</style>
</head>
<body>
${mdContent.replace(new RegExp('^# (.*$)', 'gim'), '<h1>$1</h1>')
           .replace(new RegExp('^## (.*$)', 'gim'), '<h2>$1</h2>')
           .replace(new RegExp('^### (.*$)', 'gim'), '<h3>$1</h3>')
           .replace(new RegExp('\\*\\*(.*?)\\*\\*', 'gim'), '<strong>$1</strong>')
           .replace(new RegExp('^- (.*$)', 'gim'), '<li>$1</li>')}
</body>
</html>`;

  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  await page.setContent(htmlContent, { waitUntil: 'load' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
  });

  await page.close();
  console.log(`[SUCCESS] ATS Optimize PDF CV olusturuldu: ${path.basename(pdfPath)}`);
  return { pdfPath, mdPath };
}
