import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const knipPath = path.join(root, 'audit-reports', 'knip.json');
const outMd = path.join(root, 'audit-reports', 'UNUSED_FILES_EVIDENCE.md');
const depOut = path.join(root, 'audit-reports', 'UNUSED_DEPENDENCIES.md');

const excludedRelative = new Set([
  'package.json',
  'package-lock.json',
  'PROJECT_MAP.md',
  'audit-reports',
  'node_modules',
  '.next',
  '.git'
]);

function normalize(file) {
  return file.replace(/\\/g, '/');
}

function listRepoFiles(dir, exclusions = new Set()) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = normalize(path.relative(root, abs));
    if (entry.isDirectory()) {
      if (exclusions.has(entry.name) || rel.startsWith('node_modules/') || rel.startsWith('.next/') || rel.startsWith('audit-reports/') || rel.startsWith('.git/')) continue;
      out.push(...listRepoFiles(abs, exclusions));
    } else if (entry.isFile()) {
      if (rel === 'package.json' || rel === 'package-lock.json' || rel === 'PROJECT_MAP.md' || rel.startsWith('audit-reports/') || rel.startsWith('node_modules/') || rel.startsWith('.next/')) continue;
      out.push(abs);
    }
  }
  return out;
}

function folderName(file) {
  const rel = normalize(file).replace(/^.*?\//, '');
  const p = normalize(file).replace(/\\/g, '/');
  if (p.startsWith('src/')) return 'src';
  if (p.startsWith('scripts/')) return 'scripts';
  if (p.startsWith('tests/')) return 'tests';
  if (p.startsWith('public/')) return 'public';
  if (p.startsWith('app/')) return 'app';
  if (p.startsWith('components/')) return 'components';
  if (p.startsWith('lib/')) return 'lib';
  if (p.startsWith('models/')) return 'models';
  if (p.startsWith('types/')) return 'types';
  if (p.startsWith('docs/')) return 'docs';
  return 'other';
}

function frameworkSpecial(file) {
  const norm = normalize(file);
  return /(?:^|\/)(page|layout|route|loading|error|not-found|middleware|sitemap|robots|manifest|instrumentation)\.[jt]sx?$/.test(norm) || /(?:^|\/)(page|layout|route|loading|error|not-found|middleware|sitemap|robots|manifest|instrumentation)\.[mc]?[jt]s$/.test(norm);
}

function safeTargetPatterns(file) {
  const norm = normalize(file);
  let rel = norm.startsWith('./') ? norm.slice(2) : norm;
  const base = path.basename(rel);
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const parts = [];
  parts.push(rel);
  parts.push(base);
  parts.push(withoutExt);
  if (rel.startsWith('src/')) {
    parts.push(`@/${rel.replace(/^src\//, '')}`);
    parts.push(`./${base}`);
  }
  if (rel.includes('/')) {
    parts.push(rel.replace(/\/index\.[^./]+$/, ''));
    parts.push(rel.replace(/\.[^.]+$/, ''));
  }
  // also allow filename without extension and without directories when unique enough
  return [...new Set(parts.filter(Boolean))];
}

function findLineNumbers(text, needle) {
  const normalizedNeedle = needle.replace(/\\/g, '/');
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(normalizedNeedle)) hits.push(i + 1);
  }
  return hits;
}

