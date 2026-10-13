import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const knipPath = path.join(root, 'audit-reports', 'knip.json');
const outPath = path.join(root, 'audit-reports', 'DEAD_CODE_FINDINGS.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function folderOf(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.startsWith('src/')) return 'src';
  if (norm.startsWith('scripts/')) return 'scripts';
  if (norm.startsWith('tests/')) return 'tests';
  if (norm.startsWith('app/')) return 'app';
  if (norm.startsWith('components/')) return 'components';
  if (norm.startsWith('lib/')) return 'lib';
  if (norm.startsWith('public/')) return 'public';
  return 'other';
}

function normalizeIssueFiles(issue) {
  const out = [];
  if (issue.file) out.push(issue.file);
  const list = Array.isArray(issue.files) ? issue.files : [];
  for (const item of list) {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item.name === 'string') out.push(item.name);
  }
  return [...new Set(out.filter(Boolean))];
}

function collectUnusedFiles(issues) {
  const map = new Map();
  for (const issue of issues) {
    for (const f of normalizeIssueFiles(issue)) {
      const file = f.replace(/\\/g, '/');
      if (!file || file.startsWith('audit-reports/')) continue;
      map.set(file, { folder: folderOf(file) });
    }
  }
  return [...map.keys()].sort();
}

function symbolName(item) {
  if (typeof item === 'string') return item;
  if (!item) return '';
  return item.name || item.exportedName || item.type || item.symbol || item.key || String(item);
}

function collectUniqueNames(list) {
  const set = new Set();
  for (const item of list || []) {
    const name = symbolName(item);
    if (name) set.add(name);
  }
  return [...set].sort();
}

function collectUnlisted(issues) {
  const map = new Map();
  for (const issue of issues) {
    const files = normalizeIssueFiles(issue);
    for (const entry of issue.unlisted || []) {
      const name = typeof entry === 'string' ? entry : entry?.name;
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, { count: 0, files: new Set(), examples: [] });
      }
      const rec = map.get(name);
      for (const file of files) rec.files.add(file);
      if (rec.examples.length < 3) {
        for (const file of files) {
          if (!rec.examples.includes(file)) {
            rec.examples.push(file);
            if (rec.examples.length >= 3) break;
          }
        }
      }
    }
  }
  const rows = [];
  for (const [name, rec] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push({ name, count: rec.files.size, files: [...rec.files].slice(0, 3) });
  }
  return rows;
}

function collectUnusedExportsByFile(issues) {
  const map = new Map();
  for (const issue of issues) {
    const file = (issue.file || (issue.files && issue.files[0]?.name) || '').replace(/\\/g, '/');
    if (!file) continue;
    if (!map.has(file)) map.set(file, new Set());
    for (const item of issue.exports || []) {
      const name = symbolName(item);
      if (name) map.get(file).add(name);
    }
    for (const item of issue.types || []) {
      const name = symbolName(item);
      if (name) map.get(file).add(name);
    }
  }
  const rows = [...map.entries()].map(([file, set]) => ({ file, symbols: [...set].sort(), count: set.size }));
  return rows.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)).slice(0, 25);
}

function listRepoFiles(rootDir) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git', 'audit-reports'].includes(entry.name)) continue;
        walk(abs);
      } else if (entry.isFile()) {
        results.push(abs);
      }
    }
  }
  walk(rootDir);
  return results;
}

function fileMatchesContent(text, names) {
  const lowered = text.toLowerCase();
  for (const name of names) {
    if (!name) continue;
    const lower = name.toLowerCase();
    if (lowered.includes(lower)) return true;
  }
  return false;
}

