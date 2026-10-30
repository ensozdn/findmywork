import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/applications.json');

function loadTracker() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveTracker(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

export function logApplication({ company, role, url, status = 'APPLIED', notes = '', outreachPerson = '' }) {
  const list = loadTracker();
  const existing = list.find(item => item.company.toLowerCase() === company.toLowerCase() && item.role.toLowerCase() === role.toLowerCase());
  
  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    if (notes) existing.notes = notes;
    saveTracker(list);
    return { updated: true, entry: existing };
  }

  const newEntry = {
    id: Date.now().toString(),
    company,
    role,
    url,
    status,
    notes,
    outreachPerson,
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  list.push(newEntry);
  saveTracker(list);
  return { created: true, entry: newEntry };
}

export function getApplications() {
  return loadTracker();
}
