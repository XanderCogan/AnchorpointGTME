import { createHash } from "node:crypto";
import { normalizeSalesforceDateTime, type SalesforceRecord } from "./client.ts";

// A source record ready for the local mirror. payload is stored exactly as
// Salesforce returned it, so the original timestamp strings are preserved; the
// normalized ISO values exist for indexing and comparison.
export interface MirrorRecord {
  objectType: string;
  recordId: string;
  createdDate: string;
  lastModifiedDate: string;
  systemModstamp: string;
  payload: SalesforceRecord;
  payloadSha256: string;
}

export interface ObjectSyncBatch {
  connectionId: string;
  objectType: string;
  windowStart: string;
  windowEnd: string;
  // The watermark this run read before fetching. The store refuses to apply the
  // batch if another run moved it in the meantime.
  expectedWatermark: string | null;
  nextWatermark: string;
  pages: number;
  records: MirrorRecord[];
}

export interface ObjectSyncResult {
  objectType: string;
  seen: number;
  inserted: number;
  updated: number;
  unchanged: number;
  stale: number;
  watermark: string;
}

export interface SalesforceMirrorStore {
  getWatermark(connectionId: string, objectType: string): Promise<string | null>;
  applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult>;
}

export class ConcurrentSyncError extends Error {
  constructor(connectionId: string, objectType: string) {
    super(`The ${objectType} watermark for ${connectionId} changed during the sync; the batch was not applied.`);
    this.name = "ConcurrentSyncError";
  }
}

export type RecordChange = "insert" | "update" | "unchanged" | "stale";

export interface StoredVersion {
  systemModstamp: string;
  payloadSha256: string;
}

// The single change rule both stores apply. A replayed older page never
// overwrites a newer stored version, and an identical payload is not a change.
export function classifyRecord(existing: StoredVersion | undefined, incoming: MirrorRecord): RecordChange {
  if (!existing) return "insert";
  if (existing.payloadSha256 === incoming.payloadSha256) return "unchanged";
  if (Date.parse(incoming.systemModstamp) < Date.parse(existing.systemModstamp)) return "stale";
  return "update";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// attributes.url embeds the API version, so it is excluded from the content hash
// to keep an API-version upgrade from rewriting every row.
export function toMirrorRecord(record: SalesforceRecord): MirrorRecord {
  const { attributes, ...fields } = record;
  return {
    objectType: attributes.type,
    recordId: record.Id,
    createdDate: normalizeSalesforceDateTime(record.CreatedDate),
    lastModifiedDate: normalizeSalesforceDateTime(record.LastModifiedDate),
    systemModstamp: normalizeSalesforceDateTime(record.SystemModstamp),
    payload: record,
    payloadSha256: createHash("sha256").update(canonicalJson(fields)).digest("hex"),
  };
}

export function laterWatermark(current: string | null, next: string): string {
  return current && Date.parse(current) > Date.parse(next) ? current : next;
}

// Same semantics as the PostgreSQL store, for tests and dry runs.
export class InMemoryMirrorStore implements SalesforceMirrorStore {
  readonly records = new Map<string, MirrorRecord>();
  readonly watermarks = new Map<string, string>();
  writes = 0;

  async getWatermark(connectionId: string, objectType: string): Promise<string | null> {
    return this.watermarks.get(`${connectionId}|${objectType}`) ?? null;
  }

  async applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult> {
    const watermarkKey = `${batch.connectionId}|${batch.objectType}`;
    const current = this.watermarks.get(watermarkKey) ?? null;
    if (current !== batch.expectedWatermark) throw new ConcurrentSyncError(batch.connectionId, batch.objectType);

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
      const key = `${batch.connectionId}|${record.objectType}|${record.recordId}`;
      const change = classifyRecord(this.records.get(key), record);
      if (change === "insert" || change === "update") {
        this.records.set(key, record);
        this.writes += 1;
      }
      result[change === "insert" ? "inserted" : change === "update" ? "updated" : change] += 1;
    }
    if (result.watermark !== current) this.watermarks.set(watermarkKey, result.watermark);
    return result;
  }
}
