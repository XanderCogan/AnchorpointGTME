import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(projectRoot, "docs", "research", "anchorpoint-discovery-log.xlsx");
const previewDir = path.join(projectRoot, "artifacts");
const previewPath = path.join(previewDir, "anchorpoint-discovery-log.png");

const loggedDate = new Date("2026-10-17T12:00:00-04:00");

const entries = [
  [
    "Q-001",
    loggedDate,
    "Operator",
    "Who would operate Portco Launch Control day to day?",
    "I would expect our Revenue Operations Manager to own the application after launch. Apero's GTM engineer would configure and troubleshoot it during deployment, the Sales Manager would approve outbound plays, and SDRs would work only the resulting task queue.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Design the main view for an operator who resolves blockers and owns handoffs. Keep approval controls visible to sales leadership and keep SDR interaction narrow.",
    "Confirm the real title, backup owner, and approval chain.",
    "Project discovery conversation",
  ],
  [
    "Q-002",
    loggedDate,
    "Business context",
    "What does Anchorpoint sell, and which customers matter most?",
    "We are a fictional PE-backed commercial fire and life-safety service company. We sell recurring inspection, testing, maintenance, and repair services to multi-location senior living, healthcare, hospitality, industrial, and property-management accounts across North Carolina, South Carolina, and Georgia.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Use serviceability, location footprint, facility type, and observable change signals as context for prioritization. Do not convert these descriptions into rigid ICP cutoffs.",
    "Confirm service lines, service territory, and priority account segments.",
    "Fictional Anchorpoint scenario",
  ],
  [
    "Q-003",
    loggedDate,
    "Runtime",
    "Where should the application run?",
    "The dashboard should run on Vercel. The integration API, background worker, scheduled jobs, and PostgreSQL database should run on Railway. HubSpot remains our operational system of record.",
    "Architecture proposal",
    "Proposed",
    "Joint",
    "Separate the user interface from long-running integration work. Keep source-of-truth customer and activity records in HubSpot while storing application state and audit history in PostgreSQL.",
    "Confirm Railway and Vercel accounts, regions, environments, and secrets ownership before deployment.",
    "Project architecture plan",
  ],
  [
    "Q-004",
    loggedDate,
    "CRM health",
    "How should the application audit CRM health?",
    "Use deterministic rules against HubSpot records. Show the exact record, failed rule, severity, evidence, recommended correction, and accountable owner. An AI model may summarize findings, but it should not decide whether the CRM is healthy.",
    "Project contract",
    "Approved",
    "Joint",
    "Keep the audit engine rule-based, versioned, reproducible, and inspectable. Use any language model only for explanation or drafting after the rule result exists.",
    "Review the Milestone 1 findings and approve the next gate.",
    "Operating contract v1.2 and health-rules-v1",
  ],
  [
    "Q-005",
    loggedDate,
    "Clay",
    "What should Clay do in this workflow?",
    "Clay should enrich only bounded records that are promising but missing information needed for a safe decision, such as verified contact details, company attributes, and observable change signals. Clay should not determine CRM health or automatically launch outreach.",
    "Project contract",
    "Approved",
    "Joint",
    "Create explicit enrichment eligibility rules, send only necessary fields, preserve provenance, and return enrichment confidence and timestamps before rescoring.",
    "Define the first enrichment waterfall and acceptable cost per usable record.",
    "Product flow and operating contract v1.2",
  ],
  [
    "Q-006",
    loggedDate,
    "Soft targeting",
    "Should ICP fit be enforced with hard thresholds?",
    "No. A company with 201 employees is not meaningfully different from one with 200. Use firmographic fit as a gradual signal and prioritize people who appear likely to drive change. Reserve hard gates for safety, serviceability, consent, identity, ownership, and approval.",
    "User decision",
    "Approved",
    "User",
    "Use explainable additive scoring and ranked review queues. Do not disqualify an otherwise promising account solely because one firmographic field narrowly misses an ICP boundary.",
    "Tune weights after reviewing ranked examples, not before.",
    "Decision 0001: soft targeting",
  ],
  [
    "Q-007",
    loggedDate,
    "Change propensity",
    "How should a recent role change affect the score?",
    "A recent move into a relevant role should add points because new leaders are often more willing to change vendors and processes. The signal should decay with time, increase with role relevance and seniority, and be discounted when the underlying employment data is uncertain. It should never be a hard qualification rule by itself.",
    "Project contract",
    "Approved",
    "Joint",
    "Store the detected event, event date, source, confidence, relevance, points awarded, and human-readable reason. Make the decay visible in the scoring breakdown.",
    "Approve exact time bands, points, and confidence thresholds after inspecting sample rankings.",
    "Scoring contract v1.1",
  ],
  [
    "Q-008",
    loggedDate,
    "Suppression",
    "Which records must never enter outbound activation?",
    "Suppress opted-out contacts, invalid or unverified identities, existing customers when the play is net-new acquisition, contacts tied to open opportunities, records outside the serviceable territory, and any record without an accountable owner or explicit approval.",
    "Project contract",
    "Approved",
    "Joint",
    "Evaluate hard gates before scoring or channel routing. Show the suppression reason and source evidence, and require a new review if the relevant source data changes.",
    "Confirm the exact customer, opportunity, consent, and serviceability definitions in HubSpot.",
    "Operating contract v1.2 and activation-states-v1",
  ],
  [
    "Q-009",
    loggedDate,
    "Approval",
    "What requires human approval?",
    "Every outbound play should require a person to review the account, contact, rationale, message or call objective, channel, owner, and suppression checks before activation. Approval should apply to a versioned payload so later edits cannot silently inherit it.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Add an approval state with reviewer, timestamp, payload hash or version, channel, and expiration rules. Any material edit returns the play to review.",
    "Confirm who can approve email, phone, and multi-channel plays.",
    "Project discovery conversation",
  ],
  [
    "Q-010",
    loggedDate,
    "Channels",
    "Where do Lemlist and TitanX enter the flow?",
    "After approval, email-ready contacts should move to Lemlist and phone-ready contacts should move to TitanX. Replies, bounces, call attempts, dispositions, meetings, and opt-outs should return to HubSpot and the rep work queue so the team does not have to reconcile outcomes manually.",
    "Project contract",
    "Approved",
    "Joint",
    "Build idempotent channel adapters, write external IDs back to the audit trail, and prevent duplicate enrollments. Normalize channel outcomes before updating HubSpot.",
    "Confirm exact Lemlist and TitanX fields, webhooks, and sandbox capabilities.",
    "Product flow and architecture plan",
  ],
  [
    "Q-011",
    loggedDate,
    "SLA",
    "What does the response SLA mean for Anchorpoint?",
    "An SLA is the team's explicit response-time commitment. For the demo, treat a positive reply or high-intent call outcome as requiring owner action within one business hour, measured only during defined coverage hours.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Create timestamped tasks, assign a clear owner, show time remaining or breach status, and pause the clock outside approved coverage hours.",
    "Confirm the actual response target, business hours, holidays, escalation path, and which dispositions start the clock.",
    "Project discovery conversation",
  ],
  [
    "Q-012",
    loggedDate,
    "Primary view",
    "What should the operator learn from the first screen?",
    "Show me what is blocking safe outbound, what I should fix first, who owns each issue, which plays are waiting for approval, and which high-intent responses are approaching their SLA. I should be able to open the evidence without leaving the application.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Prioritize actionable exception queues over vanity metrics. Each item needs a reason, owner, recommended action, source evidence, and link to the underlying HubSpot record.",
    "Validate the queue order and terminology with the intended operator.",
    "Project discovery conversation",
  ],
  [
    "Q-013",
    loggedDate,
    "Scope",
    "Is this a portfolio dashboard for the PE firm?",
    "No. Build one credible operating-company deployment for Anchorpoint. It can demonstrate how Apero would improve a PE-backed company's revenue operations, but it should not become a lightweight portfolio dashboard or fund-level reporting product.",
    "User decision",
    "Approved",
    "User",
    "Keep workflows, data, permissions, and outcomes centered on a single operating company. Mention PE relevance through repeatable value creation, not through portfolio rollups.",
    "None for the current milestone.",
    "Project scope decision",
  ],
  [
    "Q-014",
    loggedDate,
    "Results loop",
    "How should results appear after a play launches?",
    "Show delivery, replies, calls, dispositions, meetings, opt-outs, and follow-up tasks in the application while writing the normalized outcomes back to HubSpot. The operator should be able to trace every result to the approved play and channel event that produced it.",
    "Project contract",
    "Approved",
    "Joint",
    "Maintain immutable event history, normalized outcome types, source timestamps, external IDs, and links to the originating approval. Use these records for reporting and rep follow-up, not for silent autonomous relaunches.",
    "Define the first outcome taxonomy and HubSpot property mapping.",
    "Architecture plan and activation-states-v1",
  ],
  [
    "Q-015",
    loggedDate,
    "Company and customer history",
    "What can we responsibly infer about Anchorpoint and its customers before constructing the TAM?",
    "Anchorpoint is a fictional private-equity-backed regional fire and life-safety roll-up serving North Carolina, South Carolina, and Georgia. The first motion centers on recurring inspection, testing, maintenance, and repair, with installation and deficiency repair as adjacent work. Customers must be modeled as parent operators with multiple sites, and serviceability depends on branch and technician coverage rather than state alone. The current fixture has eight companies, sixteen contacts, and eight deals, but only one closed-won record and several deliberate contradictions. It tests CRM controls; it is not enough to infer an ICP. A realistic discovery dataset must join CRM history to field-service or billing truth and include won and lost outcomes across 24 to 36 months.",
    "Client role-play",
    "Needs confirmation",
    "Anchorpoint client",
    "Do not calibrate ICP or score weights from the current fixture. Build a historical discovery dataset with parent and site structure, branch coverage, service lines, recurring contract value, deal outcome and dates, source, buyer roles, incumbent vendor, loss reason, and sales cycle. Use that history to define ICP hypotheses before constructing the broader TAM.",
    "Confirm the operating profile, identify the fictional source systems, and approve the size and distributions of the synthetic won-and-lost history.",
    "Operating contract v1.2; inspection-v1 fixture; public Georgia fire and life-safety market analogues",
  ],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Discovery Log");
sheet.showGridLines = false;
sheet.tabColor = "#17324D";

const fontFamily = "Arial";
const navy = "#17324D";
const blue = "#2F6690";
const lightBlue = "#EAF2F8";
const amber = "#FFF2CC";
const amberText = "#7F6000";
const green = "#E2F0D9";
const greenText = "#375623";
const proposed = "#D9EAF7";
const proposedText = "#1F4E78";
const line = "#D9E2F3";
const bodyText = "#1F2937";

sheet.getRange("A2:K2").format.borders = {
  bottom: { style: "medium", color: navy },
};
sheet.getRange("A2").values = [["Anchorpoint discovery log"]];
sheet.getRange("A2").format.font = {
  name: fontFamily,
  size: 14,
  bold: true,
  color: navy,
};

sheet.getRange("A3:K3").merge();
sheet.getRange("A3").values = [[
  "Every client-role-play answer is a fictional assumption until it is confirmed. User decisions and approved project contracts are recorded separately so the build never treats invented client context as fact.",
]];
sheet.getRange("A3:K3").format = {
  font: { name: fontFamily, size: 10, italic: true, color: "#4B5563" },
  wrapText: true,
  verticalAlignment: "center",
};
sheet.getRange("A3:K3").format.rowHeight = 34;

sheet.getRange("A4:K4").format.font = { name: fontFamily, size: 10 };
sheet.getRange("A4").values = [["Questions logged"]];
sheet.getRange("B4").formulas = [["=COUNTA(A8:A207)"]];
sheet.getRange("D4").values = [["Needs confirmation"]];
sheet.getRange("E4").formulas = [["=COUNTIFS(G8:G207,\"Needs confirmation\")"]];
sheet.getRange("G4").values = [["Approved decisions"]];
sheet.getRange("H4").formulas = [["=COUNTIFS(G8:G207,\"Approved\")"]];
sheet.getRange("J4").values = [["Current as of"]];
sheet.getRange("K4").values = [[loggedDate]];
sheet.getRange("K4").format.numberFormat = "mm/dd/yy";

for (const label of ["A4", "D4", "G4", "J4"]) {
  sheet.getRange(label).format = {
    fill: lightBlue,
    font: { name: fontFamily, size: 10, bold: true, color: navy },
    horizontalAlignment: "left",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: line },
  };
}
for (const value of ["B4", "E4", "H4", "K4"]) {
  sheet.getRange(value).format = {
    fill: "#FFFFFF",
    font: { name: fontFamily, size: 10, bold: true, color: bodyText },
    horizontalAlignment: value === "K4" ? "center" : "right",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: line },
  };
}
sheet.getRange("A4:K4").format.rowHeight = 26;

