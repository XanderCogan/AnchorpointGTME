CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fixture_releases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  release_name text NOT NULL UNIQUE,
  health_rule_version text NOT NULL,
  audit_as_of timestamptz NOT NULL,
  source jsonb NOT NULL,
  source_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_release_id bigint NOT NULL REFERENCES fixture_releases(id),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  finding_count integer,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE findings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_run_id bigint NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  finding_id text NOT NULL,
  rule_id text NOT NULL,
  rule_version text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'informational')),
  object_type text NOT NULL,
  affected_ids jsonb NOT NULL,
  evidence jsonb NOT NULL,
  proposed_remediation text NOT NULL,
  automation_safety text NOT NULL,
  detected_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_run_id, finding_id)
);

CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_claimable_idx ON jobs (status, available_at, id);
CREATE INDEX findings_rule_idx ON findings (rule_id, severity);
CREATE INDEX audit_runs_release_idx ON audit_runs (fixture_release_id, id DESC);
