// Stage 4 (Serper part) of docs/research/georgia-senior-living-sample-plan.md.
// Uses Serper's free allowance (2,500 queries, confirmed on serper.dev on 2026-10-19) to find
// each operator's web domain, then searches for facilities or maintenance job postings at
// operators inside the serviceable footprint. Domains run first, as decision 0007 requires.
// Raw responses are cached in the gitignored raw folder, so reruns spend no credits.
// Committed output keeps domains, result URLs, and job-posting titles only; people's profile
// pages are skipped and individual owner names are checked for before writing.
//
// Usage: node scripts/georgia-sample/serper-lookups.ts [--limit N]
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");
const cacheRoot = resolve(sampleRoot, "raw/serper");

try {
  process.loadEnvFile(resolve(projectRoot, ".env"));
} catch {
  // The key may already be in the environment.
}
// The key is only required once a query misses the cache, so a fully cached rerun needs none.
const API_KEY = process.env.SERPER_API_KEY?.trim();

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number.parseInt(process.argv[limitArg + 1] ?? "", 10) : Number.POSITIVE_INFINITY;
const RESERVE_CREDITS = 200;
const retrievedOn = new Date().toISOString().slice(0, 10);

// Directories, social networks, job boards, and data aggregators are never an operator's domain.
const NOT_OPERATOR_DOMAINS = [
  "facebook.com", "linkedin.com", "instagram.com", "twitter.com", "x.com", "youtube.com", "yelp.com", "bbb.org",
  "wikipedia.org", "indeed.com", "glassdoor.com", "ziprecruiter.com", "simplyhired.com", "monster.com",
  "careerbuilder.com", "medicare.gov", "cms.gov", "propublica.org", "usnews.com", "caring.com", "seniorly.com",
  "aplaceformom.com", "agingcare.com", "care.com", "seniorliving.org", "seniorhousingnet.com", "nursinghomes.com",
  "nursinghomesite.com", "nursinghome411.org", "causeiq.com", "bizapedia.com", "opencorporates.com", "mapquest.com",
  "zoominfo.com", "dnb.com", "buzzfile.com", "npiprofile.com", "npino.com", "hipaaspace.com", "healthgrades.com",
  "gasla.org", "ghca.info", "georgia.gov", "mmis.georgia.gov", "medicaid.gov", "data.cms.gov", "rocketreach.co",
  "signalhire.com", "apollo.io", "crunchbase.com", "prnewswire.com", "businesswire.com", "mcknights.com",
  "skillednursingnews.com", "seniorhousingnews.com", "carelistings.com", "senioradvisor.com", "familyassets.com",
  "payscale.com", "salary.com", "comparably.com", "jobs.lever.co", "myworkdayjobs.com", "paylocity.com",
  "ultipro.com", "applicantpro.com", "workforcenow.adp.com", "careers-page.com", "google.com", "bing.com",
  "mapcarta.com", "chamberofcommerce.com", "manta.com", "superpages.com", "yellowpages.com", "nextdoor.com",
  "unitedwayatlanta.org", "assistedliving.org", "seniorcare.com", "nursing-homes.org", "senioradvice.com",
  "pbj320.com", "nursinghomelawcenter.org", "pitchbook.com", "sevah.ai", "seniorcarerating.com", "hhs.gov",
  "bankruptcyobserver.com", "miradorliving.com", "onshift.com", "granicus.com", "bookretreats.com", "nursinghomeabuseguide.org", "carecompare.com", "senior-living.com",
];
const JOB_HOSTS = [
  "indeed.com", "linkedin.com/jobs", "glassdoor.com", "ziprecruiter.com", "simplyhired.com", "monster.com",
  "careerbuilder.com", "myworkdayjobs.com", "paylocity.com", "ultipro.com", "applicantpro.com", "jobs.lever.co",
  "workforcenow.adp.com", "onshift.com", "icims.com", "taleo.net", "jobvite.com", "smartrecruiters.com", "careers", "jobs.",
  "hiring", "healthecareers.com",
];
const NOT_A_POSTING = [/\/salaries/, /\/reviews/, /indeed\.com\/q-/, /indeed\.com\/cmp\/[^/]+\/?$/, /jobs\.htm/, /ziprecruiter\.com\/jobs\//, /linkedin\.com\/jobs\/[^/]*-jobs/, /simplyhired\.com\/search/];
const GENERIC_WORDS = new Set(
  (
    "LLC INC CORP CORPORATION COMPANY THE AND OF FOR AT IN HEALTH HEALTHCARE CARE CENTER CENTERS CTR NURSING " +
    "REHABILITATION REHAB HOME HOMES MANAGEMENT SERVICES LIVING SENIOR GROUP HOLDINGS OPERATING OPERATOR " +
    "OPERATIONS PARTNERS MEDICAL HOSPITAL SYSTEM SYSTEMS SKILLED FACILITY GEORGIA COUNTY CITY HEALING " +
    "CONVALESCENT LONG TERM AMERICA NATIONAL MANOR PLACE WITHHELD INDIVIDUAL CHAIN"
  ).split(" "),
);

type Organic = { title?: string; link?: string; snippet?: string; date?: string };
type SearchResponse = { organic?: Organic[]; credits?: number };

const normalize = (text: string) =>
  text.toUpperCase().replace(/['’]/g, "").replace(/&/g, " AND ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const distinctiveWords = (text: string) =>
  normalize(text).split(" ").filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word) && !/^\d+$/.test(word));

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
const isNotOperator = (host: string) => NOT_OPERATOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));

