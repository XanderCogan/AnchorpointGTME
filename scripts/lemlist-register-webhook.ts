// Registers the deployed API's Lemlist webhook for the test campaign (decision
// 0012). The API service must already have the same LEMLIST_WEBHOOK_SECRET.
import { resolve } from "node:path";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import { connectLemlist } from "../packages/connectors/src/lemlist/connect.ts";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch {
  // The values may already be in the environment.
}

const config = lemlistConfigFromEnv();
const secret = process.env.LEMLIST_WEBHOOK_SECRET;
const targetUrl = process.argv[2];
if (!config?.campaignId || !secret || !targetUrl?.startsWith("https://")) {
  console.error("Usage: npm run lemlist:webhook -- https://<api-host>/v1/webhooks/lemlist (needs LEMLIST_API_KEY, LEMLIST_CAMPAIGN_ID, LEMLIST_WEBHOOK_SECRET).");
  process.exit(1);
}

const hook = await connectLemlist(config).createWebhook(targetUrl, secret, config.campaignId);
console.log(`Registered webhook ${hook._id} to ${hook.targetUrl} for campaign ${config.campaignId}.`);
