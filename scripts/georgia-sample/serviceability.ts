// Stage 3 of docs/research/georgia-senior-living-sample-plan.md.
// Applies decision 0003 to every Georgia facility: for each service line, the nearest branch
// that offers it, the road drive time, and the serviceability state with its reason.
//
// Drive times come from the OSRM public demo server's table service (OpenStreetMap data, car
// profile), approved by the user on 2026-10-19 for this non-commercial portfolio project. The
// server allows at most one request per second, so requests run sequentially and slowly, and raw
// responses are cached in the gitignored raw folder so reruns do not query it again.
// OSRM durations are free-flow times without traffic; facilities near a band edge are flagged.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sampleRoot = resolve(projectRoot, "data/georgia-sample");

type Row = Record<string, string>;
type ServiceLine = "sprinkler_itm" | "fire_alarm_itm" | "extinguisher" | "kitchen_hood" | "emergency_lighting";
type State = "serviceable" | "conditional" | "not_serviceable";

const SERVICE_LINES: ServiceLine[] = ["sprinkler_itm", "fire_alarm_itm", "extinguisher", "kitchen_hood", "emergency_lighting"];

// Branches and capabilities from decision 0003. Branch sites are fictional, so each is placed
// at its city's center; the coordinates are approximate public geography.
const BRANCHES: { id: string; name: string; latitude: number; longitude: number; lines: ServiceLine[] }[] = [
  {
    id: "atlanta",
    name: "Atlanta metro (Norcross)",
    latitude: 33.9412,
    longitude: -84.2135,
    lines: ["sprinkler_itm", "fire_alarm_itm", "extinguisher", "kitchen_hood", "emergency_lighting"],
  },
  {
    id: "macon",
    name: "Macon",
    latitude: 32.8407,
    longitude: -83.6324,
    lines: ["sprinkler_itm", "fire_alarm_itm", "extinguisher", "kitchen_hood", "emergency_lighting"],
  },
  { id: "savannah", name: "Savannah", latitude: 32.0809, longitude: -81.0912, lines: ["extinguisher", "kitchen_hood", "emergency_lighting"] },
  {
    id: "greenville",
    name: "Greenville, SC",
    latitude: 34.8526,
    longitude: -82.394,
    lines: ["sprinkler_itm", "fire_alarm_itm", "extinguisher"],
  },
];

const OSRM = "https://router.project-osrm.org/table/v1/driving";
const USER_AGENT = "AnchorpointGTME portfolio research (non-commercial; github.com/XanderCogan/AnchorpointGTME)";
const BATCH_SIZE = 90;
const SNAP_WARNING_METERS = 500;
const osrmCache = resolve(sampleRoot, "raw/osrm");

const SERVICEABLE_MAX = 90;
const CONDITIONAL_MAX = 120;
const EMERGENCY_MAX = 60;
const NEAR_EDGE_MINUTES = 5;

type Table = { code: string; durations: (number | null)[][]; distances: (number | null)[][]; destinations: { distance: number }[] };
type Route = { minutes: number; miles: number; snapMeters: number };

// Returns routes[branchIndex][facilityIndex] for every facility, one OSRM request per batch.
async function routeAll(points: { latitude: number; longitude: number }[]): Promise<Route[][]> {
  await mkdir(osrmCache, { recursive: true });
  const routes: Route[][] = BRANCHES.map(() => []);
  const branchCoordinates = BRANCHES.map((branch) => `${branch.longitude},${branch.latitude}`);
  for (let start = 0; start < points.length; start += BATCH_SIZE) {
    const batch = points.slice(start, start + BATCH_SIZE);
    const coordinates = [...branchCoordinates, ...batch.map((point) => `${point.longitude},${point.latitude}`)].join(";");
    const sources = BRANCHES.map((_, index) => index).join(";");
    const destinations = batch.map((_, index) => BRANCHES.length + index).join(";");
    const url = `${OSRM}/${coordinates}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`;
    const cachePath = resolve(osrmCache, `${createHash("sha256").update(url).digest("hex").slice(0, 16)}.json`);

    let table: Table;
    try {
      table = JSON.parse(await readFile(cachePath, "utf8")) as Table;
    } catch {
      await new Promise((done) => setTimeout(done, 1500));
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`OSRM returned ${response.status}`);
      table = (await response.json()) as Table;
      if (table.code !== "Ok") throw new Error(`OSRM returned ${table.code}`);
      await writeFile(cachePath, JSON.stringify(table), "utf8");
    }

    BRANCHES.forEach((_, branchIndex) => {
      batch.forEach((_, index) => {
        const seconds = table.durations[branchIndex]?.[index];
        const meters = table.distances[branchIndex]?.[index];
        if (seconds == null || meters == null) throw new Error(`OSRM found no route to facility ${start + index}`);
        routes[branchIndex]!.push({
          minutes: Math.round(seconds / 60),
          miles: Math.round((meters / 1609.344) * 10) / 10,
          snapMeters: Math.round(table.destinations[index]?.distance ?? 0),
        });
      });
    });
  }
  return routes;
}

