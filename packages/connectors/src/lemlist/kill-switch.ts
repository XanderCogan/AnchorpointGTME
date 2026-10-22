import type { LemlistClient } from "./client.ts";

// The kill switch stops future steps: once engaged, every enrollment plan skips all
// candidates, and the campaign is paused in Lemlist so queued steps do not run.
export interface ActivationControls {
  killSwitchEngaged(campaignId: string): Promise<boolean>;
  setKillSwitch(campaignId: string, engaged: boolean, reason: string): Promise<void>;
}

export async function engageKillSwitch(
  client: LemlistClient,
  controls: ActivationControls,
  campaignId: string,
  reason: string,
): Promise<{ lemlistState: string | null; error: string | null }> {
  // Local state first, so enrollment stops even if Lemlist is unreachable.
  await controls.setKillSwitch(campaignId, true, reason);
  try {
    return { lemlistState: await client.pauseCampaign(campaignId), error: null };
  } catch (error) {
    return { lemlistState: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export class InMemoryActivationControls implements ActivationControls {
  readonly engaged = new Map<string, string>();

  async killSwitchEngaged(campaignId: string): Promise<boolean> {
    return this.engaged.has(campaignId);
  }

  async setKillSwitch(campaignId: string, engaged: boolean, reason: string): Promise<void> {
    if (engaged) this.engaged.set(campaignId, reason);
    else this.engaged.delete(campaignId);
  }
}