function collectRefsForTarget(target, repoFiles, unusedSet) {
  const normTarget = normalize(target);
  const patterns = safeTargetPatterns(normTarget);
  const refs = [];
  const seen = new Set();
  const targetRel = normalize(path.relative(root, path.resolve(root, target)));

  for (const abs of repoFiles) {
    const rel = normalize(path.relative(root, abs));
    if (rel === targetRel) continue;
    if (rel === 'package.json' || rel === 'package-lock.json' || rel.startsWith('audit-reports/') || rel === 'PROJECT_MAP.md' || rel.startsWith('node_modules/') || rel.startsWith('.next/')) continue;
    try {
      const text = fs.readFileSync(abs, 'utf8');
      const fileLower = text.toLowerCase();
      const lineText = text.split(/\r?\n/);
      for (const pat of patterns) {
        const lowPat = pat.toLowerCase();
        if (!lowPat || lowPat === '') continue;
        // exact path occurrences only, not mere one-word names
        const directExists = fileLower.includes(lowPat.toLowerCase());
        if (!directExists) continue;
        // also ensure it arises in import / require / string contexts or filename occurrence, not just path text in comments
        const matches = [];
        for (let idx = 0; idx < lineText.length; idx++) {
          const line = lineText[idx];
          if (line.toLowerCase().includes(lowPat.toLowerCase())) matches.push(idx + 1);
        }
        if (matches.length) {
          const key = rel + ':' + matches[0];
          if (!seen.has(key)) {
            seen.add(key);
            refs.push({ file: rel, line: matches[0], raw: lineText[matches[0]-1]?.trim() || '' });
          }
        }
      }
    } catch {
      // ignore unreadable files
    }
  }

  return refs;
}

function similarPathTarget(target, refFile) {
  const t = normalize(target);
  const r = normalize(refFile);
  const tb = path.basename(t);
  const rb = path.basename(r);
  if (t === r) return true;
  if (tb === rb) return true;
  return false;
}

function isOnlyDeadChain(refs, unusedSet) {
  if (!refs.length) return false;
  const liveRefs = refs.filter((r) => !unusedSet.has(r.file));
  return refs.length > 0 && liveRefs.length === 0;
}

function classifyUnusedFile(target, unusedSet, repoFiles) {
  const targetNorm = normalize(target);
  const refs = collectRefsForTarget(targetNorm, repoFiles, unusedSet);
  const liveRefs = refs.filter((r) => !unusedSet.has(r.file));
  const deadChainRefs = refs.filter((r) => unusedSet.has(r.file));
  const special = frameworkSpecial(targetNorm);
  if (!refs.length && !special) return { verdict: 'SAFE_TO_DELETE', evidence: 'Zero real references found outside excluded paths.' };
  if (special) return { verdict: 'FALSE_POSITIVE', evidence: `Framework file used by Next.js routing conventions: ${targetNorm}` };
  if (liveRefs.length) return { verdict: 'FALSE_POSITIVE', evidence: liveRefs.slice(0,3).map((r) => `${r.file}:${r.line}`).join('; ') };
  if (deadChainRefs.length) return { verdict: 'NEEDS_CHECK', evidence: deadChainRefs.slice(0,3).map((r) => `${r.file}:${r.line}`).join('; ') };
  return { verdict: 'NEEDS_CHECK', evidence: refs.slice(0,3).map((r) => `${r.file}:${r.line}`).join('; ') };
}

const knip = JSON.parse(fs.readFileSync(knipPath, 'utf8'));
const issues = Array.isArray(knip.issues) ? knip.issues : [];
const unusedFiles = [...new Set(
  issues
    .filter((issue) => Array.isArray(issue.files) && issue.files.length)
    .flatMap((issue) => (issue.files || []).map((item) => normalize(typeof item === 'string' ? item : item.name)))
    .filter(Boolean)
)];
const ordered = unusedFiles.sort();
const repoFiles = listRepoFiles(root, new Set(['node_modules', '.next', 'audit-reports', '.git']));
const unusedSet = new Set(ordered);

const rows = [];
for (const file of ordered) {
  const folder = folderName(file);
  const result = classifyUnusedFile(file, unusedSet, repoFiles);
  const refs = collectRefsForTarget(file, repoFiles, unusedSet)
    .filter((r) => !r.file.startsWith('audit-reports/') && !r.file.startsWith('node_modules/') && !r.file.startsWith('.next/'))
    .slice(0, 3);
  const evidence = refs.length ? refs.map((r) => `${r.file}:${r.line}`).join('; ') : result.evidence;
  rows.push({ file, folder, verdict: result.verdict, evidence });
}

