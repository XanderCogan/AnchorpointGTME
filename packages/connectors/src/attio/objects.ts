// What the read-only Attio connector mirrors, following the object mapping in
// docs/decisions/0011-attio-crm-system-of-record.md. Sites and call logs are
// custom objects, so their slugs are configurable.

export type AttioSnapshotKey = "member" | "company" | "site" | "person" | "deal" | "call" | "task";

export type AttioObjectSpec =
  | { key: AttioSnapshotKey; kind: "record"; objectType: string }
  | { key: "member"; kind: "members"; objectType: "workspace_members" }
  | { key: "task"; kind: "tasks"; objectType: "tasks" };

export interface CustomObjectSlugs {
  site?: string;
  call?: string;
}

export const defaultCustomObjectSlugs = { site: "sites", call: "calls" } as const;

// Sync order puts referenced objects first so a mirror read mid-run is less surprising.
export function objectSpecs(slugs: CustomObjectSlugs = {}): AttioObjectSpec[] {
  return [
    { key: "member", kind: "members", objectType: "workspace_members" },
    { key: "company", kind: "record", objectType: "companies" },
    { key: "site", kind: "record", objectType: slugs.site ?? defaultCustomObjectSlugs.site },
    { key: "person", kind: "record", objectType: "people" },
    { key: "deal", kind: "record", objectType: "deals" },
    { key: "call", kind: "record", objectType: slugs.call ?? defaultCustomObjectSlugs.call },
    { key: "task", kind: "tasks", objectType: "tasks" },
  ];
}