function stateFor(minutes: number): State {
  if (minutes <= SERVICEABLE_MAX) return "serviceable";
  if (minutes <= CONDITIONAL_MAX) return "conditional";
  return "not_serviceable";
}

const manifest = JSON.parse(await readFile(resolve(sampleRoot, "source-manifest.json"), "utf8")) as {
  datasets: { datasetId: string; retrievedOn: string; cmsModified: string; sha256: string }[];
};
const providerSource = manifest.datasets.find((dataset) => dataset.datasetId === "4pq5-n9py");
if (!providerSource) throw new Error("Provider Information is missing from the manifest; run pull-cms.ts first");

const providers = JSON.parse(await readFile(resolve(sampleRoot, "raw/cms/4pq5-n9py.json"), "utf8")) as Row[];
const { links } = JSON.parse(await readFile(resolve(sampleRoot, "facility-operator-links.json"), "utf8")) as {
  links: { ccn: string; operatorId: string; facilityName: string }[];
};
const operatorOf = new Map(links.map((link) => [link.ccn, link.operatorId]));

const sortedProviders = [...providers].sort((a, b) =>
  (a.cms_certification_number_ccn ?? "").localeCompare(b.cms_certification_number_ccn ?? ""),
);
const points = sortedProviders.map((facility) => {
  const latitude = Number.parseFloat(facility.latitude ?? "");
  const longitude = Number.parseFloat(facility.longitude ?? "");
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new Error(`${facility.cms_certification_number_ccn} has no CMS coordinates`);
  return { latitude, longitude };
});
const routes = await routeAll(points);
const retrievedOn = new Date().toISOString().slice(0, 10);

const facilities = sortedProviders.map((facility, facilityIndex) => {
  const ccn = facility.cms_certification_number_ccn ?? "";
  const { latitude, longitude } = points[facilityIndex]!;
  const branchRoutes = BRANCHES.map((branch, branchIndex) => ({ branch, ...routes[branchIndex]![facilityIndex]! }));
  const nearest = [...branchRoutes].sort((a, b) => a.minutes - b.minutes)[0]!;

  const lines = Object.fromEntries(
    SERVICE_LINES.map((line) => {
      const capable = branchRoutes.filter((entry) => entry.branch.lines.includes(line)).sort((a, b) => a.minutes - b.minutes)[0]!;
      const state = stateFor(capable.minutes);
      const fallback = capable.branch.id !== nearest.branch.id;
      const reason =
        state === "serviceable"
          ? `within ${SERVICEABLE_MAX} minutes of ${capable.branch.name}`
          : state === "conditional"
            ? `${SERVICEABLE_MAX} to ${CONDITIONAL_MAX} minutes from ${capable.branch.name}; needs a route-density reason and manager approval`
            : `over ${CONDITIONAL_MAX} minutes from the nearest branch offering this line (${capable.branch.name})`;
      return [
        line,
        {
          branch: capable.branch.id,
          driveMinutes: capable.minutes,
          roadMiles: capable.miles,
          state,
          reason: fallback ? `${reason}; nearest branch ${nearest.branch.name} does not offer this line` : reason,
          nearBandEdge: [SERVICEABLE_MAX, CONDITIONAL_MAX].some((edge) => Math.abs(capable.minutes - edge) <= NEAR_EDGE_MINUTES),
        },
      ];
    }),
  ) as Record<ServiceLine, { branch: string; driveMinutes: number; roadMiles: number; state: State; reason: string; nearBandEdge: boolean }>;

  const states = SERVICE_LINES.map((line) => lines[line].state);
  return {
    ccn,
    facilityName: facility.provider_name ?? "",
    city: facility.citytown ?? "",
    operatorId: operatorOf.get(ccn) ?? null,
    coordinates: { latitude, longitude, source: "4pq5-n9py.latitude, 4pq5-n9py.longitude" },
    roadSnapMeters: branchRoutes[0]!.snapMeters,
    roadSnapWarning: branchRoutes[0]!.snapMeters > SNAP_WARNING_METERS,
    nearestBranch: nearest.branch.id,
    nearestBranchDriveMinutes: nearest.minutes,
    emergencyEligible: nearest.minutes <= EMERGENCY_MAX,
    serviceableLines: SERVICE_LINES.filter((line) => lines[line].state === "serviceable"),
    overallState: (states.every((state) => state === "serviceable")
      ? "fully_serviceable"
      : states.some((state) => state !== "not_serviceable")
        ? "partially_serviceable"
        : "not_serviceable") as "fully_serviceable" | "partially_serviceable" | "not_serviceable",
    lines,
  };
});

