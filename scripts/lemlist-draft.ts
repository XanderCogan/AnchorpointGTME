// Drafts one signal-based cold email per approved contact from the public fact sheet
// and writes it, with the sheet and model id, to a gitignored draft file for human
// review. Nothing here sends or enrolls: lemlist:enroll reads the file only after a
// person fills reviewedBy and reviewedOn in it. Idempotent: an existing draft is kept
// unless --regenerate is passed.
//
//   --source practice|attio   same input as lemlist:enroll (default practice)
//   --approvals <file.json>   required with --source attio
//   --contact <key>           draft this contact only, approved or not
//   --regenerate              overwrite an existing draft (its review marks are cleared)
//   --out <dir>               draft folder (default data/georgia-sample/private/drafts)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_DRAFTS_DIR, draftPathFor, readDraftFile } from "../packages/connectors/src/lemlist/drafts.ts";
import { loadEnrollmentSource } from "../packages/connectors/src/lemlist/source.ts";
import { draftCopySchema, SYSTEM_PROMPT, validateDraft, type DraftFile } from "../packages/core/src/draft-copy.ts";
import { buildFactSheet, loadDraftData, renderFactSheet } from "../packages/core/src/draft-inputs.ts";
import { closePool } from "../packages/db/src/client.ts";

export const DRAFT_MODEL = "claude-opus-5-5";

const root = resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch {
  // The key may already be in the environment.
}
const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: "practice" },
    approvals: { type: "string" },
    contact: { type: "string" },
    regenerate: { type: "boolean", default: false },
    out: { type: "string", default: resolve(root, DEFAULT_DRAFTS_DIR) },
  },
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Put it in .env (see .env.example) or the environment.");
  process.exit(1);
}

const client = new Anthropic();
const data = loadDraftData(resolve(root, "data", "georgia-sample"));

try {
  const source = await loadEnrollmentSource({ source: args.source, approvals: args.approvals, practicePath: resolve(root, "fixtures", "lemlist-practice-v1", "contacts.json") });
  const wanted = args.contact
    ? source.candidates.filter((c) => c.contactKey === args.contact)
    : source.candidates.filter((c) => c.approval !== null);
  if (wanted.length === 0) {
    console.log(args.contact ? `No contact ${args.contact} in the ${args.source} source.` : "No approved contacts to draft.");
  }
  mkdirSync(args.out, { recursive: true });
  for (const contact of wanted) {
    if (!contact.operatorId || !contact.persona) {
      console.log(`${contact.contactKey}: skipped (no operator id or persona on the contact)`);
      continue;
    }
    if (!args.regenerate && readDraftFile(args.out, contact.contactKey)) {
      console.log(`${contact.contactKey}: kept existing draft (pass --regenerate to replace it)`);
      continue;
    }
    const factSheet = buildFactSheet({ operatorId: contact.operatorId, persona: contact.persona, firstName: contact.firstName, jobTitle: contact.jobTitle }, data);
    const response = await client.messages.parse({
      model: DRAFT_MODEL,
      max_tokens: 4000,
      output_config: { effort: "high", format: zodOutputFormat(draftCopySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Fact sheet:\n\n${renderFactSheet(factSheet)}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.log(`${contact.contactKey}: no draft (stop reason ${response.stop_reason}${response.stop_details ? `, ${response.stop_details.explanation ?? response.stop_details.category}` : ""})`);
      continue;
    }
    const draft = response.parsed_output;
    const check = validateDraft(draft, factSheet);
    const file: DraftFile = {
      contactKey: contact.contactKey,
      operatorId: contact.operatorId,
      persona: contact.persona,
      generatedOn: new Date().toISOString(),
      model: response.model,
      factSheet,
      draft,
      reviewedBy: null,
      reviewedOn: null,
    };
    const path = draftPathFor(args.out, contact.contactKey);
    writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
    console.log(`\n${contact.contactKey} (${contact.firstName ?? "?"}, ${contact.jobTitle ?? "?"} at ${contact.companyName ?? contact.operatorId}): ${check.words} words, ${check.ok ? "passes the validator" : `validator problems: ${check.problems.join("; ")}`}`);
    console.log(`  Subject: ${draft.subject}`);
    console.log(`  Hook: ${draft.hook_fact}`);
    console.log(`  ${draft.icebreaker}\n  ${draft.body.replace(/\n/g, "\n  ")}`);
    console.log(`  Written to ${path}. Review it, then set reviewedBy and reviewedOn in the file before lemlist:enroll will carry it.`);
  }
} finally {
  await closePool();
}
