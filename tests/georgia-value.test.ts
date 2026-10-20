import assert from "node:assert/strict";
import test from "node:test";
import { loadInputs, siteAnnualValue, tierOperators, VALUE_ASSUMPTIONS } from "../scripts/georgia-sample/tier.ts";

// Required tests from docs/decisions/0009-account-value-model.md, run on the committed Georgia sample.
const inputs = await loadInputs();
const baseline = tierOperators(inputs);

test("changing any value input never changes a priority score or band", () => {
  const altered = {
    ...VALUE_ASSUMPTIONS,
    version: "test-altered",
    baseAnnualUsd: 1,
    baseBeds: 7,
    bedExponent: 2.5,
    conditionalFactor: 0,
    fiveYearMultiple: 50,
    bands: { Large: 1, Mid: 0 },
    nearTheJawsMinutes: 0,
  };
  const rerun = tierOperators(inputs, altered);
  const view = (result: typeof baseline) =>
    Object.fromEntries(
      [...result.eligible, ...result.ineligible].map((operator) => [
        operator.operatorId,
        { score: operator.score, band: operator.band, eligible: operator.eligible, explanation: operator.explanation, components: operator.components },
      ]),
    );

  assert.deepEqual(view(rerun), view(baseline));
  assert.notDeepEqual(
    rerun.eligible.map((operator) => operator.value?.fiveYearUsd),
    baseline.eligible.map((operator) => operator.value?.fiveYearUsd),
  );
});

test("a facility outside the sprinkler or alarm footprint contributes zero value", () => {
  assert.equal(siteAnnualValue(250, "not_serviceable", VALUE_ASSUMPTIONS), 0);
  assert.equal(siteAnnualValue(100, "serviceable", VALUE_ASSUMPTIONS), VALUE_ASSUMPTIONS.baseAnnualUsd);
  assert.equal(siteAnnualValue(100, "conditional", VALUE_ASSUMPTIONS), Math.round(VALUE_ASSUMPTIONS.baseAnnualUsd * VALUE_ASSUMPTIONS.conditionalFactor));

  const outsideSites = baseline.eligible.flatMap((operator) => operator.value?.sites ?? []).filter((site) => site.anchorState === "not_serviceable");
  assert.ok(outsideSites.length > 0, "the sample should include operators with out-of-footprint sites");
  for (const site of outsideSites) assert.equal(site.annualUsd, 0, site.ccn);

  for (const operator of baseline.eligible) {
    const inside = operator.value?.sites.filter((site) => site.anchorState !== "not_serviceable") ?? [];
    assert.equal(operator.value?.annualUsd, inside.reduce((sum, site) => sum + site.annualUsd, 0), operator.operatorId);
  }
  for (const operator of baseline.ineligible) assert.equal("value" in operator, false, operator.operatorId);
});

test("a single-site operator's landing value equals its five-year value", () => {
  const singles = baseline.eligible.filter((operator) => operator.value?.sites.length === 1);
  assert.ok(singles.length > 0);
  for (const operator of singles) assert.equal(operator.value?.landingUsd, operator.value?.fiveYearUsd, operator.operatorId);
});

test("every value carries its bed source and the assumptions version", () => {
  for (const operator of baseline.eligible) {
    const value = operator.value;
    assert.ok(value, operator.operatorId);
    assert.equal(value.assumptionsVersion, VALUE_ASSUMPTIONS.version);
    assert.match(value.bedSource, /4pq5-n9py\.number_of_certified_beds/);
    assert.equal(value.nearTheJaws.assumptionsVersion, VALUE_ASSUMPTIONS.version);
    for (const site of value.sites) {
      assert.equal(site.assumptionsVersion, VALUE_ASSUMPTIONS.version, site.ccn);
      assert.match(site.bedSource, /4pq5-n9py\.number_of_certified_beds/, site.ccn);
    }
  }
});
