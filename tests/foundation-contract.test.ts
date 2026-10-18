import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { auditCrm } from "../packages/core/src/audit.ts";
import { buildFindingViews } from "../packages/core/src/presentation.ts";
import type { FixtureRelease } from "../packages/core/src/types.ts";
import { fixtureReleaseSchema } from "../packages/contracts/src/fixture.ts";

const fixturePath = resolve(
  import.meta.dirname,
  "..",
  "fixtures",
  "releases",
  "inspection-v1",
  "input",
  "hubspot.json",
);

test("the repository boundary validates the accepted fixture", async () => {
  const parsed = fixtureReleaseSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
  assert.equal(parsed.release, "inspection-v1");
  assert.equal(parsed.companies.length, 8);
});

test("the repository boundary rejects malformed source timestamps", async () => {
  const source = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;
  const config = source.config as Record<string, unknown>;
  config.asOf = "yesterday-ish";
  assert.equal(fixtureReleaseSchema.safeParse(source).success, false);
});

test("persisted finding presentation remains derived from source records", async () => {
  const release = fixtureReleaseSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8")),
  ) as FixtureRelease;
  const views = buildFindingViews(release, auditCrm(release));
  assert.equal(views.length, 22);
  assert.equal(views.some((finding) => finding.recordNames.includes("Blue Ridge Hospitality")), true);
});
