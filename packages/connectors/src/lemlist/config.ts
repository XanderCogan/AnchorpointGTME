// Lemlist connector configuration (Milestone 6, decision 0012). The connector calls
// the real Lemlist API, but launching a campaign stays switched off: launchEnabled is
// true only when LEMLIST_LAUNCH_ENABLED is exactly "true", and this project never
// sets it.
export interface LemlistConnectionConfig {
  apiKey: string;
  // The one test campaign live writes may touch. Lead and campaign writes to any
  // other campaign ID are refused by the transport.
  campaignId: string | null;
  // Lead email domains the connector may add. Defaults to example.com, the
  // practice fixtures' reserved domain; "*" allows any domain.
  allowedLeadDomains: string[] | "*";
  launchEnabled: boolean;
}

type Env = Record<string, string | undefined>;

export function parseAllowedDomains(raw: string | undefined): string[] | "*" {
  if (raw?.trim() === "*") return "*";
  const domains = (raw ?? "example.com")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) throw new Error("LEMLIST_ALLOWED_LEAD_DOMAINS must name at least one domain or be *.");
  return domains;
}

// Returns null when no API key is configured.
export function lemlistConfigFromEnv(env: Env = process.env): LemlistConnectionConfig | null {
  const apiKey = env.LEMLIST_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    campaignId: env.LEMLIST_CAMPAIGN_ID || null,
    allowedLeadDomains: parseAllowedDomains(env.LEMLIST_ALLOWED_LEAD_DOMAINS),
    launchEnabled: env.LEMLIST_LAUNCH_ENABLED === "true",
  };
}
