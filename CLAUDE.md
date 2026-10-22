@AGENTS.md

# Claude Code notes

`AGENTS.md` above holds the project rules. These lines add what is specific to Claude Code on this machine.

- The dev machine is Windows 11. Prefer PowerShell or npm scripts for commands; use Git Bash only for POSIX-style scripts. Node.js 24+ is required.
- Verification commands are listed in `README.md`. `inspection-v1` must produce exactly 22 findings: 15 critical and 7 warning.
- The deployed stack is Vercel (web) and Railway (API, worker, PostgreSQL 17). Attio is the approved CRM for all new work (decision 0011, superseding Salesforce under 0005); only the frozen `inspection-v1` fixture and the Milestone 2 findings board are HubSpot-shaped. Do not build new work against HubSpot or Salesforce; the Salesforce connector code is superseded reference only. Supabase is not part of the plan. What each integration does today is recorded only in the "Integration status" section of `STATE.md`; read it before describing any connector, and never describe unbuilt connectors as current.
- No fictional CRM history exists or will be generated (decision 0010). The market is real and sourced, assumptions about Anchorpoint are labelled, and synthetic fixtures are test inputs only. Track A is cancelled.
- Work on a branch. Commit only when asked, and never push or deploy without explicit approval.

## Research budget

Market and company research follows the GTM-engineering method in `docs/research/tam-construction-plan.md`, not bulk agent scraping.

- Use Claude to design the method: segment definitions, source choices, field schemas, qualification rules and small validation samples.
- Bulk collection belongs in the repeatable pipeline (Clay, public registries, scraping scripts), not in chat web searches.
- Keep any single research task to a handful of targeted searches. Ask before running broad multi-agent or deep-research sweeps.
- Record the source and retrieval date for every external fact.