// Operator rollup: an operator is in scope when at least one facility is serviceable for
// sprinkler or alarm ITM, the recurring lines that anchor a contract.
const operatorRollup = new Map<string, { operatorId: string; facilities: number; anchorServiceable: number; anchorConditional: number; fullyServiceable: number }>();
for (const facility of facilities) {
  if (!facility.operatorId) continue;
  const entry = operatorRollup.get(facility.operatorId) ?? {
    operatorId: facility.operatorId,
    facilities: 0,
    anchorServiceable: 0,
    anchorConditional: 0,
    fullyServiceable: 0,
  };
  entry.facilities += 1;
  const anchorStates = [facility.lines.sprinkler_itm.state, facility.lines.fire_alarm_itm.state];
  if (anchorStates.includes("serviceable")) entry.anchorServiceable += 1;
  else if (anchorStates.includes("conditional")) entry.anchorConditional += 1;
  if (facility.overallState === "fully_serviceable") entry.fullyServiceable += 1;
  operatorRollup.set(facility.operatorId, entry);
}
const operators = [...operatorRollup.values()]
  .map((entry) => ({
    ...entry,
    state: entry.anchorServiceable > 0 ? "serviceable" : entry.anchorConditional > 0 ? "conditional" : "not_serviceable",
  }))
  .sort((a, b) => a.operatorId.localeCompare(b.operatorId));

const method = {
  decision: "docs/decisions/0003-service-catalog-and-footprint.md",
  timeSource: {
    service: "OSRM public demo server, table service, car profile",
    endpoint: OSRM,
    data: "OpenStreetMap contributors (ODbL)",
    retrievedOn,
    caveat: "Free-flow road times without traffic; metro Atlanta peak times run longer.",
    terms: "Non-commercial use, at most one request per second; approved by the user on 2026-10-19.",
  },
  bandsMinutes: { serviceable: SERVICEABLE_MAX, conditional: CONDITIONAL_MAX, emergency: EMERGENCY_MAX },
  nearBandEdgeMinutes: NEAR_EDGE_MINUTES,
  branches: BRANCHES.map(({ id, name, lines }) => ({ id, name, lines, location: "city center (fictional branch site)" })),
  assumptions: [
    "Anchorpoint's Georgia licenses are company licenses, so the Greenville branch may serve Georgia sites for the lines it offers.",
    "Alarm monitoring resale is left out while decision 0003 keeps open whether it is a standalone line.",
    "Every nursing home is assumed to need all five lines; Stage 4 citations add evidence of actual need.",
  ],
  coordinates: { dataset: "4pq5-n9py", cmsModified: providerSource.cmsModified, retrievedOn: providerSource.retrievedOn },
  script: "scripts/georgia-sample/serviceability.ts",
};
await writeFile(resolve(sampleRoot, "serviceability.json"), `${JSON.stringify({ method, operators, facilities }, null, 2)}\n`, "utf8");

const count = <T>(items: T[], test: (item: T) => boolean) => items.filter(test).length;
process.stdout.write(
  `${JSON.stringify(
    {
      facilities: facilities.length,
      fullyServiceable: count(facilities, (f) => f.overallState === "fully_serviceable"),
      partiallyServiceable: count(facilities, (f) => f.overallState === "partially_serviceable"),
      notServiceable: count(facilities, (f) => f.overallState === "not_serviceable"),
      sprinkler: Object.fromEntries(
        (["serviceable", "conditional", "not_serviceable"] as State[]).map((state) => [state, count(facilities, (f) => f.lines.sprinkler_itm.state === state)]),
      ),
      roadSnapWarnings: count(facilities, (f) => f.roadSnapWarning),
      nearBandEdgeFacilities: count(facilities, (f) => SERVICE_LINES.some((line) => f.lines[line].nearBandEdge)),
      emergencyEligible: count(facilities, (f) => f.emergencyEligible),
      operators: operators.length,
      operatorsServiceable: count(operators, (o) => o.state === "serviceable"),
      operatorsConditional: count(operators, (o) => o.state === "conditional"),
      operatorsNotServiceable: count(operators, (o) => o.state === "not_serviceable"),
    },
    null,
    2,
  )}\n`,
);
