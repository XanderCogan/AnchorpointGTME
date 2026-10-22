import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import type { AttioRecordPayload } from "../packages/core/src/attio-mapping.ts";
import { candidatesFromAttio, parseApprovals } from "../packages/connectors/src/lemlist/attio-source.ts";
import { LemlistClient } from "../packages/connectors/src/lemlist/client.ts";
import { lemlistConfigFromEnv } from "../packages/connectors/src/lemlist/config.ts";
import {
  executeEnrollment,
  idempotencyKeyFor,
  InMemoryEnrollmentLedger,
  planEnrollment,
  suppressionsFrom,
} from "../packages/connectors/src/lemlist/enrollment.ts";
import { ingestEvent, InMemoryEventStore, normalizeEvent, WebhookSecretError } from "../packages/connectors/src/lemlist/events.ts";
import { engageKillSwitch, InMemoryActivationControls } from "../packages/connectors/src/lemlist/kill-switch.ts";
import { loadPracticeContacts } from "../packages/connectors/src/lemlist/practice.ts";
import {
  assertAllowedRequest,
  LemlistGuardError,
  LemlistTransport,
  sendersAttachedTo,
  type FetchLike,
  type TransportGuards,
} from "../packages/connectors/src/lemlist/transport.ts";

const campaignId = "cam_practice";
const guards: TransportGuards = { launchEnabled: false };
const practice = loadPracticeContacts(resolve(import.meta.dirname, "..", "fixtures", "lemlist-practice-v1", "contacts.json"));

// A stand-in for the Lemlist API that keeps one campaign's leads and answers the
// way the reference documents: 400 for a repeat add, 409 with deduplicate when the
// contact is in another campaign. GET /api/team/senders lists `senderCampaigns`
// as the campaigns of one sender (none by default).
function fakeLemlist(options: { otherCampaignEmails?: string[]; failFirstAddFor?: string; senderCampaigns?: string[] } = {}) {
  const leads = new Map<string, string>();
  const requests: { method: string; url: URL; body: Record<string, unknown> | null; authorization: string }[] = [];
  let failed = false;
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input);
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    const authorization = String((init?.headers as Record<string, string>).Authorization);
    requests.push({ method: init?.method ?? "GET", url, body, authorization });
    if (url.pathname === "/api/team/senders") {
      const campaigns = (options.senderCampaigns ?? []).map((_id) => ({ _id, name: "Fictional", status: "draft", sendingChannels: ["email"] }));
      return Response.json([{ userId: "usr_fictional", campaigns }]);
    }
    if (url.pathname === "/api/unsubscribes") return Response.json([{ _id: "uns_1", email: "jo.kim@savannah-assisted.example.com" }]);
    if (url.pathname.endsWith("/pause")) return Response.json({ _id: campaignId, state: "paused" });
    if (url.pathname === `/api/campaigns/${campaignId}/leads/`) {
      const email = String(body?.email);
      if (email === options.failFirstAddFor && !failed) {
        failed = true;
        return new Response("upstream timeout", { status: 503 });
      }
      if (options.otherCampaignEmails?.includes(email)) return new Response("Lead already in other campaign", { status: 409 });
      if (leads.has(email)) return new Response("Lead already in the campaign", { status: 400 });
      const id = `lea_${leads.size + 1}`;
      leads.set(email, id);
      return Response.json({ _id: id, campaignId, email });
    }
    return new Response("not found", { status: 404 });
  };
  const client = new LemlistClient(new LemlistTransport({ apiKey: "test-key", guards, fetch: fetchImpl }));
  return { client, leads, requests, fetchImpl };
}

async function remoteSuppressions(client: LemlistClient): Promise<string[]> {
  const values: string[] = [];
  for await (const page of client.listUnsubscribes({ pageSize: 100, maxPages: 2 })) values.push(...page.map((row) => row.email ?? ""));
  return values;
}

async function plan(client: LemlistClient, ledger: InMemoryEnrollmentLedger, killSwitchEngaged = false) {
  return planEnrollment({
    campaignId,
    candidates: practice.candidates,
    suppressions: suppressionsFrom(await remoteSuppressions(client), practice.localDoNotContact),
    activeKeys: await ledger.activeKeys(campaignId),
    killSwitchEngaged,
  });
}

