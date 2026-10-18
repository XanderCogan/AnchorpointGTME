import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FixtureRelease } from "../packages/core/src/types.ts";
import { fixtureReleaseSchema } from "../packages/contracts/src/fixture.ts";
import { closePool } from "../packages/db/src/client.ts";
import { storeFixtureAndQueueAudit } from "../packages/db/src/repository.ts";

const fixturePath = resolve("fixtures", "releases", "inspection-v1", "input", "hubspot.json");
const source = await readFile(fixturePath, "utf8");
const release = fixtureReleaseSchema.parse(JSON.parse(source)) as FixtureRelease;
const sourceSha256 = createHash("sha256").update(source).digest("hex");

try {
  const result = await storeFixtureAndQueueAudit(release, sourceSha256);
  console.log(
    result.queued
      ? `Stored ${release.release} and queued its audit.`
      : `${release.release} is already stored and its audit job is already present.`,
  );
} finally {
  await closePool();
}
