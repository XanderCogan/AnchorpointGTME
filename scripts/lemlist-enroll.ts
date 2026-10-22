// Plans, and with --live executes, enrollment of the practice contacts into the
// configured Lemlist test campaign (decision 0012). The default is a dry run that
// makes no Lemlist write. A live run only adds leads; nothing is ever launched.
import { resolve } from "node:path";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import { connectLemlist } from "../packages/connectors/src/lemlist/connect.ts";
import { executeEnrollment, planEnrollment, suppressionsFrom } from "../packages/connectors/src/lemlist/enrollment.ts";
import { loadPracticeContacts } from "../packages/connectors/src/lemlist/practice.ts";
import { closePool } from "../packages/db/src/client.ts";
import { localSuppressions, PostgresActivationControls, PostgresEnrollmentLedger } from "../packages/db/src/lemlist.ts";

const live = process.argv.includes("--live");
const config = lemlistConfigFromEnv();
if (!config?.campaignId) {
  console.error("Lemlist is not configured. Set LEMLIST_API_KEY and LEMLIST_CAMPAIGN_ID as in .env.example.");
  process.exit(1);
}
const campaignId = config.campaignId;
const practice = loadPracticeContacts(resolve(import.meta.dirname, "..", "fixtures", "lemlist-practice-v1", "contacts.json"));

try {
  const client = connectLemlist(config);
  const ledger = new PostgresEnrollmentLedger();
  const remote: string[] = [];
  for await (const page of client.listUnsubscribes({ pageSize: 100, maxPages: 50 })) {
    for (const row of page) remote.push(row.email ?? row.value ?? "");
  }
  const decisions = planEnrollment({
    campaignId,
    candidates: practice.candidates,
    suppressions: suppressionsFrom(remote, [...practice.localDoNotContact, ...(await localSuppressions())]),
    activeKeys: await ledger.activeKeys(campaignId),
    killSwitchEngaged: await new PostgresActivationControls().killSwitchEngaged(campaignId),
  });
  for (const decision of decisions) {
    console.log(`${decision.contactKey}: ${decision.action === "enroll" ? "enroll" : `skip (${decision.reason})`}`);
  }
  if (!live) {
    console.log("Dry run: no Lemlist write was made. Pass --live to add the planned leads to the test campaign.");
  } else {
    for (const outcome of await executeEnrollment(client, ledger, campaignId, decisions)) {
      console.log(`${outcome.contactKey}: ${outcome.result}${outcome.detail ? ` (${outcome.detail})` : ""}`);
    }
  }
} finally {
  await closePool();
}
