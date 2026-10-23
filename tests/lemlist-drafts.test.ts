import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { attachDrafts } from "../packages/connectors/src/lemlist/drafts.ts";
import { planEnrollment, suppressionsFrom } from "../packages/connectors/src/lemlist/enrollment.ts";
import { assertReviewed, DraftNotReviewedError, draftVariables, MAX_WORDS, validateDraft, type DraftFile } from "../packages/core/src/draft-copy.ts";
import { buildFactSheet, collectFacts, loadDraftData, renderFactSheet } from "../packages/core/src/draft-inputs.ts";

// Fact sheets and draft validation on the committed Georgia sample. PruittHealth
// (ga-op-chain-434) runs 65 Georgia nursing homes, 41 inside the footprint.
const data = loadDraftData(resolve(import.meta.dirname, "..", "data", "georgia-sample"));
const sheet = buildFactSheet({ operatorId: "ga-op-chain-434", persona: "Senior-Living Operations Leader", firstName: "Avery", jobTitle: "Vice President of Operations" }, data);

test("every fact on the PruittHealth sheet carries a source", () => {
  const facts = collectFacts(sheet);
  assert.ok(facts.length > 20);
  for (const fact of facts) {
    assert.equal(typeof fact.source, "string");
    assert.ok(fact.source.trim() !== "" && !/^none/i.test(fact.source), JSON.stringify(fact));
  }
  assert.ok(sheet.components.length >= 3 && sheet.components.length <= 5);
  assert.ok(sheet.components.every((c) => c.points > 0));
  assert.ok(!sheet.components.some((c) => c.name === "roleChange" || c.name === "personaAndChannel"));
});

