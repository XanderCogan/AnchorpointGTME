// Scheduled refresh of the Georgia sample: the Render cron `anchorpoint-cms-refresh` runs this
// monthly, after CMS refreshes its datasets. It spawns each existing stage script in order and
// stops on the first failure, so no stage logic lives here.
// `--dry-run` reuses the cached raw data (no CMS pull) and skips the Attio load and sync.
// New ambiguous facilities still land in operator-review.json for human review; nothing merges them.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const dryRun = process.argv.includes("--dry-run");

const STAGES: { script: string; live: boolean }[] = [
  { script: "scripts/georgia-sample/pull-cms.ts", live: true },
  { script: "scripts/georgia-sample/resolve-operators.ts", live: false },
  { script: "scripts/georgia-sample/serviceability.ts", live: false },
  { script: "scripts/georgia-sample/signals.ts", live: false },
  { script: "scripts/georgia-sample/serper-lookups.ts", live: false },
  { script: "scripts/georgia-sample/tier.ts", live: false },
  { script: "scripts/attio-load-georgia.ts", live: true },
  { script: "scripts/attio-sync.ts", live: true },
];

const read = (file: string) => JSON.parse(readFileSync(resolve(sampleRoot, file), "utf8"));
const reviewCaseIds = (): Set<string> => {
  try {
    return new Set((read("operator-review.json").reviewCases as { caseId: string }[]).map((item) => item.caseId));
  } catch {
    return new Set();
  }
};

const log = (message: string) => console.log(`[refresh ${new Date().toISOString()}] ${message}`);
const reviewBefore = reviewCaseIds();
log(dryRun ? "dry run: cached raw data, no CMS pull, no Attio load or sync" : "live run");

for (const [index, stage] of STAGES.entries()) {
  const label = `stage ${index + 1}/${STAGES.length} ${stage.script}`;
  if (dryRun && stage.live) {
    log(`${label}: skipped (dry run)`);
    continue;
  }
  log(`${label}: start`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [stage.script], { cwd: projectRoot, stdio: "inherit", env: process.env });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    log(`${label}: FAILED after ${seconds}s (exit ${result.status ?? result.signal ?? result.error?.message}); stopping`);
    process.exit(result.status || 1);
  }
  log(`${label}: ok in ${seconds}s`);
}

const links = read("facility-operator-links.json").links as unknown[];
const operators = read("operators.json").operators as unknown[];
const reviewAfter = reviewCaseIds();
const newReview = [...reviewAfter].filter((id) => !reviewBefore.has(id));
const tiers = read("tiers.json") as { operators: { band: string | null }[]; outsideFootprint: unknown[] };
const bands = new Map<string, number>();
for (const operator of tiers.operators) bands.set(operator.band ?? "none", (bands.get(operator.band ?? "none") ?? 0) + 1);

log("summary");
console.log(`  facilities: ${links.length}`);
console.log(`  operators: ${operators.length}`);
console.log(`  review cases: ${reviewAfter.size} (${newReview.length} new${newReview.length ? `: ${newReview.join(", ")}` : ""})`);
console.log(
  `  bands: ${[...bands].sort(([a], [b]) => a.localeCompare(b)).map(([band, count]) => `${band} ${count}`).join(", ")}; outside footprint ${tiers.outsideFootprint.length}`,
);