const headers = [[
  "Question ID",
  "Logged date",
  "Topic",
  "Question",
  "Anchorpoint answer",
  "Answer basis",
  "Status",
  "Decision owner",
  "Product consequence",
  "Open follow-up",
  "Source",
]];
sheet.getRange("A7:K7").values = headers;
sheet.getRange("A8:K22").values = entries;

const table = sheet.tables.add("A7:K22", true, "AnchorpointDiscoveryLog");
table.style = "TableStyleMedium2";
table.showBandedColumns = false;
table.showFilterButton = true;

sheet.getRange("A7:K7").format = {
  fill: navy,
  font: { name: fontFamily, size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: {
    insideVertical: { style: "thin", color: "#FFFFFF" },
    bottom: { style: "medium", color: navy },
  },
};
sheet.getRange("A7:K7").format.rowHeight = 34;

sheet.getRange("A8:K207").format.font = {
  name: fontFamily,
  size: 10,
  color: bodyText,
};
sheet.getRange("A8:K22").format.verticalAlignment = "top";
sheet.getRange("A8:K22").format.borders = {
  insideHorizontal: { style: "thin", color: line },
  bottom: { style: "thin", color: line },
};
sheet.getRange("D8:K22").format.wrapText = true;
sheet.getRange("A8:C22").format.verticalAlignment = "center";
sheet.getRange("F8:H22").format.verticalAlignment = "center";
sheet.getRange("A8:A22").format.horizontalAlignment = "center";
sheet.getRange("B8:B22").format.horizontalAlignment = "center";
sheet.getRange("B8:B207").format.numberFormat = "mm/dd/yy";
sheet.getRange("A8:K22").format.rowHeight = 84;
sheet.getRange("A22:K22").format.rowHeight = 132;

sheet.getRange("A8:A207").dataValidation = {
  rule: { type: "custom", formula1: "=OR(A8=\"\",LEFT(A8,2)=\"Q-\")" },
};
sheet.getRange("F8:F207").dataValidation = {
  rule: {
    type: "list",
    values: ["Client role-play", "User decision", "Project contract", "Architecture proposal"],
  },
};
sheet.getRange("G8:G207").dataValidation = {
  rule: { type: "list", values: ["Needs confirmation", "Proposed", "Approved", "Superseded"] },
};
sheet.getRange("H8:H207").dataValidation = {
  rule: { type: "list", values: ["Anchorpoint client", "User", "Joint"] },
};

sheet.getRange("G8:G207").conditionalFormats.add("containsText", {
  text: "Needs confirmation",
  format: { fill: amber, font: { bold: true, color: amberText } },
});
sheet.getRange("G8:G207").conditionalFormats.add("containsText", {
  text: "Approved",
  format: { fill: green, font: { bold: true, color: greenText } },
});
sheet.getRange("G8:G207").conditionalFormats.add("containsText", {
  text: "Proposed",
  format: { fill: proposed, font: { bold: true, color: proposedText } },
});

const widths = {
  A: 12,
  B: 13,
  C: 19,
  D: 34,
  E: 52,
  F: 21,
  G: 21,
  H: 19,
  I: 45,
  J: 38,
  K: 33,
};
for (const [column, width] of Object.entries(widths)) {
  sheet.getRange(`${column}:${column}`).format.columnWidth = width;
}

sheet.freezePanes.freezeRows(7);
sheet.freezePanes.freezeColumns(2);

workbook.recalculate();

const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "Discovery Log!A2:K22",
  include: "values,formulas",
  tableMaxRows: 22,
  tableMaxCols: 11,
  maxChars: 16000,
});
console.log(summaryCheck.ndjson);

const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorCheck.ndjson);

await fs.mkdir(previewDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "Discovery Log",
  range: "A1:K22",
  scale: 1.25,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, previewPath }));