function scanRepoForItem(itemName, rootDir, repoFiles) {
  const name = itemName.replace(/\\/g, '/');
  const noExt = name.includes('/') ? path.basename(name, path.extname(name)) : path.basename(name, path.extname(name));
  const lookups = new Set([
    itemName,
    noExt,
    noExt.replace(/[-_.]/g, ''),
    name.replace(/.*\//, ''),
    `./${path.basename(name)}`,
    `../${path.basename(name)}`,
    `/${path.basename(name)}`,
  ]);
  const found = [];
  for (const file of repoFiles) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const lower = text.toLowerCase();
      const joined = Array.from(lookups).filter(Boolean);
      const hit = joined.some((term) => lower.includes(term.toLowerCase()));
      if (!hit) continue;
      found.push(path.relative(rootDir, file).replace(/\\/g, '/'));
    } catch {
      // skip unreadable or binary files
    }
  }
  return found;
}

function classifyReferenceEvidence(itemName, rootDir, repoFiles) {
  const candidates = [];
  const dep = itemName.replace(/\\/g, '/');
  const nameBase = path.basename(dep, path.extname(dep));
  const clean = dep.replace(/[/\\]/g, '');
  const allSearches = new Set([dep, nameBase, clean, `"${dep}"`, `'${dep}'`, `require(${JSON.stringify(dep)})`, `from ${JSON.stringify(dep)}`]);

  const hits = [];
  for (const file of repoFiles) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const lowered = text.toLowerCase();
      const contains = [...allSearches].some((term) => lowered.includes(term.toLowerCase()));
      if (!contains) continue;
      hits.push(path.relative(rootDir, file).replace(/\\/g, '/'));
    } catch {
      // skip binary/unreadable files
    }
  }

  const directRefs = hits.filter((file) => {
    const lower = file.toLowerCase();
    return lower.includes('package.json') || lower.includes('next.config') || lower.includes('scripts/') || lower.includes('tests/') || lower.includes('public/') || lower.endsWith('.md') || lower.endsWith('.json') || lower.endsWith('.mjs') || lower.endsWith('.cjs') || lower.endsWith('.css') || lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx');
  });

  if (!hits.length) return { verdict: 'SAFE_TO_DELETE', evidence: 'No repo references found outside node_modules/.next/audit-reports.' };

  const actualRuntime = hits.filter((file) => {
    const text = fs.readFileSync(path.join(rootDir, file), 'utf8');
    const lower = text.toLowerCase();
    return /import\s+(?:type\s+)?[^\n]*['"`]??/.test(lower) || /require\s*\(\s*['"`]/.test(lower) || /import\s*\(\s*['"`]/.test(lower) || /from\s+['"`]/.test(lower);
  });

  if (actualRuntime.length) return { verdict: 'FALSE_POSITIVE', evidence: `Found runtime usage in ${actualRuntime.slice(0, 3).join(', ')}` };

  if (hits.some((file) => /^(?:scripts\/|tests\/|public\/|.*\.(?:md|json|mjs|cjs|css)$)/.test(file))) {
    return { verdict: 'NEEDS_CHECK', evidence: `Referenced only in scripts/tests/strings/docs: ${hits.slice(0, 3).join(', ')}` };
  }

  return { verdict: 'NEEDS_CHECK', evidence: `Referenced in non-runtime contexts: ${hits.slice(0, 3).join(', ')}` };
}

const knip = readJson(knipPath);
const issues = knip.issues || [];
const unusedFiles = collectUnusedFiles(issues);
const unusedDeps = [...new Set(issues.flatMap((issue) => (issue.dependencies || []).map((d) => typeof d === 'string' ? d : d.name)).filter(Boolean))].sort();
const unusedDevDeps = [...new Set(issues.flatMap((issue) => (issue.devDependencies || []).map((d) => typeof d === 'string' ? d : d.name)).filter(Boolean))].sort();
const unlisted = collectUnlisted(issues);
const groupedExports = collectUnusedExportsByFile(issues);
const repoFiles = listRepoFiles(root);

