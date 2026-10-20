import {
  ConcurrentSyncError,
  classifyRecord,
  laterWatermark,
  type ObjectSyncBatch,
  type ObjectSyncResult,
  type SalesforceMirrorStore,
} from "../../connectors/src/salesforce/mirror.ts";
import { pool, withTransaction } from "./client.ts";

// PostgreSQL implementation of the Salesforce mirror. Each object batch applies in
// one transaction under a per-connection advisory lock, so concurrent syncs of the
// same connection serialize and a moved watermark aborts the later batch.
export class PostgresSalesforceMirror implements SalesforceMirrorStore {
  async getWatermark(connectionId: string, objectType: string): Promise<string | null> {
    const result = await pool().query<{ watermark: Date }>(
      "SELECT watermark FROM salesforce_sync_watermarks WHERE connection_id = $1 AND object_type = $2",
      [connectionId, objectType],
    );
    return result.rows[0]?.watermark.toISOString() ?? null;
  }

  async applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult> {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('salesforce-sync:' || $1))", [batch.connectionId]);

      const currentRow = await client.query<{ watermark: Date }>(
        `SELECT watermark FROM salesforce_sync_watermarks
         WHERE connection_id = $1 AND object_type = $2
         FOR UPDATE`,
        [batch.connectionId, batch.objectType],
      );
      const current = currentRow.rows[0]?.watermark.toISOString() ?? null;
      if (current !== batch.expectedWatermark) throw new ConcurrentSyncError(batch.connectionId, batch.objectType);

      const existing = await client.query<{ record_id: string; system_modstamp: Date; payload_sha256: string }>(
        `SELECT record_id, system_modstamp, payload_sha256
         FROM salesforce_records
         WHERE connection_id = $1 AND object_type = $2 AND record_id = ANY($3::text[])
         FOR UPDATE`,
        [batch.connectionId, batch.objectType, batch.records.map((record) => record.recordId)],
      );
      const stored = new Map(
        existing.rows.map((row) => [
          row.record_id,
          { systemModstamp: row.system_modstamp.toISOString(), payloadSha256: row.payload_sha256 },
        ]),
      );

      const result: ObjectSyncResult = {
        objectType: batch.objectType,
        seen: batch.records.length,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        stale: 0,
        watermark: laterWatermark(current, batch.nextWatermark),
      };

      for (const record of batch.records) {
        if (record.objectType !== batch.objectType) {
          throw new Error(`Batch for ${batch.objectType} contains a ${record.objectType} record.`);
        }
        const change = classifyRecord(stored.get(record.recordId), record);
        if (change === "insert" || change === "update") {
          await client.query(
            `INSERT INTO salesforce_records
              (connection_id, object_type, record_id, created_date, last_modified_date,
               system_modstamp, payload, payload_sha256)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
             ON CONFLICT (connection_id, object_type, record_id) DO UPDATE
             SET created_date = EXCLUDED.created_date,
                 last_modified_date = EXCLUDED.last_modified_date,
                 system_modstamp = EXCLUDED.system_modstamp,
                 payload = EXCLUDED.payload,
                 payload_sha256 = EXCLUDED.payload_sha256,
                 last_changed_at = now()`,
            [
              batch.connectionId,
              record.objectType,
              record.recordId,
              record.createdDate,
              record.lastModifiedDate,
              record.systemModstamp,
              JSON.stringify(record.payload),
              record.payloadSha256,
            ],
          );
          stored.set(record.recordId, { systemModstamp: record.systemModstamp, payloadSha256: record.payloadSha256 });
        }
        result[change === "insert" ? "inserted" : change === "update" ? "updated" : change] += 1;
      }

      if (result.watermark !== current) {
        await client.query(
          `INSERT INTO salesforce_sync_watermarks (connection_id, object_type, watermark)
           VALUES ($1, $2, $3)
           ON CONFLICT (connection_id, object_type) DO UPDATE
           SET watermark = EXCLUDED.watermark, updated_at = now()`,
          [batch.connectionId, batch.objectType, result.watermark],
        );
      }

      await client.query(
        `INSERT INTO salesforce_sync_runs
          (connection_id, object_type, window_start, window_end, pages, records_seen,
           records_inserted, records_updated, records_unchanged, records_stale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          batch.connectionId,
          batch.objectType,
          batch.windowStart,
          batch.windowEnd,
          batch.pages,
          result.seen,
          result.inserted,
          result.updated,
          result.unchanged,
          result.stale,
        ],
      );
      return result;
    });
  }
}

// Removes one connection's mirror rows. Used only to reset the synthetic
// recorded-fixture connection before its verification run.
export async function resetSalesforceConnection(connectionId: string): Promise<void> {
  await withTransaction(async (client) => {
    for (const table of ["salesforce_records", "salesforce_sync_watermarks", "salesforce_sync_runs"]) {
      await client.query(`DELETE FROM ${table} WHERE connection_id = $1`, [connectionId]);
    }
  });
}

export async function countSalesforceRecords(connectionId: string): Promise<Record<string, number>> {
  const result = await pool().query<{ object_type: string; count: string }>(
    `SELECT object_type, count(*)::text AS count FROM salesforce_records
     WHERE connection_id = $1 GROUP BY object_type ORDER BY object_type`,
    [connectionId],
  );
  return Object.fromEntries(result.rows.map((row) => [row.object_type, Number(row.count)]));
}
