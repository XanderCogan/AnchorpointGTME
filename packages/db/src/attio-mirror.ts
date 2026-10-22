import {
  classifyRecord,
  type AttioMirrorStore,
  type ObjectSyncBatch,
  type ObjectSyncResult,
} from "../../connectors/src/attio/mirror.ts";
import type { AttioSnapshot, AttioSnapshotKey } from "../../core/src/attio-mapping.ts";
import { pool, withTransaction } from "./client.ts";

// PostgreSQL implementation of the Attio mirror. Each object batch applies in one
// transaction under a per-connection advisory lock, so concurrent syncs of the
// same connection serialize instead of interleaving.
export class PostgresAttioMirror implements AttioMirrorStore {
  async applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult> {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('attio-sync:' || $1))", [batch.connectionId]);

      const existing = await client.query<{ record_id: string; payload_sha256: string }>(
        `SELECT record_id, payload_sha256 FROM attio_records
         WHERE connection_id = $1 AND object_type = $2
         FOR UPDATE`,
        [batch.connectionId, batch.objectType],
      );
      const stored = new Map(existing.rows.map((row) => [row.record_id, row.payload_sha256]));
      const seen = new Set<string>();
      const result: ObjectSyncResult = {
        objectType: batch.objectType,
        seen: batch.records.length,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        missing: 0,
      };

      for (const record of batch.records) {
        if (record.objectType !== batch.objectType) {
          throw new Error(`Batch for ${batch.objectType} contains a ${record.objectType} record.`);
        }
        seen.add(record.recordId);
        const change = classifyRecord(stored.get(record.recordId), record);
        if (change === "unchanged") {
          await client.query(
            `UPDATE attio_records SET last_seen_at = now()
             WHERE connection_id = $1 AND object_type = $2 AND record_id = $3`,
            [batch.connectionId, record.objectType, record.recordId],
          );
        } else {
          await client.query(
            `INSERT INTO attio_records
              (connection_id, object_type, record_id, created_at, source_changed_at, payload, payload_sha256)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
             ON CONFLICT (connection_id, object_type, record_id) DO UPDATE
             SET created_at = EXCLUDED.created_at,
                 source_changed_at = EXCLUDED.source_changed_at,
                 payload = EXCLUDED.payload,
                 payload_sha256 = EXCLUDED.payload_sha256,
                 last_changed_at = now(),
                 last_seen_at = now()`,
            [
              batch.connectionId,
              record.objectType,
              record.recordId,
              record.createdAt,
              record.sourceChangedAt,
              JSON.stringify(record.payload),
              record.payloadSha256,
            ],
          );
          stored.set(record.recordId, record.payloadSha256);
        }
        result[change === "insert" ? "inserted" : change === "update" ? "updated" : "unchanged"] += 1;
      }
      result.missing = [...stored.keys()].filter((recordId) => !seen.has(recordId)).length;

      await client.query(
        `INSERT INTO attio_sync_runs
          (connection_id, object_type, started_at, pages, records_seen, records_inserted,
           records_updated, records_unchanged, records_missing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          batch.connectionId,
          batch.objectType,
          batch.startedAt,
          batch.pages,
          result.seen,
          result.inserted,
          result.updated,
          result.unchanged,
          result.missing,
        ],
      );
      return result;
    });
  }
}

// Removes one connection's mirror rows. Used only to reset the synthetic
// recorded-fixture connection before its verification run.
export async function resetAttioConnection(connectionId: string): Promise<void> {
  await withTransaction(async (client) => {
    for (const table of ["attio_records", "attio_sync_runs"]) {
      await client.query(`DELETE FROM ${table} WHERE connection_id = $1`, [connectionId]);
    }
  });
}

export async function countAttioRecords(connectionId: string): Promise<Record<string, number>> {
  const result = await pool().query<{ object_type: string; count: string }>(
    `SELECT object_type, count(*)::text AS count FROM attio_records
     WHERE connection_id = $1 GROUP BY object_type ORDER BY object_type`,
    [connectionId],
  );
  return Object.fromEntries(result.rows.map((row) => [row.object_type, Number(row.count)]));
}

// Reads one connection's mirror as a frozen snapshot for the audit mapping. The
// window spans the recorded sync runs; payloads are returned exactly as stored.
// `objectKeys` maps mirrored object types (such as a custom site slug) to snapshot keys.
export async function loadAttioSnapshot(
  connectionId: string,
  objectKeys: Readonly<Record<string, AttioSnapshotKey>>,
  provenance: AttioSnapshot["provenance"],
  label: string,
): Promise<AttioSnapshot> {
  const window = await pool().query<{ start: Date | null; end: Date | null }>(
    `SELECT min(started_at) AS start, max(completed_at) AS end FROM attio_sync_runs WHERE connection_id = $1`,
    [connectionId],
  );
  const { start, end } = window.rows[0] ?? { start: null, end: null };
  if (!start || !end) throw new Error(`No sync runs recorded for connection ${connectionId}.`);
  const rows = await pool().query<{ object_type: string; payload: unknown }>(
    // Records no longer returned by the latest sync of their object stay mirrored but are
    // left out of the snapshot, so records deleted in Attio are never audited.
    `SELECT r.object_type, r.payload FROM attio_records r
     WHERE r.connection_id = $1
       AND r.last_seen_at >= (
         SELECT max(s.started_at) FROM attio_sync_runs s
         WHERE s.connection_id = r.connection_id AND s.object_type = r.object_type
       )
     ORDER BY r.object_type, r.record_id`,
    [connectionId],
  );
  const records: AttioSnapshot["records"] = {};
  for (const row of rows.rows) {
    const key = objectKeys[row.object_type];
    if (!key) throw new Error(`Mirrored object ${row.object_type} has no snapshot key.`);
    ((records[key] ??= []) as unknown[]).push(row.payload);
  }
  return { provenance, label, window: { start: start.toISOString(), end: end.toISOString() }, records };
}