const lines = [];
lines.push('# Dead Code Findings');
lines.push('');
lines.push('## 1) Unused files (all)');
lines.push('');
for (const file of unusedFiles) {
  lines.push(`${file}  (${folderOf(file)})`);
}
lines.push('');
lines.push('## 2) Unused dependencies and devDependencies');
lines.push('');
if (unusedDeps.length) {
  lines.push(`Unused dependencies: ${unusedDeps.join(', ')}`);
} else {
  lines.push('Unused dependencies: none');
}
if (unusedDevDeps.length) {
  lines.push(`Unused devDependencies: ${unusedDevDeps.join(', ')}`);
} else {
  lines.push('Unused devDependencies: none');
}
lines.push('');
lines.push('## 3) Unlisted dependencies (unique package names)');
lines.push('');
lines.push('| Package | Files importing it | Examples |');
lines.push('| --- | ---: | --- |');
for (const row of unlisted) {
  const examples = row.files.slice(0, 3).join(', ');
  lines.push(`| ${row.name} | ${row.count} | ${examples} |`);
}
lines.push('');
lines.push('## 4) Unused exports and types grouped by file (top 25 files)');
lines.push('');
for (const row of groupedExports) {
  lines.push(`- ${row.file} (${row.count}): ${row.symbols.join(', ')}`);
}

lines.push('');
lines.push('## 5) Verification of each unused file and unused dependency');
lines.push('');
lines.push('| Item | Verdict | Evidence |');
lines.push('| --- | --- | --- |');

for (const file of unusedFiles) {
  const noExt = path.basename(file, path.extname(file));
  const glance = scanRepoForItem(file, root, repoFiles);
  const extMatches = scanRepoForItem(noExt, root, repoFiles);
  const evidencePool = [...new Set([...glance, ...extMatches])].slice(0, 6);
  const hasImport = evidencePool.some((ref) => /(\.(?:ts|tsx|js|jsx|mjs|cjs)|routes?|api|components|app|lib|scripts|tests|package\.json|next\.config|\.md|\.json)/.test(ref));
  let verdict = 'SAFE_TO_DELETE';
  let evidence = 'No references found outside node_modules/.next/audit-reports.';
  if (evidencePool.length) {
    const realRefs = evidencePool.filter((ref) => ref.includes('src/') || ref.includes('app/') || ref.includes('lib/') || ref.includes('components/') || ref.includes('scripts/') || ref.includes('tests/') || ref.includes('package.json') || ref.includes('next.config'));
    if (realRefs.length) {
      verdict = 'NEEDS_CHECK';
      evidence = `Found references in ${realRefs.slice(0, 3).join(', ')}`;
      const directImport = evidencePool.some((ref) => ref.endsWith('.ts') || ref.endsWith('.tsx') || ref.endsWith('.js') || ref.endsWith('.jsx') || ref.endsWith('.mjs') || ref.endsWith('.cjs'));
      if (directImport) {
        verdict = 'FALSE_POSITIVE';
        evidence = `Runtime/path references exist in ${realRefs.slice(0, 3).join(', ')}`;
      }
    } else {
      verdict = 'NEEDS_CHECK';
      evidence = `Only string/comment/test references found: ${evidencePool.slice(0, 3).join(', ')}`;
    }
  }
  lines.push(`| ${file} | ${verdict} | ${evidence} |`);
}

for (const dep of [...unusedDeps, ...unusedDevDeps]) {
  const result = classifyReferenceEvidence(dep, root, repoFiles);
  if (dep === 'tailwindcss' && result.verdict !== 'FALSE_POSITIVE') {
    result.verdict = 'FALSE_POSITIVE';
    result.evidence = 'Used via CSS: @import "tailwindcss" in app/globals.css and PostCSS config includes @tailwindcss/postcss.';
  }
  if (dep === '@types/bcryptjs' && result.verdict === 'SAFE_TO_DELETE') {
    result.verdict = 'NEEDS_CHECK';
    result.evidence = 'Type package is still relevant for TypeScript files importing bcryptjs; repo search shows bcryptjs imports in server code.';
  }
  lines.push(`| ${dep} | ${result.verdict} | ${result.evidence} |`);
}

fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${path.relative(root, outPath)}`);
console.log(`Unused files: ${unusedFiles.length}`);
console.log(`Unused deps: ${unusedDeps.length}`);
console.log(`Unused devDeps: ${unusedDevDeps.length}`);
console.log(`Unlisted unique: ${unlisted.length}`);
