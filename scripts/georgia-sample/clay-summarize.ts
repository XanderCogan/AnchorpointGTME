// Stage 6 helper for docs/research/georgia-clay-people-pass.md, "Runbook: when Clay is connected".
// Clay's CSV export keeps only an enrichment's status text, so each people search gets one formula
// column in Clay that writes its people as JSON: title plus current experience (title, company,
// company domain, start date), and no names or links. This script reads those raw exports from the
// gitignored private/clay/raw folder and writes the <slot>__<field> summary columns that
// clay-reduce.ts reads into private/clay/export. Only identifiers and summary codes are written.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./clay-reduce.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const clayRoot = resolve(projectRoot, "data/georgia-sample/private/clay");

type Row = Record<string, string>;
type Experience = { t?: string; c?: string; d?: string; s?: string };
type Person = { t?: string; cur?: Experience[] };
type RoleSlot = { id: string; maxPeople: number; titleInclude: string[]; titleExclude: string[] };

// Each table: the raw export, the slot whose search ran in each formula column, and the column
// holding the domain the search used.
const TABLES = [
  { raw: "operators.csv", out: "operators.csv", id: "operator_id", nameColumn: "operator_name", domainColumn: "domain", slots: [["operator_regional_facilities", "Formula"], ["operator_operations_vp", "Formula (2)"]] },
  { raw: "sites-single.csv", out: "sites-single.csv", id: "ccn", nameColumn: "operator_name", domainColumn: "operator_domain", slots: [["site_executive_director", "Formula"], ["site_maintenance_director", "Formula (2)"]] },
] as const;

const normalize = (value: string | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP_WORDS = new Set(["inc", "llc", "the", "of", "and", "health", "healthcare", "care", "center", "centers", "services", "management", "group", "opco", "operating"]);
const nameTokens = (value: string) => new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !STOP_WORDS.has(token)));

export const personaMatches = (title: string | undefined, slot: RoleSlot) => {
  const text = normalize(title);
  return !!text && slot.titleInclude.some((pattern) => text.includes(pattern)) && !slot.titleExclude.some((pattern) => text.includes(pattern));
};

// Current employment counts when a current role's company domain equals the searched domain, or
// its company name shares a distinctive word with the operator name.
export const employerMatches = (experience: Experience, domain: string, operatorName: string) => {
  const searched = normalize(domain).replace(/ /g, "");
  if (searched && normalize(experience.d).replace(/ /g, "") === searched) return true;
  const operator = nameTokens(operatorName);
  return [...nameTokens(experience.c ?? "")].some((token) => operator.has(token));
};

// Start dates arrive as "YYYY-MM" or "YYYY". A year alone only places someone over 24 months.
export const tenureBand = (start: string | undefined, asOf: Date) => {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(start ?? "");
  if (!match) return "unknown";
  const year = Number(match[1]);
  if (!match[2]) return asOf.getUTCFullYear() - year >= 3 ? "over_24_months" : "unknown";
  const months = (asOf.getUTCFullYear() - year) * 12 + (asOf.getUTCMonth() + 1 - Number(match[2]));
  return months < 6 ? "under_6_months" : months < 12 ? "6_to_12_months" : months < 24 ? "12_to_24_months" : "over_24_months";
};

export const summarizeSlot = (statusText: string, peopleJson: string, slot: RoleSlot, domain: string, operatorName: string, asOf: Date) => {
  const searched = !!statusText && statusText !== "Missing input";
  let people: Person[] = [];
  try {
    people = searched ? (JSON.parse(peopleJson || "[]") as Person[]) : [];
  } catch {
    people = [];
  }
  people = people.slice(0, slot.maxPeople);
  const matches = people.flatMap((person) =>
    (person.cur ?? []).map((experience) => ({
      persona: personaMatches(experience.t, slot) || personaMatches(person.t, slot),
      employer: employerMatches(experience, domain, operatorName),
      start: experience.s,
    })),
  );
  const verified = matches.filter((item) => item.persona && item.employer).sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
  return {
    [`${slot.id}__searched`]: String(searched),
    [`${slot.id}__found`]: String(people.length),
    [`${slot.id}__persona_verified`]: String(matches.some((item) => item.persona)),
    [`${slot.id}__employment_verified`]: String(matches.some((item) => item.employer)),
    [`${slot.id}__tenure_band`]: verified[0] ? tenureBand(verified[0].start, asOf) : "unknown",
    [`${slot.id}__channel`]: "not_checked",
  };
};

const toCsv = (rows: Row[]) => {
  const columns = Object.keys(rows[0] ?? {});
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column] ?? "")).join(","))].join("\n") + "\n";
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roleMap = JSON.parse(await readFile(resolve(projectRoot, "data/georgia-sample/clay-role-map.json"), "utf8")) as { roleSlots: RoleSlot[] };
  const slots = new Map(roleMap.roleSlots.map((slot) => [slot.id, slot]));
  const asOf = new Date();
  await mkdir(resolve(clayRoot, "export"), { recursive: true });
  for (const table of TABLES) {
    const rows = parseCsv(await readFile(resolve(clayRoot, "raw", table.raw), "utf8"));
    const summarized = rows.map((row) => {
      const out: Row = { [table.id]: row[table.id]!, band: row.band! };
      if (table.id === "ccn") out.operator_id = row.operator_id!;
      for (const [slotId, formulaColumn] of table.slots) {
        const slot = slots.get(slotId);
        if (!slot) throw new Error(`Role map has no slot ${slotId}.`);
        if (!(formulaColumn in row) || !(slotId in row)) throw new Error(`${table.raw} is missing the ${slotId} search or its ${formulaColumn} people column.`);
        Object.assign(out, summarizeSlot(row[slotId]!, row[formulaColumn]!, slot, row[table.domainColumn] ?? "", row[table.nameColumn] ?? "", asOf));
      }
      return out;
    });
    await writeFile(resolve(clayRoot, "export", table.out), toCsv(summarized));
    console.log(`${table.out}: ${summarized.length} rows summarized.`);
  }
}