test("the dry-run plan is deny-first and explains every skip", async () => {
  const { client, requests } = fakeLemlist();
  const decisions = await plan(client, new InMemoryEnrollmentLedger());
  assert.deepEqual(
    decisions.map((decision) => [decision.contactKey, decision.action === "enroll" ? "enroll" : decision.reason]),
    [
      ["practice-001", "enroll"],
      ["practice-002", "enroll"],
      ["practice-003", "not_approved"],
      ["practice-004", "duplicate_in_request"],
      ["practice-005", "missing_email"],
      ["practice-006", "suppressed_domain"],
      ["practice-007", "suppressed_email"],
    ],
  );
  assert.ok(requests.every((request) => request.method === "GET"), "planning makes no write");
});

test("repeated and concurrent enrollment never adds a contact twice", async () => {
  const { client, leads } = fakeLemlist();
  const ledger = new InMemoryEnrollmentLedger();
  const decisions = await plan(client, ledger);
  const [first, second] = await Promise.all([
    executeEnrollment(client, ledger, campaignId, decisions),
    executeEnrollment(client, ledger, campaignId, decisions),
  ]);
  assert.equal(leads.size, 2);
  assert.equal([...first, ...second].filter((outcome) => outcome.result === "enrolled").length, 2);
  assert.equal([...first, ...second].filter((outcome) => outcome.result === "claimed_elsewhere").length, 2);

  const replanned = await plan(client, ledger);
  assert.equal(replanned.filter((decision) => decision.action === "enroll").length, 0);
  assert.deepEqual(await executeEnrollment(client, ledger, campaignId, replanned), []);
});

test("a lead Lemlist already holds settles as enrolled without a second write", async () => {
  const { client, leads } = fakeLemlist();
  await client.addLead(campaignId, { email: "dana.whitfield@peachtree-living.example.com" });
  const ledger = new InMemoryEnrollmentLedger();
  const outcomes = await executeEnrollment(client, ledger, campaignId, await plan(client, ledger));
  assert.equal(outcomes.find((outcome) => outcome.contactKey === "practice-001")?.result, "already_in_campaign");
  assert.equal(leads.size, 2);
  assert.equal(ledger.entries.get(idempotencyKeyFor(campaignId, "dana.whitfield@peachtree-living.example.com"))?.status, "enrolled");
});

test("a failed add can be retried; another-campaign conflicts are final", async () => {
  const { client, leads } = fakeLemlist({
    failFirstAddFor: "dana.whitfield@peachtree-living.example.com",
    otherCampaignEmails: ["marcus.hale@peachtree-living.example.com"],
  });
  const ledger = new InMemoryEnrollmentLedger();
  const first = await executeEnrollment(client, ledger, campaignId, await plan(client, ledger));
  assert.deepEqual(first.map((outcome) => outcome.result), ["failed", "rejected_other_campaign"]);

  const retry = await executeEnrollment(client, ledger, campaignId, await plan(client, ledger));
  assert.deepEqual(retry.map((outcome) => [outcome.contactKey, outcome.result]), [["practice-001", "enrolled"]]);
  assert.equal(leads.size, 1);
});

test("the kill switch blocks every enrollment and pauses the campaign", async () => {
  const { client, requests } = fakeLemlist();
  const controls = new InMemoryActivationControls();
  const result = await engageKillSwitch(client, controls, campaignId, "practice stop");
  assert.equal(result.lemlistState, "paused");
  assert.ok(requests.some((request) => request.url.pathname === `/api/campaigns/${campaignId}/pause`));
  const decisions = await plan(client, new InMemoryEnrollmentLedger(), await controls.killSwitchEngaged(campaignId));
  assert.ok(decisions.every((decision) => decision.action === "skip" && decision.reason === "kill_switch"));
});

