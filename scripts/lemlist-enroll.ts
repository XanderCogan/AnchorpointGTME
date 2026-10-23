// Plans, and with --live executes, enrollment into one Lemlist campaign (decision
// 0012). The default is a dry run that makes no Lemlist write. A live run only adds
// leads, and the transport refuses it if the campaign has a sender attached;
// nothing is ever launched.
//
//   --campaign <id>        campaign for this run (default LEMLIST_CAMPAIGN_ID)
//   --source practice      practice fixture contacts (default)
//   --source attio         People linked to Companies in the Attio mirror of
//                          ATTIO_CONNECTION_ID. Approval is membership of the
//                          campaign's audience List (decision 0015):
//   --approved-list <slug> the Attio List whose People members are approved
//                          (default ATTIO_APPROVED_LIST); read live, read-only
//   --approvals <file>     offline alternative: [{ contactKey, approvedBy, approvedAt }]
//                          keyed by Attio person record ID
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { attioConfigFromEnv } from "../packages/connectors/src/attio/config.ts";
import { connectAttio } from "../packages/connectors/src/attio/connect.ts";
import { approvalsFromListEntries, candidatesFromAttio, parseApprovals, type Approval } from "../packages/connectors/src/lemlist/attio-source.ts";
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
    "approved-list": { type: "string" },
  },
});
const config = lemlistConfigFromEnv();
const campaignId = args.campaign ?? config?.campaignId;
if (!config || !campaignId) {
  console.error("Lemlist is not configured. Set LEMLIST_API_KEY, and LEMLIST_CAMPAIGN_ID or --campaign, as in .env.example.");
  process.exit(1);
}

// Decision 0015: approval is membership of the approved campaign's audience List.
async function loadApprovals(): Promise<ReadonlyMap<string, Approval>> {
  const listSlug = args["approved-list"] ?? process.env.ATTIO_APPROVED_LIST;
  if (listSlug) {
    const attioConfig = attioConfigFromEnv();
    if (!attioConfig) throw new Error("Set ATTIO_ACCESS_TOKEN to read the approved List.");
    const entries = [];
    for await (const page of connectAttio(attioConfig).queryListEntries(listSlug, { pageSize: 500, maxPages: 20 })) entries.push(...page);
    const approvals = approvalsFromListEntries(entries, listSlug);
    console.log(`${approvals.size} people approved by membership of Attio List ${listSlug}.`);
    return approvals;
  }
  if (args.approvals) return parseApprovals(JSON.parse(readFileSync(resolve(args.approvals), "utf8")));
  throw new Error("--source attio needs --approved-list <slug> (or ATTIO_APPROVED_LIST), or --approvals <file.json> for an offline run.");
}

async function loadSource(): Promise<{ candidates: EnrollmentCandidate[]; localDoNotContact: string[] }> {
  if (args.source === "practice") {
    return loadPracticeContacts(resolve(import.meta.dirname, "..", "fixtures", "lemlist-practice-v1", "contacts.json"));
  }
  if (args.source === "attio") {
    const connectionId = process.env.ATTIO_CONNECTION_ID;
    if (!connectionId) throw new Error("Set ATTIO_CONNECTION_ID to read the Attio mirror.");
    const approvals = await loadApprovals();
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
