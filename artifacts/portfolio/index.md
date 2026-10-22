# Portfolio bundle

Generated 2026-10-22T19:39:17.212Z by `npm run portfolio:bundle` (scripts/build-portfolio-bundle.ts). Every file carries a generatedAt stamp and the path it was read from. Nothing here calls an API or a database; the script only reads files already in the repository.

- tiers.json: copy of data/georgia-sample/tiers.json, the 105 Georgia operators scored and banded under account-score-v1.1 with tiering proposal 2 parameters, wrapped with generatedAt and source.
- serviceability.json: copy of data/georgia-sample/serviceability.json, OSRM drive times from each facility to the nearest branch per service line and the resulting footprint state.
- people-coverage.json: copy of data/georgia-sample/people-coverage.json, which Clay role slots were searched for each footprint operator and site, with counts only and no names.
- signals.json: copy of data/georgia-sample/signals.json, CMS fire safety citations mapped to service lines plus ownership and management change flags, per operator and per facility.
- tier-summary.json: counts per band, eligibility gate counts, and the top five A-band operators with score and explanation, computed from tiers.json.
- lineage-tift-regional.json: one end-to-end trace for TIFT REGIONAL HEALTH SYSTEM INC (trading as Southwell). Each step names the file it was read from: the source manifest and raw CMS rows, operator resolution and facility links, serviceability, signals, the tier record, people coverage, the Clay input and export rows, the import plan recomputed with the same mapping code, and the Attio Company record ID. The notFound list states what no file could supply.

Privacy: the raw CMS rows and the Clay CSVs are gitignored private inputs. Under the personal data boundary in docs/research/georgia-clay-people-pass.md the trace holds no person name, title, profile link, employer string, start date, email, or phone number; people appear as a role slot and persona status only, and individual CMS owners are withheld.