test("no facility outside the footprint appears, and nothing about the person beyond name, title, and persona", () => {
  const tier = data.tiers.operators.find((o: any) => o.operatorId === "ga-op-chain-434");
  const footprint = new Set(tier.value.sites.filter((s: any) => s.anchorState !== "not_serviceable").map((s: any) => s.ccn));
  const outside = new Set(tier.value.sites.filter((s: any) => s.anchorState === "not_serviceable").map((s: any) => s.ccn));
  assert.ok(outside.size > 0);
  assert.ok(sheet.facilities.length > 0 && sheet.facilities.length <= footprint.size);
  for (const facility of sheet.facilities) {
    assert.ok(footprint.has(facility.ccn), facility.ccn);
    assert.ok(!outside.has(facility.ccn), facility.ccn);
    for (const citation of facility.citations) {
      assert.match(citation.tag, /^K-\d{4}$/);
      assert.match(citation.surveyDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(citation.cmsDescription.length > 0);
      assert.ok(!("severity" in citation));
    }
  }
  assert.deepEqual(Object.keys(sheet.contact).sort(), ["firstName", "jobTitle", "persona"]);
  const text = renderFactSheet(sheet);
  assert.ok(!/\b115147\b/.test(text), "CCN 115147 is outside the footprint");
  assert.ok(!/annualUsd|certifiedBeds|severity/i.test(text));
});

const goodDraft = {
  subject: "Sprinkler findings repeating at PruittHealth - Marietta",
  icebreaker: `Hello Avery. The public CMS fire-safety file shows PruittHealth - Marietta cited under K-353, sprinkler inspection, testing, and maintenance, at surveys on 2025-01-16 and 2026-02-26.`,
  hook_fact: "PruittHealth - Marietta (CCN 115276) was cited under K-0353 at the survey on 2026-02-26.",
  body: "I run the Norcross branch of Anchorpoint Fire & Safety, about 36 minutes away. We do NFPA 25 quarterly and annual work and keep records survey-ready. Would a short working session on inspection coverage across your Georgia buildings be useful?\n\n[Rep name]\nAnchorpoint Fire & Safety, Norcross",
};

test("the validator accepts a compliant draft and rejects the rule breaks", () => {
  const ok = validateDraft(goodDraft, sheet);
  assert.deepEqual(ok.problems, []);
  assert.ok(ok.ok && ok.words < MAX_WORDS);

  const long = { ...goodDraft, body: `${goodDraft.body} ${"word ".repeat(MAX_WORDS)}` };
  assert.ok(validateDraft(long, sheet).problems.some((p) => p.includes("words")));

  assert.ok(validateDraft({ subject: "x", icebreaker: "y", body: "z" }, sheet).problems[0]?.includes("missing"));
  assert.ok(validateDraft({ ...goodDraft, body: "Act now, this is urgent." }, sheet).problems.some((p) => p.includes("urgency")));
  assert.ok(validateDraft({ ...goodDraft, body: "Our price is $400 a visit." }, sheet).problems.some((p) => p.includes("pricing")));
  assert.ok(validateDraft({ ...goodDraft, subject: "Deficiency at Marietta" }, sheet).problems.some((p) => p.includes("deficiency")));
  assert.ok(validateDraft({ ...goodDraft, hook_fact: "PruittHealth - Marietta was cited under K-0353 on 2019-01-01." }, sheet).problems.some((p) => p.includes("not a survey date")));
  assert.ok(validateDraft({ ...goodDraft, hook_fact: "Somewhere Else was cited under K-0353 on 2026-02-26." }, sheet).problems.some((p) => p.includes("names no facility")));
  assert.ok(validateDraft({ ...goodDraft, body: "Fine — but with an em dash." }, sheet).problems.some((p) => p.includes("em dash")));
});

const draftFile = (review: Partial<Pick<DraftFile, "reviewedBy" | "reviewedOn">> = {}): DraftFile => ({
  contactKey: "practice-008",
  operatorId: "ga-op-chain-434",
  persona: "Senior-Living Operations Leader",
  generatedOn: "2026-10-22T20:00:00Z",
  model: "claude-opus-5-5",
  factSheet: sheet,
  draft: goodDraft,
  reviewedBy: null,
  reviewedOn: null,
  ...review,
});

test("enrollment refuses a draft without review fields and carries a reviewed one as variables", () => {
  assert.throws(() => assertReviewed(draftFile()), DraftNotReviewedError);
  assert.throws(() => draftVariables(draftFile({ reviewedBy: "manager-1", reviewedOn: "" })), DraftNotReviewedError);
  assert.throws(() => draftVariables(draftFile({ reviewedBy: "   ", reviewedOn: "2026-10-22" })), DraftNotReviewedError);

  const plan = planEnrollment({
    campaignId: "cam_practice",
    candidates: [
      { contactKey: "practice-008", email: "avery.lane@practice-contact.example.com", firstName: "Avery", approval: { approvedBy: "manager-1", approvedAt: "2026-10-22T19:00:00Z" } },
      { contactKey: "practice-001", email: "dana.whitfield@peachtree-living.example.com", approval: { approvedBy: "rep-1", approvedAt: "2026-10-22T14:00:00Z" } },
      { contactKey: "practice-003", email: "priya.raman@oconee-care.example.com", approval: null },
    ],
    suppressions: suppressionsFrom([]),
    activeKeys: new Set(),
    killSwitchEngaged: false,
  });

  const unreviewed = attachDrafts(plan, (key) => (key === "practice-008" ? draftFile() : null));
  assert.deepEqual(unreviewed[0], { contactKey: "practice-008", action: "skip", reason: "draft_not_reviewed" });
  assert.equal(unreviewed[1]?.action, "enroll");
  assert.deepEqual(unreviewed[2], { contactKey: "practice-003", action: "skip", reason: "not_approved" });

  const reviewed = attachDrafts(plan, (key) => (key === "practice-008" ? draftFile({ reviewedBy: "manager-1", reviewedOn: "2026-10-22" }) : null));
  const lead = reviewed[0];
  assert.equal(lead?.action, "enroll");
  if (lead?.action !== "enroll") return;
  assert.deepEqual(lead.lead.variables, {
    anchorpointContactKey: "practice-008",
    subject: goodDraft.subject,
    icebreaker: goodDraft.icebreaker,
    hook_fact: goodDraft.hook_fact,
    body: goodDraft.body,
    draftReviewedBy: "manager-1",
    draftReviewedOn: "2026-10-22",
  });
  // Decision 0017: a draft for an operator outside band A carries without review marks.
  const bandC = draftFile();
  bandC.factSheet = { ...sheet, operator: { ...sheet.operator, band: "C" } };
  const unreviewedC = attachDrafts(plan, (key) => (key === "practice-008" ? bandC : null));
  assert.equal(unreviewedC[0]?.action, "enroll");
  if (unreviewedC[0]?.action === "enroll") {
    assert.equal(unreviewedC[0].lead.variables.subject, goodDraft.subject);
    assert.equal("draftReviewedBy" in unreviewedC[0].lead.variables, false);
  }

  // A contact with no draft file enrolls exactly as planned.
  assert.deepEqual(reviewed[1], plan[1]);
});
