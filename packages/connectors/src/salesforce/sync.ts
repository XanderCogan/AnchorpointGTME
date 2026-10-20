import type { SalesforceReadClient } from "./client.ts";
import { toMirrorRecord, type MirrorRecord, type ObjectSyncResult, type SalesforceMirrorStore } from "./mirror.ts";
import { buildWindowQuery, type SalesforceObjectSpec } from "./objects.ts";

export interface SyncBounds {
  connectionId: string;
  // Lower bound for an object that has never synced. There is no unbounded
  // full-history pull.
  initialSince: Date;
  // Upper bound of the window. Live runs should hold this a couple of minutes
  // behind now, because Salesforce can commit a record with a SystemModstamp
  // slightly earlier than its commit time.
  until: Date;
  maxRecordsPerObject: number;
  maxPagesPerObject: number;
}

export interface ObjectSyncReport extends ObjectSyncResult {
  windowStart: string;
  windowEnd: string;
  pages: number;
  // True when the record limit cut the window short; the next run resumes from
  // the last SystemModstamp read.
  truncated: boolean;
}

function wholeSecond(value: Date): Date {
  return new Date(Math.floor(value.getTime() / 1000) * 1000);
}

export async function syncObject(
  client: SalesforceReadClient,
  store: SalesforceMirrorStore,
  spec: SalesforceObjectSpec,
  bounds: SyncBounds,
): Promise<ObjectSyncReport> {
  if (!Number.isInteger(bounds.maxRecordsPerObject) || bounds.maxRecordsPerObject < 1 || bounds.maxRecordsPerObject > 50_000) {
    throw new Error("maxRecordsPerObject must be an integer from 1 to 50000.");
  }
  const watermark = await store.getWatermark(bounds.connectionId, spec.apiName);
  // The lower bound is inclusive, so records sharing the previous watermark's
  // second are read again and classified as unchanged.
  const since = wholeSecond(new Date(watermark ?? bounds.initialSince));
  const until = wholeSecond(bounds.until);
  if (until < since) throw new Error(`Sync window for ${spec.apiName} ends before it starts.`);

  const soql = buildWindowQuery(spec, { since, until, limit: bounds.maxRecordsPerObject });
  const records: MirrorRecord[] = [];
  let pages = 0;
  for await (const page of client.queryPages(soql, { maxPages: bounds.maxPagesPerObject })) {
    pages += 1;
    for (const raw of page.response.records) {
      if (raw.attributes.type !== spec.apiName) {
        throw new Error(`Expected ${spec.apiName} records but received ${raw.attributes.type}.`);
      }
      records.push(toMirrorRecord(raw));
    }
  }
  if (records.length > bounds.maxRecordsPerObject) {
    throw new Error(`${spec.apiName} returned more records than the SOQL LIMIT allows.`);
  }

  const truncated = records.length === bounds.maxRecordsPerObject;
  let nextWatermark = until.toISOString();
  if (truncated) {
    nextWatermark = records.reduce(
      (latest, record) => (Date.parse(record.systemModstamp) > Date.parse(latest) ? record.systemModstamp : latest),
      since.toISOString(),
    );
    if (Date.parse(nextWatermark) <= since.getTime()) {
      throw new Error(
        `${spec.apiName} has more than ${bounds.maxRecordsPerObject} records sharing SystemModstamp ${nextWatermark}; raise the record bound.`,
      );
    }
  }

  const result = await store.applyObjectSync({
    connectionId: bounds.connectionId,
    objectType: spec.apiName,
    windowStart: since.toISOString(),
    windowEnd: until.toISOString(),
    expectedWatermark: watermark,
    nextWatermark,
    pages,
    records,
  });
  return { ...result, windowStart: since.toISOString(), windowEnd: until.toISOString(), pages, truncated };
}

export async function syncObjects(
  client: SalesforceReadClient,
  store: SalesforceMirrorStore,
  specs: readonly SalesforceObjectSpec[],
  bounds: SyncBounds,
): Promise<ObjectSyncReport[]> {
  const reports: ObjectSyncReport[] = [];
  for (const spec of specs) reports.push(await syncObject(client, store, spec, bounds));
  return reports;
}

export function changeCount(reports: readonly ObjectSyncReport[]): number {
  return reports.reduce((total, report) => total + report.inserted + report.updated, 0);
}
