# Agent Instructions

- Load project context on demand rather than reading orientation files automatically. Read `README.md` when a task needs broad project orientation. Read `STATE.md` only for current status, active implementation, blockers, resumption, or handoff work. After conversation compaction, reread only the files needed to restore missing context, and do not reread unchanged files during the same uninterrupted task.
- Use `docs/README.md` as the documentation router. Open one routed document by default and follow only explicit dependencies needed for the current question; never scan the documentation set broadly.
- Use `STATE.md` only for the current gate, active blockers, and immediate next work. Put durable knowledge in the appropriate `docs/` bin and remove `STATE.md` when no long-running work remains.
- File product scope and plans in `docs/product/`, approved behavioral definitions in `docs/contracts/`, discovery and market work in `docs/research/`, implementation evidence in `docs/milestones/`, and durable rationale in `docs/decisions/`.
- Keep project documentation and Anchorpoint work inside this repository unless the user explicitly broadens scope.
- Do not use tables in project documentation or research deliverables. Prefer concise prose and short lists.
- Preserve the gated milestone order and the read-only, human-approval, deny-first safety boundary. Never treat synthetic fixture data as market evidence.
- When changing an approved rule, contract, fixture release, or milestone status, update its owning document and any direct status pointer in `STATE.md`; do not duplicate the full explanation elsewhere.
- Do not substitute a different database, runtime, hosting service, connector, or other infrastructure component to bypass a blocker in the approved path without explicit user approval. Report the blocker and proposed deviation first; never count substitute-path results as milestone acceptance unless the deviation is approved and documented.
- Separate verified facts from hypotheses in status updates. Do not label a failure a tooling regression, root cause, or resolved issue until reproducible evidence establishes it.
- Keep context and tool output proportional to the decision at hand. Prefer `rg`, targeted line ranges, and summarized command results; do not print whole files, long logs, generated folders, or repeated evidence when a bounded excerpt will answer the question.
- Batch related read-only checks, cap command output, and stop investigating once the next safe action or blocker is established. Run only verification relevant to the changed surface.
- When an external platform, permission, connector, or tooling roadblock prevents the approved next step, stop after bounded verification and tell the user what is blocked and what they need to do. Do not keep retrying, improvise a workaround, or continue into adjacent work unless the user directs it.
- Before handing work to a new chat, update `STATE.md` only when the current gate, blocker, or immediate next action changed. A fresh chat should be able to resume from `README.md`, `STATE.md`, and at most one routed document.
- In chat replies, number each major point 1, 2, 3, restarting at 1 in every reply, so the user can refer to points by number. Do not add a separate index or recap list.
- Keep chat replies short: give results, decisions the user owns, and blockers, never an inventory of what was changed. Do not confirm that a step the user approved happened (a merge, push, commit, or resolved conflict) unless it failed or changed something they must know.