test("the transport never launches a campaign while launch is off", async () => {
  let called = false;
  const client = new LemlistClient(
    new LemlistTransport({ apiKey: "k", guards, fetch: async () => ((called = true), Response.json({ _id: campaignId, state: "running" })) }),
  );
  await assert.rejects(client.startCampaign(campaignId), LemlistGuardError);
  assert.equal(called, false);
  assert.equal(lemlistConfigFromEnv({ LEMLIST_API_KEY: "k" })?.launchEnabled, false);
  assert.equal(lemlistConfigFromEnv({ LEMLIST_API_KEY: "k", LEMLIST_LAUNCH_ENABLED: "yes" })?.launchEnabled, false);
});

test("any campaign and lead domain may be written, but only listed resources", () => {
  const add = (path: string, email: string) => ({ method: "POST" as const, path, body: { email } });
  assert.doesNotThrow(() => assertAllowedRequest(add("/api/campaigns/cam_other/leads/", "a@example.com"), guards));
  assert.doesNotThrow(() => assertAllowedRequest(add(`/api/campaigns/${campaignId}/leads/`, "a@another.example.org"), guards));
  assert.throws(() => assertAllowedRequest(add(`/api/campaigns/${campaignId}/leads/`, "no-address"), guards), LemlistGuardError);
  assert.doesNotThrow(() => assertAllowedRequest({ method: "POST", path: "/api/campaigns/cam_other/pause" }, guards));
  assert.throws(() => assertAllowedRequest({ method: "POST", path: "/api/campaigns/cam_other/start" }, guards), LemlistGuardError);
  assert.throws(() => assertAllowedRequest({ method: "POST", path: "/api/team" }, guards), LemlistGuardError);
  assert.throws(() => assertAllowedRequest({ method: "GET", path: "/api/campaigns/x/export" }, guards), LemlistGuardError);
});

test("enrollment into a campaign with a sender attached is refused before any add", async () => {
  const { client, leads, requests } = fakeLemlist({ senderCampaigns: [campaignId] });
  const ledger = new InMemoryEnrollmentLedger();
  await assert.rejects(executeEnrollment(client, ledger, campaignId, await plan(client, ledger)), /has a sender attached/);
  assert.equal(leads.size, 0);
  assert.ok(!requests.some((request) => request.method === "POST"), "no write reaches Lemlist");
  assert.ok([...ledger.entries.values()].every((entry) => entry.status === "failed"), "the refused claim stays retryable");

  // A sender on a different campaign does not block this one.
  const other = fakeLemlist({ senderCampaigns: ["cam_with_mailbox"] });
  const outcomes = await executeEnrollment(other.client, new InMemoryEnrollmentLedger(), campaignId, await plan(other.client, new InMemoryEnrollmentLedger()));
  assert.equal(outcomes.filter((outcome) => outcome.result === "enrolled").length, 2);
});

test("the sender check fails closed and also guards a launch", async () => {
  assert.deepEqual(sendersAttachedTo({ data: [] }, campaignId), ["unreadable /api/team/senders response"]);
  assert.deepEqual(sendersAttachedTo([{ userId: "usr_x" }], campaignId), ["usr_x"]);
  assert.deepEqual(sendersAttachedTo([{ userId: "usr_x", campaigns: [{ _id: "cam_else" }] }], campaignId), []);

  const unreachable: FetchLike = async (input) =>
    new URL(input).pathname === "/api/team/senders" ? new Response("down", { status: 503 }) : Response.json({ _id: "lea_1" });
  const client = new LemlistClient(new LemlistTransport({ apiKey: "k", guards, fetch: unreachable }));
  await assert.rejects(client.addLead(campaignId, { email: "a@example.com" }), /503/);

  // Even with launch switched on, a campaign with a sender is never started.
  const { fetchImpl } = fakeLemlist({ senderCampaigns: [campaignId] });
  const enabled = new LemlistClient(new LemlistTransport({ apiKey: "k", guards: { launchEnabled: true }, fetch: fetchImpl }));
  await assert.rejects(enabled.startCampaign(campaignId), LemlistGuardError);
});

const attioRecord = (recordId: string, values: Record<string, Record<string, unknown>[]>): AttioRecordPayload => ({
  id: { record_id: recordId },
  created_at: "2026-10-22T12:00:00Z",
  values,
});

