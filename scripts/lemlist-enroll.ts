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
//   --drafts <dir>         reviewed draft files from lemlist:draft (default
//                          data/georgia-sample/private/drafts); a contact whose draft
//                          is not marked reviewed is skipped, one with no draft enrolls
//                          without copy variables.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import { connectLemlist } from "../packages/connectors/src/lemlist/connect.ts";
import { attachDrafts, DEFAULT_DRAFTS_DIR, readDraftFile } from "../packages/connectors/src/lemlist/drafts.ts";
import { executeEnrollment, planEnrollment, suppressionsFrom } from "../packages/connectors/src/lemlist/enrollment.ts";
import { loadEnrollmentSource } from "../packages/connectors/src/lemlist/source.ts";
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
    drafts: { type: "string", default: resolve(import.meta.dirname, "..", DEFAULT_DRAFTS_DIR) },
  },
});
const config = lemlistConfigFromEnv();
const campaignId = args.campaign ?? config?.campaignId;
if (!config || !campaignId) {
  console.error("Lemlist is not configured. Set LEMLIST_API_KEY, and LEMLIST_CAMPAIGN_ID or --campaign, as in .env.example.");
  process.exit(1);
}

try {
  const source = await loadEnrollmentSource({
    source: args.source,
    approvals: args.approvals,
    practicePath: resolve(import.meta.dirname, "..", "fixtures", "lemlist-practice-v1", "contacts.json"),
  });
  const client = connectLemlist(config);
  const ledger = new PostgresEnrollmentLedger();
  const remote: string[] = [];
  for await (const page of client.listUnsubscribes({ pageSize: 100, maxPages: 50 })) {
    for (const row of page) remote.push(row.email ?? row.value ?? "");
  }
  const decisions = attachDrafts(
    planEnrollment({
      campaignId,
      candidates: source.candidates,
      suppressions: suppressionsFrom(remote, [...source.localDoNotContact, ...(await localSuppressions())]),
      activeKeys: await ledger.activeKeys(campaignId),
      killSwitchEngaged: await new PostgresActivationControls().killSwitchEngaged(campaignId),
    }),
    (contactKey) => readDraftFile(args.drafts, contactKey),
  );
  for (const decision of decisions) {
    const withDraft = decision.action === "enroll" && "subject" in (decision.lead.variables ?? {}) ? " with reviewed draft variables" : "";
    console.log(`${decision.contactKey}: ${decision.action === "enroll" ? `enroll${withDraft}` : `skip (${decision.reason})`}`);
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
