// Stage 6 of docs/research/georgia-senior-living-sample-plan.md, designed in
// docs/research/georgia-clay-people-pass.md.
// Reduces Clay's people-pass exports, which name real people and stay in the gitignored private
// folder, to data/georgia-sample/people-coverage.json: counts, booleans, fixed codes, and
// account-level role-change points. The output is validated against
// people-coverage.schema.json and scanned for anything shaped like an email, link, or phone
// number before it is written. If either check fails, nothing is written.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");

export const OPERATOR_SLOTS = ["operator_regional_facilities", "operator_operations_vp"] as const;
export const SITE_SLOTS = ["site_executive_director", "site_maintenance_director"] as const;
const FACILITIES_SLOTS = new Set(["operator_regional_facilities", "site_maintenance_director"]);
const TENURE_BANDS = ["under_6_months", "6_to_12_months", "12_to_24_months", "over_24_months", "unknown"];
const CHANNELS = ["clay_email_waterfall_validated", "not_checked", "not_found", "found_not_valid"];

// Approved by the user on 2026-10-20 as role-change-proposal-1: role-change points decay linearly over 24 months from the band's
// midpoint, matching the 24-month decay tier.ts proposes for ownership change. Long tenure scores
// zero and is never a penalty.
export const ROLE_CHANGE_RULE = "role-change-proposal-1: 16 x (1 - midpoint months / 24); bands under 6, 6 to 12, 12 to 24 months use midpoints 3, 9, 18";
const ROLE_CHANGE_MAX = 16;
const BAND_MIDPOINT_MONTHS: Record<string, number> = { under_6_months: 3, "6_to_12_months": 9, "12_to_24_months": 18 };

type Row = Record<string, string>;
type SlotResult = { searched: boolean; peopleFound: number; personaVerified: boolean; currentEmploymentVerified: boolean; channel: string };
type SlotRead = { result: SlotResult; tenureBand: string };

export const parseCsv = (text: string): Row[] => {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") record.push(field), (field = "");
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field), records.push(record), (record = []), (field = "");
    } else field += char;
  }
  if (field || record.length) record.push(field), records.push(record);
  const [header, ...body] = records.filter((item) => item.some((value) => value.trim() !== ""));
  return body.map((values) => Object.fromEntries(header.map((column, index) => [column.trim(), (values[index] ?? "").trim()])));
};

const truthy = (value: string | undefined) => ["true", "yes", "1"].includes((value ?? "").toLowerCase());
const oneOf = (value: string | undefined, allowed: string[], fallback: string) => (allowed.includes(value ?? "") ? value! : fallback);

// Reads one slot's reduction columns, named <slot>__<field> in the Clay table. Any other column,
// including names, titles, links, and emails, is ignored.
export const readSlot = (row: Row, slot: string, maxPeople: number): SlotRead => {
  const found = Math.max(0, Math.min(maxPeople, Number.parseInt(row[`${slot}__found`] ?? "0", 10) || 0));
  return {
    result: {
      searched: truthy(row[`${slot}__searched`]),
      peopleFound: found,
      personaVerified: found > 0 && truthy(row[`${slot}__persona_verified`]),
      currentEmploymentVerified: found > 0 && truthy(row[`${slot}__employment_verified`]),
      channel: found > 0 ? oneOf(row[`${slot}__channel`], CHANNELS, "not_checked") : "not_checked",
    },
    tenureBand: oneOf(row[`${slot}__tenure_band`], TENURE_BANDS, "unknown"),
  };
};

