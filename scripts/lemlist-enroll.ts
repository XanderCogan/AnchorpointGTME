// Plans, and with --live executes, enrollment into one Lemlist campaign (decision
// 0012). The default is a dry run that makes no Lemlist write. A live run only adds
// leads, and the transport refuses it if the campaign has a sender attached;
// nothing is ever launched.
//
//   --campaign <id>        campaign for this run (default LEMLIST_CAMPAIGN_ID)
//   --source practice      practice fixture contacts (default)
//   --source attio         People linked to Companies in the Attio mirror of
//                          ATTIO_CONNECTION_ID; requires --approvals <file.json>,
//                          [{ contactKey, approvedBy, approvedAt }] keyed by Attio
//                          person record ID, until Milestone 5's approval table exists.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { candidatesFromAttio, parseApprovals } from "../packages/connectors/src/lemlist/attio-source.ts";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import { connectLemlist } from "../packages/connectors/src/lemlist/connect.ts";
import { executeEnrollment, planEnrollment, suppressionsFrom, type EnrollmentCandidate } from "../packages/connectors/src/lemlist/enrollment.ts";
import { loadPracticeContacts } from "../packages/connectors/src/lemlist/practice.ts";
import { loadAttioPeopleAndCompanies } from "../packages/db/src/attio-mirror.ts";
import { closePool } from "../packages/db/src/client.ts";
import { localSuppressions, PostgresActivationControls, PostgresEnrollmentLedger } from "../packages/db/src/lemlist.ts";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch {
  // The key may already be in the environment.
}

const { values: args } = parseArgs({
  options: {
    live: { type: "boolean", default: false },
    campaign: { type: "string" },
    source: { type: "string", default: "practice" },
    approvals: { type: "string" },
  },
});
const config = lemlistConfigFromEnv();
const campaignId = args.campaign ?? config?.campaignId;
if (!config || !campaignId) {
  console.error("Lemlist is not configured. Set LEMLIST_API_KEY, and LEMLIST_CAMPAIGN_ID or --campaign, as in .env.example.");
  process.exit(1);
}

async function loadSource(): Promise<{ candidates: EnrollmentCandidate[]; localDoNotContact: string[] }> {
  if (args.source === "practice") {
    return loadPracticeContacts(resolve(import.meta.dirname, "..", "fixtures", "lemlist-practice-v1", "contacts.json"));
  }
  if (args.source === "attio") {
    const connectionId = process.env.ATTIO_CONNECTION_ID;
    if (!connectionId) throw new Error("Set ATTIO_CONNECTION_ID to read the Attio mirror.");
    if (!args.approvals) throw new Error("--source attio needs --approvals <file.json> until Milestone 5's approval table exists.");
    const approvals = parseApprovals(JSON.parse(readFileSync(resolve(args.approvals), "utf8")));
    const source = candidatesFromAttio({ ...(await loadAttioPeopleAndCompanies(connectionId)), approvals });
    if (source.unlinked.length > 0) console.log(`${source.unlinked.length} people skipped: not linked to a mirrored company.`);
    return source;
  }
  throw new Error(`Unknown --source ${args.source}; use practice or attio.`);
}

try {
  const source = await loadSource();
  const client = connectLemlist(config);
  const ledger = new PostgresEnrollmentLedger();
  const remote: string[] = [];
  for await (const page of client.listUnsubscribes({ pageSize: 100, maxPages: 50 })) {
    for (const row of page) remote.push(row.email ?? row.value ?? "");
  }
  const decisions = planEnrollment({
    campaignId,
    candidates: source.candidates,
    suppressions: suppressionsFrom(remote, [...source.localDoNotContact, ...(await localSuppressions())]),
    activeKeys: await ledger.activeKeys(campaignId),
    killSwitchEngaged: await new PostgresActivationControls().killSwitchEngaged(campaignId),
  });
  for (const decision of decisions) {
    console.log(`${decision.contactKey}: ${decision.action === "enroll" ? "enroll" : `skip (${decision.reason})`}`);
  }
  if (!args.live) {
    console.log(`Dry run: no Lemlist write was made. Pass --live to add the planned leads to campaign ${campaignId}.`);
  } else {
    for (const outcome of await executeEnrollment(client, ledger, campaignId, decisions)) {
      console.log(`${outcome.contactKey}: ${outcome.result}${outcome.detail ? ` (${outcome.detail})` : ""}`);
    }
  }
} finally {
  await closePool();
}
