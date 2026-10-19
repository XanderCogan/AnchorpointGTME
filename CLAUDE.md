@AGENTS.md

# Claude Code notes

`AGENTS.md` above holds the project rules. These lines add what is specific to Claude Code on this machine.

- The dev machine is Windows 11. Prefer PowerShell or npm scripts for commands; use Git Bash only for POSIX-style scripts. Node.js 24+ is required.
- Verification commands are listed in `README.md`. `inspection-v1` must produce exactly 22 findings: 15 critical and 7 warning.
- The deployed stack is Vercel (web) and Railway (API, worker, PostgreSQL 17) with HubSpot-shaped contracts. Salesforce, Supabase, Clay and Lemlist are proposed, not approved or built. Never describe them as current.
- Work on a branch. Commit only when asked, and never push or deploy without explicit approval.

## Research budget

Market and company research follows the GTM-engineering method in `docs/research/tam-construction-plan.md`, not bulk agent scraping.

- Use Claude to design the method: segment definitions, source choices, field schemas, qualification rules and small validation samples.
- Bulk collection belongs in the repeatable pipeline (Clay, public registries, scraping scripts), not in chat web searches.
- Keep any single research task to a handful of targeted searches. Ask before running broad multi-agent or deep-research sweeps.
- Record the source and retrieval date for every external fact.
