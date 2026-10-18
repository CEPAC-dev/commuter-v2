import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const lintPath = path.join(root, 'audit-reports', 'lint.json');
const outPath = path.join(root, 'audit-reports', 'lint-summary.json');

const data = JSON.parse(fs.readFileSync(lintPath, 'utf8'));
const results = Array.isArray(data) ? data : data.results || [];
const folderCounts = { src: 0, scripts: 0, tests: 0, other: 0 };
const ruleCounts = new Map();
let totalErrors = 0;
let totalWarnings = 0;

for (const result of results) {
  const filePath = result.filePath || result.file || '';
  const norm = filePath.replace(/\\/g, '/');
  let folder = 'other';
  if (norm.startsWith(path.join(root, 'src').replace(/\\/g, '/'))) folder = 'src';
  else if (norm.startsWith(path.join(root, 'scripts').replace(/\\/g, '/'))) folder = 'scripts';
  else if (norm.startsWith(path.join(root, 'tests').replace(/\\/g, '/'))) folder = 'tests';
  if (norm.startsWith('/')) {
    if (norm.includes('/src/')) folder = 'src';
    else if (norm.includes('/scripts/')) folder = 'scripts';
    else if (norm.includes('/tests/')) folder = 'tests';
  }
  const messages = result.messages || [];
  for (const msg of messages) {
    const level = msg.severity === 2 ? 'error' : 'warning';
    if (level === 'error') totalErrors += 1;
    else totalWarnings += 1;
    folderCounts[folder] += 1;
    const rule = msg.ruleId || 'UNKNOWN';
    ruleCounts.set(rule, (ruleCounts.get(rule) || 0) + 1);
  }
}

const summary = {
  totalErrors,
  totalWarnings,
  totalIssues: totalErrors + totalWarnings,
  byFolder: folderCounts,
  byRule: [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ruleId, count]) => ({ ruleId, count }))
};

fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary, null, 2));
