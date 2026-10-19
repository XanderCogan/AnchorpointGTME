# Decision 0008: Parallel Historical-Fixture and Market-Sample Tracks

Status: approved on 2026-10-19. Items listed under "Open within this decision" remain open.

Date: 2026-10-19  
Decision owner: User  
AI role: drafted the proposal from the build plan, `STATE.md`, and decisions 0005, 0006, and 0007

## Question

The build plan says each milestone must be reviewed before the next begins. After Milestone 2, the approved next work is the historical fixture generator under decision 0006 and the first Georgia market sample under decision 0007. Both belong to Milestone 4, while Milestone 3, the read-only Salesforce connection, has not started. Must this work wait for Milestone 3, and must the two pieces run one after the other?

## Proposed decision

Two tracks run in parallel. Each track is ordered internally, and both join at a defined point inside Milestone 4.

### Track A: historical fixture, Salesforce org, Milestone 3

1. Build the historical fixture generator under decision 0006 and produce a new, versioned fixture release.
2. Load the release's Salesforce-shaped records into the free Developer Edition org named in decision 0005. The user creates the org.
3. Build Milestone 3 against that org. Its scope and exit gate are unchanged.

Step 2 is environment setup, not product behavior. The loader is a one-off setup tool kept apart from the application's connector, which stays read-only. The org holds only synthetic data.

### Track B: Georgia market sample

Build the first Georgia sample under decision 0007, keeping its $300 cap, stopping rule, source and retrieval-date requirement, and personal data boundary.

### Separation between tracks

- Track A data is synthetic and never counts as market evidence.
- Track B records are real companies and facilities. They carry no fictional Anchorpoint relationships or outcomes until the deliberate join step below.
- The tracks share no fixture files or data tables. If both touch shared code, that code lands in one track at a time.

### Join point

- Drafting ICP hypotheses for user review may start once Track A's historical dataset exists and has been reviewed.
- Applying those hypotheses to real accounts, serviceability evidence on the joined data, Clay enrichment automation, and the Milestone 4 exit gate wait for Milestone 3 acceptance and a completed Track B sample.
- Milestone 4 is still accepted as one milestone.

### Unchanged order

Milestone 5 still follows Milestone 4. Milestones 6 and 7 still follow Milestone 5, because outreach requires the approval gate first. Milestone 8 is still last. This decision does not reorder Milestones 6 and 7.

## Rationale

Milestone 3 needs synthetic data to sync, and the historical fixture is that data, already shaped by decisions 0005 and 0006. Building the fixture first gives Milestone 3 a realistic org instead of a hand-made one. The Georgia sample depends on neither, because it uses public sources and a separate pipeline. Running the two in parallel removes idle time without weakening any review gate, read-only boundary, or approval requirement.

## Consequences

- The build plan's rule that each milestone is reviewed before the next begins gains one stated exception: the early Milestone 4 data work described here.
- `STATE.md` lists both tracks as current work instead of asking which comes first.
- Milestone 3 cannot start until the user creates the Developer Edition org and the first historical release is loaded.

## Open within this decision

- How the fixture is loaded into the org: the Salesforce Data Import Wizard, Data Loader, or a small setup script
- Whether Track A and Track B run in separate Claude Code sessions or in sequence within one

## Required future tests

- The Milestone 3 connector has no create, update, or delete path, and repeated syncs leave every org record unchanged.
- No Track B record carries a fictional outcome, relationship, or Anchorpoint history field before the join step.
- The historical fixture release loaded into the org matches its committed release byte for byte, or by recorded checksum.
