import type { EnrollmentLedger, LedgerEntry, LedgerStatus } from "../../connectors/src/lemlist/enrollment.ts";
import type { EventStore, NormalizedEvent } from "../../connectors/src/lemlist/events.ts";
import type { ActivationControls } from "../../connectors/src/lemlist/kill-switch.ts";
import { pool } from "./client.ts";

// PostgreSQL implementations of the Lemlist ledger, event store, and activation
// controls. Claims and event inserts rely on primary keys, so concurrent requests
// for the same contact or activity cannot both succeed.

export class PostgresEnrollmentLedger implements EnrollmentLedger {
  async activeKeys(campaignId: string): Promise<Set<string>> {
    const result = await pool().query<{ idempotency_key: string }>(
      "SELECT idempotency_key FROM lemlist_enrollments WHERE campaign_id = $1 AND status <> 'failed'",
      [campaignId],
    );
    return new Set(result.rows.map((row) => row.idempotency_key));
  }

  async claim(entry: Omit<LedgerEntry, "status" | "leadId" | "detail">): Promise<boolean> {
    const result = await pool().query(
      `INSERT INTO lemlist_enrollments (idempotency_key, campaign_id, contact_key, email, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (idempotency_key) DO UPDATE
         SET status = 'pending', detail = NULL, claimed_at = now(), settled_at = NULL
         WHERE lemlist_enrollments.status = 'failed'`,
      [entry.idempotencyKey, entry.campaignId, entry.contactKey, entry.email],
    );
    return result.rowCount === 1;
  }

  async settle(idempotencyKey: string, status: Exclude<LedgerStatus, "pending">, leadId: string | null, detail: string | null): Promise<void> {
    await pool().query(
      `UPDATE lemlist_enrollments SET status = $2, lead_id = $3, detail = $4, settled_at = now()
       WHERE idempotency_key = $1`,
      [idempotencyKey, status, leadId, detail],
    );
  }
}

export class PostgresLemlistEvents implements EventStore {
  async record(event: NormalizedEvent): Promise<boolean> {
    const result = await pool().query(
      `INSERT INTO lemlist_events (activity_id, type, category, campaign_id, lead_id, email, occurred_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (activity_id) DO NOTHING`,
      [event.activityId, event.type, event.category, event.campaignId, event.leadId, event.email, event.occurredAt, event.payload],
    );
    return result.rowCount === 1;
  }

  async suppress(email: string, reason: string): Promise<void> {
    await pool().query("INSERT INTO suppressions (value, reason) VALUES ($1, $2) ON CONFLICT (value) DO NOTHING", [email, reason]);
  }
}

export async function localSuppressions(): Promise<string[]> {
  return (await pool().query<{ value: string }>("SELECT value FROM suppressions")).rows.map((row) => row.value);
}

export class PostgresActivationControls implements ActivationControls {
  async killSwitchEngaged(campaignId: string): Promise<boolean> {
    const result = await pool().query<{ kill_switch_engaged: boolean }>(
      "SELECT kill_switch_engaged FROM activation_controls WHERE campaign_id = $1",
      [campaignId],
    );
    return result.rows[0]?.kill_switch_engaged ?? false;
  }

  async setKillSwitch(campaignId: string, engaged: boolean, reason: string): Promise<void> {
    await pool().query(
      `INSERT INTO activation_controls (campaign_id, kill_switch_engaged, reason) VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id) DO UPDATE SET kill_switch_engaged = $2, reason = $3, updated_at = now()`,
      [campaignId, engaged, reason],
    );
  }
}
