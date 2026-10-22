import type { AttioReadClient } from "./client.ts";
import { memberToMirror, recordToMirror, taskToMirror, type AttioMirrorStore, type MirrorRecord, type ObjectSyncResult } from "./mirror.ts";
import type { AttioObjectSpec } from "./objects.ts";

// Attio exposes no record-level modified timestamp to filter on, so each run is
// a bounded full read of every mirrored object. Unchanged payloads are not
// rewritten, so a repeated run is idempotent.
export interface SyncBounds {
  connectionId: string;
  pageSize: number;
  maxPagesPerObject: number;
}

export interface ObjectSyncReport extends ObjectSyncResult {
  pages: number;
}

export async function syncObject(
  client: AttioReadClient,
  store: AttioMirrorStore,
  spec: AttioObjectSpec,
  bounds: SyncBounds,
): Promise<ObjectSyncReport> {
  const startedAt = new Date().toISOString();
  const pageOptions = { pageSize: bounds.pageSize, maxPages: bounds.maxPagesPerObject };
  const records: MirrorRecord[] = [];
  let pages = 0;

  if (spec.kind === "members") {
    pages = 1;
    records.push(...(await client.listWorkspaceMembers()).map(memberToMirror));
  } else if (spec.kind === "tasks") {
    for await (const page of client.listTasks(pageOptions)) {
      pages += 1;
      records.push(...page.map(taskToMirror));
    }
  } else {
    for await (const page of client.queryRecords(spec.objectType, pageOptions)) {
      pages += 1;
      records.push(...page.map((record) => recordToMirror(spec.objectType, record)));
    }
  }

  // Offset paging over live data can repeat a record when another one is created
  // mid-read; the later copy wins.
  const unique = [...new Map(records.map((record) => [record.recordId, record])).values()];
  const result = await store.applyObjectSync({
    connectionId: bounds.connectionId,
    objectType: spec.objectType,
    startedAt,
    pages,
    records: unique,
  });
  return { ...result, pages };
}

export async function syncObjects(
  client: AttioReadClient,
  store: AttioMirrorStore,
  specs: readonly AttioObjectSpec[],
  bounds: SyncBounds,
): Promise<ObjectSyncReport[]> {
  const reports: ObjectSyncReport[] = [];
  for (const spec of specs) reports.push(await syncObject(client, store, spec, bounds));
  return reports;
}

export function changeCount(reports: readonly ObjectSyncReport[]): number {
  return reports.reduce((total, report) => total + report.inserted + report.updated, 0);
}
