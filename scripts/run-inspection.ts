import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditCrm } from "../packages/core/src/audit.ts";
import type { FixtureRelease } from "../packages/core/src/types.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(projectRoot, "fixtures/releases/inspection-v1/input/hubspot.json");
const outputPath = resolve(projectRoot, "artifacts/inspection-v1/findings.json");

const release = JSON.parse(await readFile(fixturePath, "utf8")) as FixtureRelease;
const findings = auditCrm(release);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(findings, null, 2)}\n`, "utf8");

const severityCounts = findings.reduce<Record<string, number>>((counts, item) => {
  counts[item.severity] = (counts[item.severity] ?? 0) + 1;
  return counts;
}, {});

process.stdout.write(
  `${JSON.stringify({ release: release.release, findingCount: findings.length, severityCounts, outputPath }, null, 2)}\n`,
);