test("Attio mirror people linked to companies pass the same deny-first plan", async () => {
  const companies = [attioRecord("co_1", { name: [{ value: "Fictional Oaks Living" }], domains: [{ domain: "oaks.example.com" }] })];
  const person = (id: string, email: string | null, extra: Record<string, Record<string, unknown>[]> = {}) =>
    attioRecord(id, {
      name: [{ first_name: "Pat", last_name: id }],
      company: [{ target_record_id: "co_1" }],
      ...(email ? { email_addresses: [{ email_address: email }] } : {}),
      ...extra,
    });
  const source = candidatesFromAttio({
    companies,
    people: [
      person("pe_1", "pat.one@oaks.example.com", { job_title: [{ value: "Executive Director" }] }),
      person("pe_2", "pat.two@oaks.example.com"),
      person("pe_3", null),
      person("pe_4", "pat.four@oaks.example.com", { email_opt_out: [{ value: true }] }),
      attioRecord("pe_5", { email_addresses: [{ email_address: "pat.five@oaks.example.com" }] }),
    ],
    approvals: parseApprovals(
      ["pe_1", "pe_3", "pe_4"].map((contactKey) => ({ contactKey, approvedBy: "fictional-rep", approvedAt: "2026-10-22T13:00:00Z" })),
    ),
  });
  assert.deepEqual(source.unlinked, ["pe_5"]);
  assert.deepEqual(source.candidates[0], {
    contactKey: "pe_1",
    email: "pat.one@oaks.example.com",
    firstName: "Pat",
    lastName: "pe_1",
    companyName: "Fictional Oaks Living",
    companyDomain: "oaks.example.com",
    jobTitle: "Executive Director",
    approval: { approvedBy: "fictional-rep", approvedAt: "2026-10-22T13:00:00Z" },
  });

  const ledger = new InMemoryEnrollmentLedger();
  const decisions = planEnrollment({
    campaignId: "cam_any",
    candidates: source.candidates,
    suppressions: suppressionsFrom([], source.localDoNotContact),
    activeKeys: await ledger.activeKeys("cam_any"),
    killSwitchEngaged: false,
  });
  assert.deepEqual(
    decisions.map((decision) => [decision.contactKey, decision.action === "enroll" ? "enroll" : decision.reason]),
    [
      ["pe_1", "enroll"],
      ["pe_2", "not_approved"],
      ["pe_3", "missing_email"],
      ["pe_4", "suppressed_email"],
    ],
  );
  assert.throws(() => parseApprovals([{ contactKey: "pe_1" }]));
});

test("requests use Basic auth with an empty login and the API key", async () => {
  const { client, requests } = fakeLemlist();
  await remoteSuppressions(client);
  assert.equal(requests[0]?.authorization, `Basic ${Buffer.from(":test-key").toString("base64")}`);
});

test("webhook events check the secret, ingest once, and suppress unsubscribes and bounces", async () => {
  const raw = {
    _id: "act_1",
    type: "emailsUnsubscribed",
    createdAt: "2026-10-22T15:00:00Z",
    campaignId,
    leadEmail: "Dana.Whitfield@peachtree-living.example.com",
    secret: "s3cret",
  };
  assert.throws(() => normalizeEvent({ ...raw, secret: "wrong" }, "s3cret"), WebhookSecretError);
  assert.throws(() => normalizeEvent({ ...raw, secret: undefined }, "s3cret"), WebhookSecretError);

  const store = new InMemoryEventStore();
  const event = normalizeEvent(raw, "s3cret");
  assert.equal(event.payload.secret, undefined);
  assert.equal(await ingestEvent(store, event), "recorded");
  assert.equal(await ingestEvent(store, event), "duplicate");
  assert.equal(store.suppressed.get("dana.whitfield@peachtree-living.example.com"), "lemlist emailsUnsubscribed");

  await ingestEvent(store, normalizeEvent({ ...raw, _id: "act_2", type: "emailsOpened", leadEmail: "jo@x.example.com" }, "s3cret"));
  assert.equal(store.suppressed.has("jo@x.example.com"), false);
});
