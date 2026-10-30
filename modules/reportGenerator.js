import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generateMarkdownReport() {
  const dataPath = path.join(__dirname, '../data/jobs_latest.json');
  const reportPath = path.join(__dirname, '../REPORT.md');

  if (!fs.existsSync(dataPath)) {
    return { ok: false, message: 'data/jobs_latest.json bulunamadi.' };
  }

  const jobs = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  let md = `# Son Taranan Is Ilanlari Raporu\n\n`;
  md += `Toplam taranan ilan sayisi: **${jobs.length}** | Son guncelleme: **${new Date().toLocaleString('tr-TR')}**\n\n`;

  md += `## Ozet Tablo\n\n`;
  md += `| # | Skor | Pozisyon | Sirket | Basvuru Turu | Durum | Link |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  jobs.forEach((j, idx) => {
    const a = j.analysis;
    const badge = a.isGhostRisk ? '**RISKLI**' : '**UYGUN**';
    const applyType = j.isEasyApply ? 'Easy Apply' : 'Dis Link';
    const link = j.url ? `[Ilana Git](${j.url})` : '-';
    md += `| ${idx + 1} | %${a.score} | ${j.title} | ${j.company} | ${applyType} | ${badge} | ${link} |\n`;
  });

  md += `\n---\n\n## Detayli Ilan Analizleri ve Hazir Mesajlar\n\n`;

  jobs.forEach((j, idx) => {
    const a = j.analysis;
    md += `### ${idx + 1}. ${j.title} - ${j.company} (Uyum: %${a.score})\n\n`;
    md += `- **Basvuru Turu:** ${j.isEasyApply ? 'Easy Apply (Kolay Basvuru)' : 'Sirket Kariyer Sayfasi'}\n`;
    md += `- **Ilan Linki:** ${j.url}\n`;
    md += `- **Eslenen Yetkinlikler:** ${a.matchedSkills.join(', ') || 'Temel yazilim gereksinimleri'}\n`;
    md += `- **One Cikarilan Deneyim:** ${a.recommendedProject}\n`;

    if (a.redFlags.length > 0 || a.warnings.length > 0) {
      md += `- **Uyarilar:** ${[...a.redFlags, ...a.warnings].join(' | ')}\n`;
    }

    md += `\n**Can Deger Tarzi Yonlendirici Mesaj (IK / Yonetici Icin):**\n\n`;
    md += `\`\`\`text\n${a.outreachMessage}\n\`\`\`\n\n`;
    md += `---\n\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf8');
  return { ok: true, reportPath };
}
