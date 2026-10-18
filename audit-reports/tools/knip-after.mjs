import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const reports = path.join(root, "audit-reports");

function run(args) {
  const result = spawnSync("npx", ["knip", "--config", "audit-reports/knip.config.json", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const jsonRun = run(["--reporter", "json"]);
fs.writeFileSync(path.join(reports, "knip.json"), jsonRun.stdout, "utf8");
fs.writeFileSync(path.join(reports, "knip-after.stderr.txt"), jsonRun.stderr, "utf8");
if (jsonRun.status !== 0 && !jsonRun.stdout.trim()) {
  throw new Error(`Knip JSON command failed with exit code ${jsonRun.status}; see audit-reports/knip-after.stderr.txt`);
}

const textRun = run([]);
fs.writeFileSync(path.join(reports, "knip.txt"), textRun.stdout, "utf8");
fs.writeFileSync(path.join(reports, "knip-after-text.stderr.txt"), textRun.stderr, "utf8");
if (textRun.status !== 0 && !textRun.stdout.trim()) {
  throw new Error(`Knip text command failed with exit code ${textRun.status}; see audit-reports/knip-after-text.stderr.txt`);
}

const data = JSON.parse(jsonRun.stdout.replace(/^\uFEFF/, ""));
const issueRows = Array.isArray(data) ? data : (data.issues ?? []);
const unusedFiles = new Set();
let unusedExports = 0;
let unusedTypes = 0;

for (const issue of issueRows) {
  for (const item of issue.files ?? []) {
    if (typeof item === "string") unusedFiles.add(item);
    else if (item?.name) unusedFiles.add(item.name);
  }
  unusedExports += (issue.exports ?? []).length;
  unusedTypes += (issue.types ?? []).length;
}

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirs = new Set(["node_modules", ".next", ".git", "audit-reports"]);
function sourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...sourceFiles(abs));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(abs);
    }
  }
  return files;
}

const allSourceFiles = sourceFiles(root);
const referenceLines = new Map();
const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
const compilerOptions = configPath
  ? ts.parseJsonConfigFileContent(
      ts.readConfigFile(configPath, ts.sys.readFile).config,
      ts.sys,
      path.dirname(configPath),
    ).options
  : {};
const normalizePath = (value) => path.resolve(value).toLowerCase();

for (const file of allSourceFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const contents = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, position: node.getStart(source) });
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      imports.push({ specifier: node.arguments[0].text, position: node.getStart(source) });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  for (const { specifier, position } of imports) {
    const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys)
      .resolvedModule?.resolvedFileName;
    if (!resolved) continue;
    const line = source.getLineAndCharacterOfPosition(position).line + 1;
    for (const unused of unusedFiles) {
      if (normalizePath(resolved) === normalizePath(path.join(root, unused))) {
        const rows = referenceLines.get(unused) ?? [];
        rows.push({ file: rel, line, unusedTarget: unusedFiles.has(rel) });
        referenceLines.set(unused, rows);
      }
    }
  }
}

console.log(`Knip command exit codes: JSON=${jsonRun.status}, text=${textRun.status}`);
console.log(`Unused files (${unusedFiles.size}):`);
for (const file of [...unusedFiles].sort()) {
  console.log(`- ${file}`);
  const references = referenceLines.get(file) ?? [];
  if (!references.length) {
    console.log("  References: none found");
    continue;
  }
  for (const ref of references.slice(0, 3)) {
    console.log(`  ${ref.file}:${ref.line}${ref.unusedTarget ? " [referencing file is also unused]" : ""}`);
  }
}
console.log(`Unused exports: ${unusedExports}`);
console.log(`Unused types: ${unusedTypes}`);
