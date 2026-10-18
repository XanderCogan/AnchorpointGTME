"use client";

import { useMemo, useState } from "react";
import type { FindingView } from "../../../packages/core/src/presentation.ts";
import type { ObjectType, Severity } from "../../../packages/core/src/types.ts";

type Filter = "all" | Severity | "unassigned" | "manual-only";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All issues" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warnings" },
  { value: "unassigned", label: "Unassigned" },
  { value: "manual-only", label: "Manual fixes" },
];

function labelObjectType(value: ObjectType): string {
  return value.replaceAll("_", " ");
}

function prettyEvidence(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key.replaceAll(/([A-Z])/g, " $1").toLowerCase()}: ${Array.isArray(item) ? item.join(", ") : String(item)}`)
    .join(" · ");
}

export function FindingsBoard({ findings }: { findings: FindingView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return findings.filter((finding) => {
      const filterMatches =
        filter === "all" ||
        finding.severity === filter ||
        (filter === "unassigned" && finding.ownerName === "Unassigned") ||
        (filter === "manual-only" && finding.automationSafety === "manual-only");
      if (!filterMatches) return false;
      if (!normalizedQuery) return true;
      return [finding.title, finding.ruleId, finding.ownerName, ...finding.recordNames]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, findings, query]);

  return (
    <section className="worklist" aria-labelledby="worklist-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Ranked work queue</p>
          <h2 id="worklist-title">CRM health findings</h2>
        </div>
        <label className="search">
          <span className="sr-only">Search findings</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search records or rules"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="filter-row" aria-label="Filter findings">
        {filters.map((item) => (
          <button
            className={filter === item.value ? "selected" : ""}
            key={item.value}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
            <span>
              {item.value === "all"
                ? findings.length
                : findings.filter((finding) =>
                    item.value === "unassigned"
                      ? finding.ownerName === "Unassigned"
                      : item.value === "manual-only"
                        ? finding.automationSafety === "manual-only"
                        : finding.severity === item.value,
                  ).length}
            </span>
          </button>
        ))}
      </div>

      <div className="list-header" aria-hidden="true">
        <span>Issue and record</span>
        <span>Severity</span>
        <span>Owner</span>
        <span>Action boundary</span>
      </div>

      <div className="finding-list">
        {visible.map((finding) => (
          <details className="finding" key={finding.findingId}>
            <summary>
              <div className="finding-main">
                <span className={`severity-dot ${finding.severity}`} aria-hidden="true" />
                <div>
                  <strong>{finding.title}</strong>
                  <p>{finding.recordNames.join(" + ")} · {labelObjectType(finding.objectType)}</p>
                </div>
              </div>
              <span className={`severity-pill ${finding.severity}`}>{finding.severity}</span>
              <span className={finding.ownerName === "Unassigned" ? "owner unassigned" : "owner"}>
                {finding.ownerName}
              </span>
              <span className="safety">{finding.automationSafety.replaceAll("-", " ")}</span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="finding-detail">
              <div>
                <span className="detail-label">Evidence</span>
                <p>{prettyEvidence(finding.evidence)}</p>
              </div>
              <div>
                <span className="detail-label">Recommended next action</span>
                <p>{finding.proposedRemediation}</p>
              </div>
              <div className="detail-meta">
                <span>{finding.ruleId}</span>
                <span>{finding.ruleVersion}</span>
                <span>{finding.findingId}</span>
              </div>
            </div>
          </details>
        ))}
        {visible.length === 0 ? (
          <div className="empty-state">
            <strong>No findings match this view.</strong>
            <p>Change the filter or clear the search.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