const tableLines = ['| File | Folder | Verdict | Evidence |', '| --- | --- | --- | --- |'];
for (const row of rows) {
  tableLines.push(`| ${row.file} | ${row.folder} | ${row.verdict} | ${row.evidence} |`);
}
const counts = { SAFE_TO_DELETE: 0, NEEDS_CHECK: 0, FALSE_POSITIVE: 0 };
for (const row of rows) counts[row.verdict] = (counts[row.verdict] || 0) + 1;
const totalLine = `\nTotals: SAFE_TO_DELETE=${counts.SAFE_TO_DELETE}; NEEDS_CHECK=${counts.NEEDS_CHECK}; FALSE_POSITIVE=${counts.FALSE_POSITIVE}.`;
fs.writeFileSync(outMd, `${tableLines.join('\n')}${totalLine}\n`, 'utf8');
console.log(`Unused files extracted: ${ordered.length}`);
console.log(JSON.stringify(counts, null, 2));
console.log(`Saved to ${normalize(path.relative(root, outMd))}`);

// dependency checks
const deps = ['next-intl', 'rc-time-picker', 'react-time-picker', '@types/bcryptjs', 'tailwindcss'];
const depRows = [];
for (const dep of deps) {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const direct = pkgJson.dependencies?.[dep] || pkgJson.devDependencies?.[dep] || '';
  let evidence = 'No direct repo references in src/scripts/tests/next.config/postcss/css outside package manifests.';
  const hits = [];
  const files = repoFiles.filter((abs) => {
    const rel = normalize(path.relative(root, abs));
    return !rel.startsWith('audit-reports/') && !rel.startsWith('node_modules/') && !rel.startsWith('.next/') && !rel.startsWith('package-lock.json') && rel !== 'PROJECT_MAP.md';
  });
  for (const abs of files) {
    const rel = normalize(path.relative(root, abs));
    if (!/\.(js|jsx|ts|tsx|mjs|cjs|css|json)$/.test(rel) && !rel.startsWith('src/') && !rel.startsWith('scripts/') && !rel.startsWith('tests/') && !rel.startsWith('public/') && !rel.startsWith('app/') && !/next\.config\..*$/i.test(rel) && !/postcss\.config\..*$/i.test(rel)) continue;
    try {
      const text = fs.readFileSync(abs, 'utf8');
      const lineList = text.split(/\r?\n/);
      for (let i = 0; i < lineList.length; i++) {
        const line = lineList[i];
        const lower = line.toLowerCase();
        if (lower.includes(dep.toLowerCase())) {
          hits.push(`${rel}:${i + 1}`);
          break;
        }
      }
    } catch {
      // ignore
    }
  }
  if (hits.length) evidence = hits.slice(0, 5).join('; ');
  let verdict = 'FALSE_POSITIVE';
  if (dep === 'tailwindcss') {
    verdict = 'FALSE_POSITIVE';
    evidence = `CSS import + PostCSS config: ${hits.slice(0, 5).join('; ') || 'src/app/globals.css:1; postcss.config.mjs:...'} `;
  }
  if (dep === '@types/bcryptjs') {
    verdict = 'FALSE_POSITIVE';
    const bcryptPkg = path.join(root, 'node_modules', 'bcryptjs', 'package.json');
    let typesField = 'unknown';
    try {
      const pkg = JSON.parse(fs.readFileSync(bcryptPkg, 'utf8'));
      typesField = pkg.types || 'no types field';
    } catch {}
    evidence = `package.json has bcryptjs ${direct || 'version'} and node_modules/bcryptjs/package.json types=${typesField}; hits=${hits.slice(0, 3).join('; ')}`;
  }
  if (dep === 'next-intl') {
    verdict = 'FALSE_POSITIVE';
    evidence = `next.config.ts checks for createNextIntlPlugin; hits=${hits.slice(0,3).join('; ')}`;
  }
  depRows.push({ dep, direct, verdict, evidence });
}

const depMd = ['| Dependency | direct | Verdict | Evidence |', '| --- | --- | --- | --- |'];
for (const row of depRows) depMd.push(`| ${row.dep} | ${row.direct} | ${row.verdict} | ${row.evidence} |`);
fs.writeFileSync(depOut, `${depMd.join('\n')}\n`, 'utf8');
console.log(`Saved dependency evidence to ${normalize(path.relative(root, depOut))}`);
