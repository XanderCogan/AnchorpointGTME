// One-off setup for the Lemlist test campaign (decision 0012): creates it with
// autoReview off, pauses it at once, and prints the ID for LEMLIST_CAMPAIGN_ID.
// No mailbox is attached, so the campaign has no sender and cannot send.
import { resolve } from "node:path";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import { connectLemlist } from "../packages/connectors/src/lemlist/connect.ts";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch {
  // The key may already be in the environment.
}

const config = lemlistConfigFromEnv();
if (!config) {
  console.error("Set LEMLIST_API_KEY as in .env.example.");
  process.exit(1);
}

const name = process.argv[2] ?? "Anchorpoint practice (never launched)";
const created = await connectLemlist(config).createCampaign(name);
const state = await connectLemlist(config).pauseCampaign(created._id);
console.log(`Created campaign ${created._id} (${state}). Set LEMLIST_CAMPAIGN_ID=${created._id}.`);
