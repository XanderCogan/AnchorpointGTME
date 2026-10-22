import { z } from "zod";
import type { ReadOnlyTransport } from "./transport.ts";

const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Expected an ISO datetime.");

// Attio returns each attribute as an array of currently active values. Value
// shapes differ by attribute type, so they are kept as loose objects here and
// interpreted by the audit mapping.
const attributeValueSchema = z.object({ active_from: isoDateTime.nullable().optional() }).catchall(z.unknown());

export const attioRecordSchema = z.object({
  id: z.object({ workspace_id: z.string(), object_id: z.string(), record_id: z.string().min(1) }),
  created_at: isoDateTime,
  values: z.record(z.string(), z.array(attributeValueSchema)),
}).catchall(z.unknown());

export const workspaceMemberSchema = z.object({
  id: z.object({ workspace_id: z.string(), workspace_member_id: z.string().min(1) }),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email_address: z.string().nullable(),
  access_level: z.string(),
  created_at: isoDateTime,
}).catchall(z.unknown());

export const taskSchema = z.object({
  id: z.object({ workspace_id: z.string(), task_id: z.string().min(1) }),
  content_plaintext: z.string().nullable().optional(),
  deadline_at: isoDateTime.nullable(),
  is_completed: z.boolean(),
  linked_records: z.array(z.object({ target_object_id: z.string(), target_record_id: z.string() })),
  assignees: z.array(z.object({ referenced_actor_type: z.string(), referenced_actor_id: z.string() })),
  created_at: isoDateTime,
}).catchall(z.unknown());

const listOf = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });

export type AttioRecord = z.infer<typeof attioRecordSchema>;
export type AttioWorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type AttioTask = z.infer<typeof taskSchema>;

export interface PageOptions {
  pageSize: number;
  maxPages: number;
}

function assertPageOptions(options: PageOptions): void {
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error("pageSize must be an integer from 1 to 500.");
  }
}

// The public client is read-only. It has no create, update, assert, or delete
// methods; the transport refuses them even if added later.
export class AttioReadClient {
  readonly #transport: ReadOnlyTransport;

  constructor(transport: ReadOnlyTransport) {
    this.#transport = transport;
  }

  // Offset pages ordered by creation time, ending on the first short page and
  // refusing to read past maxPages.
  async *queryRecords(objectSlug: string, options: PageOptions): AsyncGenerator<AttioRecord[]> {
    assertPageOptions(options);
    for (let page = 0; ; page += 1) {
      if (page >= options.maxPages) {
        throw new Error(`${objectSlug} exceeded the ${options.maxPages}-page bound before the last page.`);
      }
      const response = listOf(attioRecordSchema).parse(
        await this.#transport.send({
          method: "POST",
          url: `/v2/objects/${encodeURIComponent(objectSlug)}/records/query`,
          body: { limit: options.pageSize, offset: page * options.pageSize, sorts: [{ direction: "asc", attribute: "created_at" }] },
        }),
      );
      yield response.data;
      if (response.data.length < options.pageSize) return;
    }
  }

  async *listTasks(options: PageOptions): AsyncGenerator<AttioTask[]> {
    assertPageOptions(options);
    for (let page = 0; ; page += 1) {
      if (page >= options.maxPages) throw new Error(`tasks exceeded the ${options.maxPages}-page bound before the last page.`);
      const query = new URLSearchParams({
        limit: String(options.pageSize),
        offset: String(page * options.pageSize),
        sort: "created_at:asc",
      });
      const response = listOf(taskSchema).parse(await this.#transport.send({ method: "GET", url: `/v2/tasks?${query}` }));
      yield response.data;
      if (response.data.length < options.pageSize) return;
    }
  }

  async listWorkspaceMembers(): Promise<AttioWorkspaceMember[]> {
    return listOf(workspaceMemberSchema).parse(await this.#transport.send({ method: "GET", url: "/v2/workspace_members" })).data;
  }
}
