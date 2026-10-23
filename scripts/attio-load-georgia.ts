// One-time setup step, separate from the read-only connector: loads the real Georgia
// senior-living operators as Companies and their facilities as Sites (decision 0010).
// Uses ATTIO_WRITEBACK_TOKEN (records read-write, object configuration read), or ATTIO_SETUP_TOKEN
// when attributes still need creating. Attio refuses API-set uniqueness, so existing records are read first and
// matched on operator_id and ccn: a rerun updates them and never duplicates.
import { readFileSync } from "node:fs";

const token = process.env.ATTIO_WRITEBACK_TOKEN ?? process.env.ATTIO_SETUP_TOKEN;
if (!token) {
  console.error("Set ATTIO_WRITEBACK_TOKEN (records read-write) or, for a first load that creates attributes, ATTIO_SETUP_TOKEN.");
  process.exit(1);
}
const siteObject = process.env.ATTIO_SITE_OBJECT ?? "sites";
const data = (file: string) => JSON.parse(readFileSync(`data/georgia-sample/${file}`, "utf8"));

async function api(method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`https://api.attio.com/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
}

interface AttributeSpec { title: string; type: string; options?: string[] }

async function ensureAttributes(object: string, specs: Record<string, AttributeSpec>) {
  const existing = new Set((await api("GET", `/objects/${object}/attributes`)).data.map((a: any) => a.api_slug));
  for (const [slug, spec] of Object.entries(specs)) {
    if (!existing.has(slug)) {
      await api("POST", `/objects/${object}/attributes`, {
        data: {
          title: spec.title, description: null, api_slug: slug, type: spec.type, is_required: false,
          is_unique: false, is_multiselect: false, default_value: null, config: {},
        },
      });
      console.log(`${object}.${slug}: created`);
    }
    if (spec.options) {
      const have = new Set((await api("GET", `/objects/${object}/attributes/${slug}/options`)).data.map((o: any) => o.title));
      for (const title of spec.options.filter((t) => !have.has(t))) {
        await api("POST", `/objects/${object}/attributes/${slug}/options`, { data: { title } });
      }
    }
  }
}

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) results.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return results;
}

// Attio rejects null attribute values, so absent source fields are left unset.
const present = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== undefined && value !== ""));

const operators: any[] = data("operators.json").operators;
const links: any[] = data("facility-operator-links.json").links;
const tierFile = data("tiers.json");
const tiers = new Map<string, any>([...tierFile.operators, ...tierFile.outsideFootprint].map((t: any) => [t.operatorId, t]));

await ensureAttributes("companies", {
  operator_id: { title: "Operator ID", type: "text" },
  operator_status: { title: "Operator identity", type: "select", options: ["resolved", "provisional"] },
  tier_band: { title: "Tier band", type: "select", options: ["A", "B", "C", "Watch", "Not eligible"] },
  tier_score: { title: "Tier score", type: "number" },
  georgia_facility_count: { title: "Georgia facilities", type: "number" },
});
await ensureAttributes(siteObject, {
  name: { title: "Name", type: "text" },
  ccn: { title: "CMS CCN", type: "text" },
  street_address: { title: "Street address", type: "text" },
  city: { title: "City", type: "text" },
  zip: { title: "ZIP", type: "text" },
  county: { title: "County", type: "text" },
  certified_beds: { title: "Certified beds", type: "number" },
  ownership_type: { title: "Ownership type", type: "text" },
});

async function existingByKey(object: string, key: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (let offset = 0; ; offset += 500) {
    const page = (await api("POST", `/objects/${object}/records/query`, { limit: 500, offset })).data;
    for (const record of page) {
      const value = record.values[key]?.[0]?.value;
      if (value) found.set(value, record.id.record_id);
    }
    if (page.length < 500) return found;
  }
}

async function upsert(object: string, existing: Map<string, string>, key: string, values: Record<string, unknown>) {
  const id = existing.get(key);
  const res = id
    ? await api("PATCH", `/objects/${object}/records/${id}`, { data: { values } })
    : await api("POST", `/objects/${object}/records`, { data: { values } });
  existing.set(key, res.data.id.record_id);
  return res.data.id.record_id as string;
}

const existingCompanies = await existingByKey("companies", "operator_id");
const existingSites = await existingByKey(siteObject, "ccn");
const companyIds = new Map<string, string>();
await inBatches(operators, 5, async (op) => {
  const tier = tiers.get(op.operatorId);
  const values: Record<string, unknown> = {
    name: op.name,
    operator_id: op.operatorId,
    operator_status: op.status,
    industry_segment: "Senior living and skilled nursing",
    georgia_facility_count: op.georgiaFacilityCount,
    target_candidate: tier?.eligible === true,
    tier_band: tier?.eligible ? tier.band : "Not eligible",
  };
  if (typeof tier?.score === "number") values.tier_score = tier.score;
  companyIds.set(op.operatorId, await upsert("companies", existingCompanies, op.operatorId, values));
});
console.log(`companies upserted: ${companyIds.size}`);

let sites = 0;
await inBatches(links, 5, async (link) => {
  await upsert(siteObject, existingSites, link.ccn, present({
    name: link.facilityName,
    ccn: link.ccn,
    street_address: link.address,
    city: link.city,
    zip: link.zip,
    county: link.county,
    certified_beds: link.certifiedBeds,
    ownership_type: link.ownershipType,
    company: [{ target_object: "companies", target_record_id: companyIds.get(link.operatorId) }],
  }));
  sites += 1;
});
console.log(`sites upserted: ${sites}`);
