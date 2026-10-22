import { createHash } from "node:crypto";
import type { AttioRecord, AttioTask, AttioWorkspaceMember } from "./client.ts";

export type AttioPayload = AttioRecord | AttioWorkspaceMember | AttioTask;

// A source record ready for the local mirror. payload is stored exactly as Attio
// returned it. sourceChangedAt is the latest active_from across a record's
// values (Attio has no record-level modified timestamp), or created_at.
export interface MirrorRecord {
  objectType: string;
  recordId: string;
  createdAt: string;
  sourceChangedAt: string;
  payload: AttioPayload;
  payloadSha256: string;
}

export interface ObjectSyncBatch {
  connectionId: string;
  objectType: string;
  startedAt: string;
  pages: number;
  records: MirrorRecord[];
}

export interface ObjectSyncResult {
  objectType: string;
  seen: number;
  inserted: number;
  updated: number;
  unchanged: number;
  // Mirrored records this full read did not return. They are kept, never
  // deleted, and reported so a reviewer can check for deletions or merges.
  missing: number;
}

export interface AttioMirrorStore {
  applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult>;
}

export type RecordChange = "insert" | "update" | "unchanged";

// The single change rule both stores apply: an identical payload is not a change.
export function classifyRecord(existingSha256: string | undefined, incoming: MirrorRecord): RecordChange {
  if (existingSha256 === undefined) return "insert";
  return existingSha256 === incoming.payloadSha256 ? "unchanged" : "update";
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function latestActiveFrom(record: AttioRecord): string {
  let latest = Date.parse(record.created_at);
  for (const values of Object.values(record.values)) {
    for (const value of values) {
      const at = Date.parse(value.active_from ?? "");
      if (Number.isFinite(at) && at > latest) latest = at;
    }
  }
  return new Date(latest).toISOString();
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function recordToMirror(objectType: string, record: AttioRecord): MirrorRecord {
  return {
    objectType,
    recordId: record.id.record_id,
    createdAt: new Date(record.created_at).toISOString(),
    sourceChangedAt: latestActiveFrom(record),
    payload: record,
    payloadSha256: sha256(record),
  };
}

export function memberToMirror(member: AttioWorkspaceMember): MirrorRecord {
  const createdAt = new Date(member.created_at).toISOString();
  return {
    objectType: "workspace_members",
    recordId: member.id.workspace_member_id,
    createdAt,
    sourceChangedAt: createdAt,
    payload: member,
    payloadSha256: sha256(member),
  };
}

export function taskToMirror(task: AttioTask): MirrorRecord {
  const createdAt = new Date(task.created_at).toISOString();
  return {
    objectType: "tasks",
    recordId: task.id.task_id,
    createdAt,
    sourceChangedAt: createdAt,
    payload: task,
    payloadSha256: sha256(task),
  };
}

// Same semantics as the PostgreSQL store, for tests and dry runs.
export class InMemoryMirrorStore implements AttioMirrorStore {
  readonly records = new Map<string, MirrorRecord>();
  writes = 0;

  async applyObjectSync(batch: ObjectSyncBatch): Promise<ObjectSyncResult> {
    const prefix = `${batch.connectionId}|${batch.objectType}|`;
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
      const key = `${prefix}${record.recordId}`;
      seen.add(key);
      const change = classifyRecord(this.records.get(key)?.payloadSha256, record);
      if (change !== "unchanged") {
        this.records.set(key, record);
        this.writes += 1;
      }
      result[change === "insert" ? "inserted" : change === "update" ? "updated" : "unchanged"] += 1;
    }
    result.missing = [...this.records.keys()].filter((key) => key.startsWith(prefix) && !seen.has(key)).length;
    return result;
  }
}
