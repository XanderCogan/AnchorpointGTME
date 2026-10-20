import { z } from "zod";
import type { ReadOnlyTransport } from "./transport.ts";

// Salesforce returns offsets as +0000; ISO parsers expect +00:00.
const salesforceDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/, "Expected a Salesforce datetime.");

export const salesforceRecordSchema = z
  .object({
    attributes: z.object({ type: z.string().min(1), url: z.string().min(1) }),
    Id: z.string().regex(/^[A-Za-z0-9]{18}$/, "Expected an 18-character Salesforce ID."),
    CreatedDate: salesforceDateTime,
    LastModifiedDate: salesforceDateTime,
    SystemModstamp: salesforceDateTime,
  })
  .catchall(z.unknown());

export const queryResponseSchema = z.object({
  totalSize: z.number().int().nonnegative(),
  done: z.boolean(),
  nextRecordsUrl: z.string().min(1).optional(),
  records: z.array(salesforceRecordSchema),
});

export type SalesforceRecord = z.infer<typeof salesforceRecordSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;

export interface QueryPage {
  url: string;
  response: QueryResponse;
}

// The public client is query-only. It deliberately has no create, update, delete,
// upsert, or composite methods; the transport refuses them even if added later.
export class SalesforceReadClient {
  readonly #transport: ReadOnlyTransport;
  readonly #apiVersion: string;

  constructor(transport: ReadOnlyTransport, apiVersion: string) {
    this.#transport = transport;
    this.#apiVersion = apiVersion;
  }

  // Follows nextRecordsUrl until done, refusing to read more than maxPages pages.
  async *queryPages(soql: string, options: { maxPages: number }): AsyncGenerator<QueryPage> {
    let url: string | undefined = `/services/data/${this.#apiVersion}/query?q=${encodeURIComponent(soql)}`;
    let pages = 0;
    while (url) {
      if (pages >= options.maxPages) {
        throw new Error(`Query exceeded the ${options.maxPages}-page bound before Salesforce reported done.`);
      }
      const response = queryResponseSchema.parse(await this.#transport.send({ method: "GET", url }));
      pages += 1;
      yield { url, response };
      if (response.done) return;
      if (!response.nextRecordsUrl) throw new Error("Salesforce reported done=false without nextRecordsUrl.");
      url = response.nextRecordsUrl;
    }
  }
}

export function normalizeSalesforceDateTime(value: string): string {
  const withColon = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(withColon);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid Salesforce datetime ${value}.`);
  return parsed.toISOString();
}
