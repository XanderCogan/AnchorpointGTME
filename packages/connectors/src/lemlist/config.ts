// Lemlist connector configuration (Milestone 6, decision 0012). The connector calls
// the real Lemlist API, but launching a campaign stays switched off: launchEnabled is
// true only when LEMLIST_LAUNCH_ENABLED is exactly "true", and this project never
// sets it.
export interface LemlistConnectionConfig {
  apiKey: string;
  // Default campaign for an enrollment run; each run may name another.
  campaignId: string | null;
  launchEnabled: boolean;
}

type Env = Record<string, string | undefined>;

// Returns null when no API key is configured.
export function lemlistConfigFromEnv(env: Env = process.env): LemlistConnectionConfig | null {
  const apiKey = env.LEMLIST_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    campaignId: env.LEMLIST_CAMPAIGN_ID || null,
    launchEnabled: env.LEMLIST_LAUNCH_ENABLED === "true",
  };
}
