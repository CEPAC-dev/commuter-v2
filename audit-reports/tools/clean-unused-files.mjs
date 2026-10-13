import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const knipPath = path.join(root, 'audit-reports', 'knip.json');
const outPath = path.join(root, 'audit-reports', 'UNUSED_FILES_EVIDENCE.md');

const excludedPrefixes = ['node_modules/', '.next/', 'audit-reports/', '.git/', 'docs/', 'public/'];
const excludedExact = new Set(['package.json', 'package-lock.json', 'PROJECT_MAP.md', 'tsconfig.tsbuildinfo']);
const fileExt = /\.(ts|tsx|js|jsx|mjs|cjs|css|json)$/;

function normalize(p) { return p.replace(/\\/g, '/'); }
function folderName(file) {
  const p = normalize(file);
  if (p.startsWith('src/')) return 'src';
  if (p.startsWith('scripts/')) return 'scripts';
  if (p.startsWith('tests/')) return 'tests';
  if (p.startsWith('public/')) return 'public';
  if (p.startsWith('app/')) return 'app';
  if (p.startsWith('components/')) return 'components';
  if (p.startsWith('lib/')) return 'lib';
  if (p.startsWith('models/')) return 'models';
  if (p.startsWith('types/')) return 'types';
  return 'other';
}

function listRepoFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = normalize(path.relative(root, abs));
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'audit-reports'].includes(entry.name)) continue;
      out.push(...listRepoFiles(abs));
      continue;
    }
    if (entry.isFile()) {
      if (rel === 'package.json' || rel === 'package-lock.json' || rel === 'PROJECT_MAP.md') continue;
      if (rel.endsWith('tsconfig.tsbuildinfo')) continue;
      if (rel.startsWith('node_modules/') || rel.startsWith('.next/') || rel.startsWith('audit-reports/') || rel.startsWith('.git/')) continue;
      if (rel.startsWith('docs/')) continue;
      out.push(abs);
    }
  }
  return out;
}

function uniqueUnusedFiles() {
  const data = JSON.parse(fs.readFileSync(knipPath, 'utf8'));
  const uniq = new Set();
  for (const issue of data.issues || []) {
    const files = Array.isArray(issue.files) ? issue.files : [];
    if (!files.length) continue;
    for (const item of files) {
      const name = typeof item === 'string' ? item : item && item.name;
      if (name) uniq.add(normalize(name));
    }
  }
  return [...uniq].sort();
}

function buildSearchTerms(target) {
  const p = normalize(target);
  const base = path.basename(p);
  const baseNoExt = base.replace(/\.[^.]+$/, '');
  const terms = new Set();
  terms.add(p);
  terms.add(base);
  terms.add(baseNoExt);
  terms.add(base.replace(/\.[^.]+$/, ''));
  if (p.startsWith('src/')) {
    terms.add(`@/${p.replace(/^src\//, '')}`);
    terms.add(`@/${p.replace(/^src\//, '').replace(/\.[^.]+$/, '')}`);
    terms.add(`./${base}`);
  }
  if (p.includes('/')) {
    const rel = p.replace(/^\.?\//, '');
    terms.add(rel);
    terms.add(rel.replace(/\.[^.]+$/, ''));
    terms.add(rel.split('/').slice(-2).join('/'));
  }
  return [...terms].filter(Boolean);
}

function gatherEvidence(target) {
  const repoFiles = listRepoFiles(root);
  const targetNorm = normalize(target);
  const searchTerms = buildSearchTerms(targetNorm);
  const results = [];
  const seen = new Set();

  for (const abs of repoFiles) {
    const rel = normalize(path.relative(root, abs));
    const isExcluded = excludedExact.has(rel) || rel.startsWith('docs/') || rel.endsWith('tsconfig.tsbuildinfo');
    if (isExcluded) continue;
    if (rel === targetNorm) continue;
    if (!fileExt.test(rel) && !rel.endsWith('.config.js') && !rel.endsWith('.config.ts') && !rel.endsWith('.config.mjs') && !rel.endsWith('.config.cjs')) continue;
    try {
      const text = fs.readFileSync(abs, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowered = line.toLowerCase();
        let match = false;
        for (const term of searchTerms) {
          const needle = term.toLowerCase();
          if (!needle) continue;
          if (needle.includes('/') || needle.includes('.') || needle.includes('@')) {
            if (lowered.includes(needle)) { match = true; break; }
          }
          // file basename only if used in import/require strings or literal references
          if (lowered.includes(needle) && /(?:import|export|require|from|next\.|page|layout|route|dynamic|module|use|href|src=|path:|\"\s*\+\s*)/i.test(line)) {
            match = true; break;
          }
        }
        if (match) {
          const key = `${rel}:${i + 1}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push(`${rel}:${i + 1}`);
          }
        }
      }
    } catch {
      // ignore unreadable binary or generated files
    }
    if (results.length >= 3) break;
  }

  return results;
}

const files = uniqueUnusedFiles();
const table = ['| File | Folder | Verdict | Evidence |', '| --- | --- | --- | --- |'];
const counts = { SAFE_TO_DELETE: 0, NEEDS_CHECK: 0, FALSE_POSITIVE: 0 };
for (const file of files) {
  const evidence = gatherEvidence(file);
  let verdict = 'FALSE_POSITIVE';
  if (!evidence.length) verdict = 'SAFE_TO_DELETE';
  counts[verdict] += 1;
  table.push(`| ${file} | ${folderName(file)} | ${verdict} | ${evidence.length ? evidence.join('; ') : 'No real code references found'} |`);
}
fs.writeFileSync(outPath, `${table.join('\n')}\n\nTotals: SAFE_TO_DELETE=${counts.SAFE_TO_DELETE}; NEEDS_CHECK=${counts.NEEDS_CHECK}; FALSE_POSITIVE=${counts.FALSE_POSITIVE}.\n`, 'utf8');
console.log(JSON.stringify({ totalFiles: files.length, counts }, null, 2));
console.log(`Wrote ${normalize(path.relative(root, outPath))}`);