// Account-level role change from the most recent start among verified people at the operator and
// its sites. Only the points and a generic reason leave this function.
export const roleChange = (reads: { slot: string; read: SlotRead }[]) => {
  const verified = reads.filter(({ read }) => read.result.personaVerified && read.result.currentEmploymentVerified);
  const scored = verified
    .map(({ slot, read }) => {
      const midpoint = BAND_MIDPOINT_MONTHS[read.tenureBand];
      const points = midpoint === undefined ? 0 : Math.round(ROLE_CHANGE_MAX * (1 - midpoint / 24) * 10) / 10;
      return { slot, points, known: read.tenureBand !== "unknown" };
    })
    .sort((a, b) => b.points - a.points || Number(FACILITIES_SLOTS.has(b.slot)) - Number(FACILITIES_SLOTS.has(a.slot)));
  const best = scored[0];
  if (!best || !scored.some((item) => item.known)) return { points: 0, reason: "unknown" };
  if (best.points === 0) return { points: 0, reason: "no_recent_start" };
  return { points: best.points, reason: FACILITIES_SLOTS.has(best.slot) ? "verified_facilities_leader_started_recently" : "verified_leader_started_recently" };
};

// A small validator for the JSON Schema keywords people-coverage.schema.json uses.
type Schema = Record<string, any>;
export const validate = (schema: Schema, value: unknown, root: Schema = schema, path = "$"): string[] => {
  if (schema.$ref) return validate(root.$defs[schema.$ref.replace("#/$defs/", "")], value, root, path);
  const errors: string[] = [];
  if ("const" in schema && value !== schema.const) errors.push(`${path} must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  const type = schema.type;
  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [...errors, `${path} must be an object`];
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in record)) errors.push(`${path}.${key} is required`);
    for (const [key, item] of Object.entries(record)) {
      if (schema.properties?.[key]) errors.push(...validate(schema.properties[key], item, root, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) return [...errors, `${path} must be an array`];
    value.forEach((item, index) => errors.push(...validate(schema.items ?? {}, item, root, `${path}[${index}]`)));
  } else if (type === "string") {
    if (typeof value !== "string") return [...errors, `${path} must be a string`];
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} must match ${schema.pattern}`);
  } else if (type === "number" || type === "integer") {
    if (typeof value !== "number" || (type === "integer" && !Number.isInteger(value))) return [...errors, `${path} must be ${type === "integer" ? "an integer" : "a number"}`];
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  } else if (type === "boolean" && typeof value !== "boolean") errors.push(`${path} must be a boolean`);
  return errors;
};