let spent = 0;
let balance = Number.NaN;

async function search(query: string): Promise<SearchResponse> {
  await mkdir(cacheRoot, { recursive: true });
  const cachePath = resolve(cacheRoot, `${createHash("sha256").update(query).digest("hex").slice(0, 16)}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as SearchResponse;
  } catch {
    // Not cached yet.
  }
  if (spent >= LIMIT) throw new Error("LIMIT");
  if (!API_KEY) throw new Error(`SERPER_API_KEY is not set and this query is not cached: ${query}`);
  if (Number.isNaN(balance)) {
    const account = (await (await fetch("https://google.serper.dev/account", { headers: { "X-API-KEY": API_KEY! } })).json()) as {
      balance: number;
    };
    balance = account.balance;
  }
  if (balance - spent <= RESERVE_CREDITS) throw new Error("ALLOWANCE");
  await new Promise((done) => setTimeout(done, 300));
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 10 }),
  });
  if (!response.ok) throw new Error(`Serper returned ${response.status}`);
  const body = (await response.json()) as SearchResponse;
  spent += body.credits ?? 1;
  await writeFile(cachePath, JSON.stringify({ query, retrievedOn, ...body }), "utf8");
  return body;
}

const { operators } = JSON.parse(await readFile(resolve(sampleRoot, "operators.json"), "utf8")) as {
  operators: { operatorId: string; name: string; resolutionRule: string; status: string; georgiaFacilityCount: number; facilityCcns: string[] }[];
};
const { links } = JSON.parse(await readFile(resolve(sampleRoot, "facility-operator-links.json"), "utf8")) as {
  links: { ccn: string; facilityName: string; city: string; operatorId: string }[];
};
const serviceability = JSON.parse(await readFile(resolve(sampleRoot, "serviceability.json"), "utf8")) as {
  operators: { operatorId: string; state: string }[];
};
const footprint = new Map(serviceability.operators.map((operator) => [operator.operatorId, operator.state]));
const facilitiesOf = (operatorId: string) => links.filter((link) => link.operatorId === operatorId);

// Serviceable operators first, then conditional, then the rest, so a short allowance
// covers the accounts that matter.
const stateRank: Record<string, number> = { serviceable: 0, conditional: 1, not_serviceable: 2 };
const ordered = [...operators].sort(
  (a, b) =>
    (stateRank[footprint.get(a.operatorId) ?? "not_serviceable"] ?? 2) - (stateRank[footprint.get(b.operatorId) ?? "not_serviceable"] ?? 2) ||
    b.georgiaFacilityCount - a.georgiaFacilityCount ||
    a.operatorId.localeCompare(b.operatorId),
);

// Multi-site, chain, and managing-organization operators search by operator name. A
// single-site operator known only by a legal entity name, or one whose name is withheld,
// searches by its facility name and city, which is how the public finds it.
function searchSubject(operator: (typeof operators)[number]) {
  const first = facilitiesOf(operator.operatorId)[0];
  const byName =
    !operator.name.includes("[withheld") && (operator.georgiaFacilityCount > 1 || operator.resolutionRule !== "legal_business_name");
  return byName
    ? { kind: "operator_name", text: operator.name, query: `${operator.name} Georgia nursing official website` }
    : {
        kind: "facility_name",
        text: first?.facilityName ?? operator.name,
        query: `"${first?.facilityName ?? ""}" ${first?.city ?? ""} GA official website`,
      };
}

const LEGAL_SUFFIX = new Set("THE INC LLC L L C CORP CORPORATION CO COMPANY LP LTD".split(" "));
// Returns the spelled-out name prefix the host contains: the first two or more name words
// joined, or, for an operator, a single-word name of at least six letters. The prefix must
// include a distinctive word, so generic pairs such as "senior living" never match.
function spelledOut(name: string, host: string, allowSingleWord = true): string | null {
  if (name.includes("[withheld")) return null;
  const words = normalize(name).split(" ").filter((word) => !LEGAL_SUFFIX.has(word));
  const distinctive = (prefix: string[]) => prefix.some((word) => word.length >= 4 && !GENERIC_WORDS.has(word));
  if (allowSingleWord && words.length === 1 && words[0]!.length >= 6 && distinctive(words) && host.includes(words[0]!.toLowerCase())) {
    return words[0]!;
  }
  for (let length = words.length; length >= 2; length--) {
    const prefix = words.slice(0, length);
    if (distinctive(prefix) && host.includes(prefix.join("").toLowerCase())) return prefix.join(" ");
  }
  return null;
}

type DomainResult = {
  operatorId: string;
  query: string;
  queriedBy: string;
  domain: string | null;
  candidateDomain: string | null;
  confidence: "name_match" | "word_match" | "unconfirmed" | "none";
  evidenceUrl: string | null;
  matchedWords: string[];
  matchedOn: "operator_name" | "facility_name" | null;
};
type JobResult = {
  operatorId: string;
  query: string;
  postings: { title: string; url: string; date: string | null }[];
};

const domains: DomainResult[] = [];
const jobs: JobResult[] = [];
let stopReason: string | null = null;

async function run() {
  for (const operator of ordered) {
    const subject = searchSubject(operator);
    const body = await search(subject.query);
    // A host matches strongly when it spells out the operator's leading name words, such as
    // beaconhealthmanagement.com. A host sharing only one distinctive word must also place the
    // result in Georgia or a facility city, since common words recur across states.
    const facilities = facilitiesOf(operator.operatorId);
    const operatorWords = operator.name.includes("[withheld") ? [] : distinctiveWords(operator.name);
    const facilityWords = facilities.flatMap((link) => distinctiveWords(link.facilityName));
    const places = ["GEORGIA", ...new Set(facilities.map((link) => normalize(link.city)))];
    const candidates = (body.organic ?? [])
      .map((result) => ({ result, host: hostOf(result.link ?? "") }))
      .filter((entry) => entry.host && !isNotOperator(entry.host));
    const matched = candidates
      .map((entry) => {
        const host = entry.host.replace(/[^a-z0-9]/g, "");
        const text = ` ${normalize(`${entry.result.title ?? ""} ${entry.result.snippet ?? ""} ${entry.result.link ?? ""}`)} `;
        const inPlace = places.some((place) => place && text.includes(` ${place} `)) || / GA /.test(text);
        const byOperator = operatorWords.filter((word) => host.includes(word.toLowerCase()));
        const byFacility = facilityWords.filter((word) => host.includes(word.toLowerCase()));
        const strongOperator = spelledOut(operator.name, host);
        const strongFacility = facilities.map((link) => spelledOut(link.facilityName, host, false)).find(Boolean) ?? null;
        const strong = strongOperator ?? strongFacility;
        const matchedWords = strong ? [strong] : inPlace ? (byOperator.length > 0 ? byOperator : byFacility) : [];
        return {
          ...entry,
          spelledOut: Boolean(strong),
          matchedWords: [...new Set(matchedWords)],
          matchedOn: (strongOperator || (!strongFacility && byOperator.length > 0) ? "operator_name" : "facility_name") as
            | "operator_name"
            | "facility_name",
        };
      })
      .find((entry) => entry.matchedWords.length > 0);
    // Without a name match the top remaining result is kept only as a hint; it is usually an
    // aggregator the exclusion list does not know yet.
    domains.push({
      operatorId: operator.operatorId,
      query: subject.query,
      queriedBy: subject.kind,
      domain: matched?.host ?? null,
      candidateDomain: matched ? null : candidates[0]?.host ?? null,
      confidence: matched ? (matched.spelledOut ? "name_match" : "word_match") : candidates[0] ? "unconfirmed" : "none",
      evidenceUrl: matched?.result.link ?? null,
      matchedWords: matched?.matchedWords ?? [],
      matchedOn: matched?.matchedOn ?? null,
    });
  }

  // Job postings only for operators inside the footprint, after every domain lookup.
  for (const operator of ordered) {
    if ((footprint.get(operator.operatorId) ?? "not_serviceable") === "not_serviceable") continue;
    const subject = searchSubject(operator);
    const query = `"${subject.text}" ("maintenance director" OR "director of maintenance" OR "maintenance supervisor" OR "facilities director" OR "plant operations") Georgia job`;
    const body = await search(query);
    const words = distinctiveWords(subject.text);
    // A posting candidate is a single job page, not a search, salary, or review page, whose
    // title names the role and whose title or address names the operator or facility.
    const postings = (body.organic ?? [])
      .filter((result) => {
        const link = (result.link ?? "").toLowerCase();
        if (link.includes("linkedin.com/in/") || NOT_A_POSTING.some((pattern) => pattern.test(link))) return false;
        const title = normalize(result.title ?? "");
        if (/^NOW HIRING|JOBS IN|\d+ JOBS|OPEN ROLES|SALARIES|REVIEWS/.test(title)) return false;
        const isJobPage = JOB_HOSTS.some((host) => link.includes(host));
        const namesRole = /MAINTENANCE|FACILITIES|PLANT OPERATIONS/.test(title);
        const namesOperator = words.length > 0 && words.some((word) => title.includes(word) || link.includes(word.toLowerCase()));
        return isJobPage && namesRole && namesOperator;
      })
      .map((result) => ({ title: result.title ?? "", url: result.link ?? "", date: result.date ?? null }));
    jobs.push({ operatorId: operator.operatorId, query, postings });
  }
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "LIMIT" || message === "ALLOWANCE") stopReason = message === "LIMIT" ? "query limit reached" : "free allowance reserve reached";
  else throw error;
}

// A domain matched by name for more than one operator cannot identify either of them.
const nameMatchedHosts = new Map<string, number>();
for (const item of domains) {
  if (item.confidence === "name_match" && item.domain) nameMatchedHosts.set(item.domain, (nameMatchedHosts.get(item.domain) ?? 0) + 1);
}
for (const item of domains) {
  if (item.confidence === "name_match" && item.domain && (nameMatchedHosts.get(item.domain) ?? 0) > 1) item.confidence = "word_match";
}

// Personal-data guard: no individual owner's name may reach the committed output.
const ownership = JSON.parse(await readFile(resolve(sampleRoot, "raw/cms/y2hd-n93e.json"), "utf8")) as Record<string, string>[];
const output = JSON.stringify({ domains, jobs });
const normalizedOutput = ` ${normalize(output)} `;
for (const row of ownership) {
  if (row.owner_type !== "Individual" || !row.owner_name) continue;
  const [last, first] = row.owner_name.split(",").map((part) => normalize(part));
  if (!last || !first) continue;
  for (const name of [`${first} ${last}`, `${last} ${first}`]) {
    if (name.length > 6 && normalizedOutput.includes(` ${name} `)) throw new Error("Personal-data guard: an individual owner name reached the output");
  }
}

const count = <T>(items: T[], test: (item: T) => boolean) => items.filter(test).length;
const summary = {
  operatorsSearched: domains.length,
  domainsNameMatched: count(domains, (item) => item.confidence === "name_match"),
  domainsWordMatched: count(domains, (item) => item.confidence === "word_match"),
  domainsUnconfirmed: count(domains, (item) => item.confidence === "unconfirmed"),
  domainsNone: count(domains, (item) => item.confidence === "none"),
  footprintOperatorsSearchedForJobs: jobs.length,
  operatorsWithPostingCandidates: count(jobs, (item) => item.postings.length > 0),
  creditsSpentThisRun: spent,
  stopReason,
};
await writeFile(
  resolve(sampleRoot, "web-signals.json"),
  `${JSON.stringify(
    {
      method: {
        script: "scripts/georgia-sample/serper-lookups.ts",
        source: "Serper Google search API, free allowance",
        retrievedOn,
        domainRule:
          "first result outside known directories, social networks, job boards, and aggregators; name_match when the host spells out the operator or facility name's leading words, word_match when it shares one distinctive word and the result places itself in Georgia or a facility city, otherwise unconfirmed with only a candidate hint",
        jobRule:
          "single job pages on job boards or careers sites whose title names a maintenance, facilities, or plant operations role and whose title or address names the operator or facility; search, salary, and review pages excluded; found by search, not confirmed open",
      },
      summary,
      domains,
      jobs,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
