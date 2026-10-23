// Stage 1 of docs/research/georgia-senior-living-sample-plan.md.
// Pulls Georgia rows from the CMS Provider Data Catalog nursing home datasets into the
// gitignored raw-data folder and writes the committed source manifest.
// Free public endpoints only; no key is needed.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const rawRoot = resolve(sampleRoot, "raw/cms");
const manifestPath = resolve(sampleRoot, "source-manifest.json");

const API = "https://data.cms.gov/provider-data/api/1";
const PAGE_SIZE = 1500;
const STATE = "GA";

type Row = Record<string, string>;

const datasets: { id: string; title: string; stateFiltered: boolean }[] = [
  { id: "4pq5-n9py", title: "Provider Information", stateFiltered: true },
  { id: "ifjz-ge4w", title: "Fire Safety Deficiencies", stateFiltered: true },
  { id: "y2hd-n93e", title: "Ownership", stateFiltered: true },
  { id: "tagd-9999", title: "Citation Code Look-up", stateFiltered: false },
];

// CMS fronts the Provider Data Catalog with Akamai, which returns 403 to Node's default
// user agent (checked 2026-10-22). An identifying agent is accepted.
const USER_AGENT = "AnchorpointGTME/1.0 (+https://github.com/XanderCogan/AnchorpointGTME)";

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response.json();
    if (attempt >= 3) throw new Error(`${response.status} from ${url}`);
    await new Promise((done) => setTimeout(done, 2000 * attempt));
  }
}

async function pullRows(id: string, stateFiltered: boolean): Promise<Row[]> {
  const rows: Row[] = [];
  let expected = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < expected; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      count: "true",
      rowIds: "true",
      "sorts[0][property]": "record_number",
      "sorts[0][order]": "asc",
    });
    if (stateFiltered) {
      params.set("conditions[0][property]", "state");
      params.set("conditions[0][value]", STATE);
      params.set("conditions[0][operator]", "=");
    }
    const page = (await getJson(`${API}/datastore/query/${id}/0?${params}`)) as { count: number; results: Row[] };
    expected = page.count;
    rows.push(...page.results);
    if (page.results.length === 0) break;
  }
  if (rows.length !== expected) throw new Error(`${id}: pulled ${rows.length} rows, API reported ${expected}`);
  return rows;
}

const retrievedOn = new Date().toISOString().slice(0, 10);
const manifestEntries = [];

await mkdir(rawRoot, { recursive: true });

for (const dataset of datasets) {
  const metadata = (await getJson(`${API}/metastore/schemas/dataset/items/${dataset.id}`)) as {
    title: string;
    modified: string;
    distribution?: { downloadURL?: string }[];
  };
  const rows = await pullRows(dataset.id, dataset.stateFiltered);
  const body = `${JSON.stringify(rows, null, 1)}\n`;
  const fileName = `${dataset.id}.json`;
  await writeFile(resolve(rawRoot, fileName), body, "utf8");

  manifestEntries.push({
    datasetId: dataset.id,
    title: metadata.title,
    cmsModified: metadata.modified,
    retrievedOn,
    filter: dataset.stateFiltered ? `state = ${STATE}` : "none (national lookup table)",
    rowCount: rows.length,
    rawFile: `data/georgia-sample/raw/cms/${fileName}`,
    sha256: createHash("sha256").update(body).digest("hex"),
    endpoint: `${API}/datastore/query/${dataset.id}/0`,
    sourceFile: metadata.distribution?.[0]?.downloadURL ?? null,
  });
  process.stdout.write(`${dataset.id} ${metadata.title}: ${rows.length} rows (CMS modified ${metadata.modified})\n`);
}

const manifest = {
  description:
    "Georgia nursing home source pull for the Track B market sample. Raw rows are gitignored; this manifest is the committed record of what was pulled.",
  source: "CMS Provider Data Catalog, https://data.cms.gov/provider-data/",
  script: "scripts/georgia-sample/pull-cms.ts",
  datasets: manifestEntries,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Manifest written to ${manifestPath}\n`);