// Last line of defense: anything shaped like an email, a link, or a phone number fails the run.
export const personalDataLeaks = (serialized: string) =>
  [/@/, /https?:\/\//i, /www\./i, /linkedin/i, /\d{7,}/, /\(\d{3}\)\s?\d{3}/, /\d{3}[-.\s]\d{3}[-.\s]\d{4}/].filter((pattern) => pattern.test(serialized)).map(String);

type Run = { clayRunDates: string[]; freeDataCreditsUsed: number; paidDataCreditsUsed: number; actionsUsed: number; paidUsd: number; stoppedBecause: string };

export const reduce = (input: { operatorsIn: Row[]; sitesIn: Row[]; operatorsOut: Row[]; sitesOut: Row[]; inScope: { operatorId: string; band: string }[]; run: Run; retrievedOn: string }) => {
  const operatorOut = new Map(input.operatorsOut.map((row) => [row.operator_id, row]));
  const siteOut = new Map(input.sitesOut.map((row) => [row.ccn, row]));
  const multiSite = new Set(input.operatorsIn.map((row) => row.operator_id));

  const sites = input.sitesIn.map((row) => {
    const exported = siteOut.get(row.ccn);
    const reads = SITE_SLOTS.map((slot) => ({ slot, read: readSlot(exported ?? {}, slot, 1) }));
    return {
      row: {
        ccn: row.ccn,
        operatorId: row.operator_id,
        band: row.band,
        wave: Number(exported?.wave ?? row.wave ?? 1) === 2 ? 2 : 1,
        status: reads.some(({ read }) => read.result.searched) ? "covered" : "not_reached",
        slots: Object.fromEntries(reads.map(({ slot, read }) => [slot, read.result])),
      },
      reads,
    };
  });

  const operators = input.inScope.map(({ operatorId, band }) => {
    const exported = operatorOut.get(operatorId);
    const reads = multiSite.has(operatorId) ? OPERATOR_SLOTS.map((slot) => ({ slot, read: readSlot(exported ?? {}, slot, 2) })) : [];
    const siteReads = sites.filter((site) => site.row.operatorId === operatorId).flatMap((site) => site.reads);
    const covered = reads.some(({ read }) => read.result.searched) || siteReads.some(({ read }) => read.result.searched);
    return {
      operatorId,
      band,
      status: multiSite.has(operatorId) ? (covered ? "covered" : "not_reached") : "site_only",
      slots: Object.fromEntries(reads.map(({ slot, read }) => [slot, read.result])),
      roleChange: roleChange([...reads, ...siteReads]),
    };
  });

  return {
    roleMapVersion: "georgia-clay-role-map-1",
    roleChangeRule: ROLE_CHANGE_RULE,
    clayRunDates: input.run.clayRunDates,
    retrievedOn: input.retrievedOn,
    credits: {
      freeDataCreditsUsed: input.run.freeDataCreditsUsed,
      paidDataCreditsUsed: input.run.paidDataCreditsUsed,
      actionsUsed: input.run.actionsUsed,
      paidUsd: input.run.paidUsd,
    },
    stoppedBecause: input.run.stoppedBecause,
    operators,
    sites: sites.map((site) => site.row),
  };
};

// Found-a-person rate per role, for the stop report.
export const coverageSummary = (output: ReturnType<typeof reduce>) => {
  const rows = [...output.operators, ...output.sites] as { slots: Record<string, SlotResult> }[];
  return [...OPERATOR_SLOTS, ...SITE_SLOTS].map((slot) => {
    const searched = rows.filter((row) => row.slots[slot]?.searched);
    const found = searched.filter((row) => row.slots[slot].peopleFound > 0);
    return `${slot}: ${found.length} of ${searched.length} searched rows found a person (${searched.length ? Math.round((found.length / searched.length) * 100) : 0}%)`;
  });
};

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return resolve(index > -1 ? process.argv[index + 1] : fallback);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputDir = arg("input", resolve(sampleRoot, "private/clay/input"));
  const exportDir = arg("export", resolve(sampleRoot, "private/clay/export"));
  const outPath = arg("out", resolve(sampleRoot, "people-coverage.json"));
  const readCsv = async (dir: string, prefix: string) => {
    const files = (await readdir(dir)).filter((file) => file.startsWith(prefix) && file.endsWith(".csv"));
    return (await Promise.all(files.map(async (file) => parseCsv(await readFile(resolve(dir, file), "utf8"))))).flat();
  };
  const { operators: tiers } = JSON.parse(await readFile(resolve(sampleRoot, "tiers.json"), "utf8")) as { operators: { operatorId: string; eligible: boolean; band: string | null }[] };
  const output = reduce({
    operatorsIn: await readCsv(inputDir, "operators"),
    sitesIn: await readCsv(inputDir, "sites"),
    operatorsOut: await readCsv(exportDir, "operators"),
    sitesOut: await readCsv(exportDir, "sites"),
    inScope: tiers.filter((operator) => operator.eligible && ["A", "B", "C"].includes(operator.band ?? "")).map(({ operatorId, band }) => ({ operatorId, band: band! })),
    run: JSON.parse(await readFile(resolve(exportDir, "run.json"), "utf8")) as Run,
    retrievedOn: new Date().toISOString().slice(0, 10),
  });
  const schema = JSON.parse(await readFile(resolve(sampleRoot, "people-coverage.schema.json"), "utf8")) as Schema;
  const errors = validate(schema, output);
  const serialized = JSON.stringify(output, null, 2) + "\n";
  const leaks = personalDataLeaks(serialized);
  if (errors.length || leaks.length) {
    console.error(["people-coverage.json was not written.", ...errors.slice(0, 20), ...leaks.map((pattern) => `matched personal-data pattern ${pattern}`)].join("\n"));
    process.exit(1);
  }
  await writeFile(outPath, serialized);
  console.log([`Wrote ${outPath}. Stopped because: ${output.stoppedBecause}.`, ...coverageSummary(output)].join("\n"));
}
