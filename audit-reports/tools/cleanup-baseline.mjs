import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "audit-reports", "cleanup-checks");
fs.mkdirSync(reportDir, { recursive: true });
const phase = process.argv[2] === "after" ? "after" : "before";

function run(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(reportDir, `${name}-${phase}.txt`), output, "utf8");
  return { code: result.status ?? 1, output, error: result.error?.message };
}

const tsc = run("tsc", "npx", ["tsc", "--noEmit"]);
const tests = run("tests", "npm", ["test"]);
const lintJson = `audit-reports/lint-${phase}.json`;
const lint = run("eslint", "npx", ["eslint", ".", "-f", "json", "-o", lintJson]);

let lintErrors = 0;
let lintWarnings = 0;
try {
  const results = JSON.parse(fs.readFileSync(path.join(root, lintJson), "utf8"));
  for (const file of results) {
    lintErrors += file.errorCount;
    lintWarnings += file.warningCount;
  }
} catch (error) {
  console.error(`Could not parse eslint JSON: ${error.message}`);
}

const tscErrorCount = (tsc.output.match(/error TS\d+:/g) ?? []).length;
const testSummary = tests.output.match(/ℹ tests\s+(\d+)[\s\S]*?ℹ pass\s+(\d+)[\s\S]*?ℹ fail\s+(\d+)/);
const testTotals = testSummary
  ? { total: Number(testSummary[1]), pass: Number(testSummary[2]), fail: Number(testSummary[3]) }
  : { total: "unknown", pass: "unknown", fail: "unknown" };
const build = phase === "before" ? run("build", "npm", ["run", "build"]) : null;
const buildResult = build ?? { code: 0, output: "", error: undefined };
const afterBuild = phase === "after" ? run("build", "npm", ["run", "build"]) : null;
const selectedBuild = afterBuild ?? buildResult;
const selectedBuildReason = selectedBuild.code === 0
  ? "Build passed."
  : (selectedBuild.output.trim().split(/\r?\n/).slice(-12).join(" ") || selectedBuild.error || `exit ${selectedBuild.code}`);
const baselineMdPath = path.join(root, "audit-reports", "BASELINE.md");
const existing = phase === "after" && fs.existsSync(baselineMdPath)
  ? fs.readFileSync(baselineMdPath, "utf8")
  : [
      "# Cleanup batch A baseline",
      "",
      `Baseline before deletion: tsc ${tscErrorCount} errors (exit ${tsc.code}); tests ${testTotals.pass}/${testTotals.total} passed, ${testTotals.fail} failed (exit ${tests.code}); lint ${lintErrors} errors/${lintWarnings} warnings (exit ${lint.code}); build ${selectedBuild.code === 0 ? "pass" : "fail"} (exit ${selectedBuild.code})${selectedBuild.code === 0 ? "" : `: ${selectedBuildReason}`}.`,
      "",
      "Raw output is in `audit-reports/cleanup-checks/`; ESLint JSON is `audit-reports/lint-before.json`.",
    ].join("\n");
const afterSummary = [
  "",
  "## After deletion",
  "",
  `- TypeScript: ${tscErrorCount} errors (exit ${tsc.code}).`,
  `- Tests: ${testTotals.pass}/${testTotals.total} passed; ${testTotals.fail} failed (exit ${tests.code}).`,
  `- ESLint: ${lintErrors} errors, ${lintWarnings} warnings (exit ${lint.code}).`,
  `- Build: ${selectedBuild.code === 0 ? "pass" : "fail"} (exit ${selectedBuild.code}); ${selectedBuildReason}`,
  "",
  `Raw output is in \`audit-reports/cleanup-checks/\`; ESLint JSON: \`audit-reports/lint-after.json\`.`,
].join("\n");
const report = phase === "after"
  ? `${existing.replace(/\n+$/, "")}\n${afterSummary}\n`
  : `${existing}\n`;
fs.writeFileSync(baselineMdPath, report, "utf8");

console.log(JSON.stringify({
  tsc: { errors: tscErrorCount, exitCode: tsc.code },
  tests: { ...testTotals, exitCode: tests.code },
  lint: { errors: lintErrors, warnings: lintWarnings, exitCode: lint.code },
  build: { pass: selectedBuild.code === 0, exitCode: selectedBuild.code, reason: selectedBuildReason },
}, null, 2));
