import type {
  LedgerSnapshot,
  ReviewItem,
  WritebackObject,
  WritebackStore,
} from "../../connectors/src/attio/writeback.ts";
import { pool } from "./client.ts";

// PostgreSQL implementation of the Attio writeback ledger and review queue. Review
// inserts rely on the primary key, so a repeated run cannot queue an item twice.
export class PostgresAttioWriteback implements WritebackStore {
  async loadLedger(connectionId: string): Promise<LedgerSnapshot> {
    const [values, created] = await Promise.all([
      pool().query<{ object_type: string; record_id: string; attribute: string; normalized_value: string }>(
        "SELECT object_type, record_id, attribute, normalized_value FROM attio_writeback_values WHERE connection_id = $1",
        [connectionId],
      ),
      pool().query<{ object_type: string; source_key: string; record_id: string }>(
        "SELECT object_type, source_key, record_id FROM attio_writeback_created WHERE connection_id = $1",
        [connectionId],
      ),
    ]);
    return {
      written: new Map(values.rows.map((row) => [`${row.object_type}:${row.record_id}:${row.attribute}`, row.normalized_value])),
      created: new Map(created.rows.map((row) => [`${row.object_type}:${row.source_key}`, row.record_id])),
    };
  }

  async recordCreated(connectionId: string, objectType: WritebackObject, sourceKey: string, recordId: string): Promise<void> {
    await pool().query(
      `INSERT INTO attio_writeback_created (connection_id, object_type, source_key, record_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (connection_id, object_type, source_key) DO UPDATE SET record_id = EXCLUDED.record_id, created_at = now()`,
      [connectionId, objectType, sourceKey, recordId],
    );
  }

  async recordWritten(connectionId: string, objectType: WritebackObject, recordId: string, written: Record<string, string>): Promise<void> {
    for (const [attribute, value] of Object.entries(written)) {
      await pool().query(
        `INSERT INTO attio_writeback_values (connection_id, object_type, record_id, attribute, normalized_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (connection_id, object_type, record_id, attribute)
         DO UPDATE SET normalized_value = EXCLUDED.normalized_value, written_at = now()`,
        [connectionId, objectType, recordId, attribute, value],
      );
    }
  }

  async enqueueReview(connectionId: string, item: ReviewItem): Promise<boolean> {
    const result = await pool().query(
      `INSERT INTO attio_writeback_reviews
        (connection_id, review_key, object_type, record_id, source_key, reason, attribute, current_value, proposed_value, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (connection_id, review_key) DO NOTHING`,
      [
        connectionId,
        item.key,
        item.objectType,
        item.recordId,
        item.sourceKey,
        item.reason,
        item.attribute,
        item.currentValue,
        item.proposedValue,
        item.detail,
      ],
    );
    return result.rowCount === 1;
  }
}

export async function openWritebackReviews(connectionId: string): Promise<ReviewItem[]> {
  const result = await pool().query<{
    review_key: string;
    object_type: WritebackObject;
    record_id: string | null;
    source_key: string;
    reason: ReviewItem["reason"];
    attribute: string | null;
    current_value: string | null;
    proposed_value: string | null;
    detail: string;
  }>(
    `SELECT review_key, object_type, record_id, source_key, reason, attribute, current_value, proposed_value, detail
     FROM attio_writeback_reviews WHERE connection_id = $1 AND status = 'open' ORDER BY queued_at, review_key`,
    [connectionId],
  );
  return result.rows.map((row) => ({
    key: row.review_key,
    objectType: row.object_type,
    recordId: row.record_id,
    sourceKey: row.source_key,
    reason: row.reason,
    attribute: row.attribute,
    currentValue: row.current_value,
    proposedValue: row.proposed_value,
    detail: row.detail,
  }));
}
