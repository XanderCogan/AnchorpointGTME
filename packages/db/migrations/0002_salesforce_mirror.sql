-- Read-only Salesforce mirror (Milestone 3). Rows are written only from
-- Salesforce query results; nothing here is sent back to Salesforce.

CREATE TABLE salesforce_records (
  connection_id text NOT NULL,
  object_type text NOT NULL,
  record_id text NOT NULL CHECK (length(record_id) = 18),
  created_date timestamptz NOT NULL,
  last_modified_date timestamptz NOT NULL,
  system_modstamp timestamptz NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  first_synced_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, object_type, record_id)
);

CREATE TABLE salesforce_sync_watermarks (
  connection_id text NOT NULL,
  object_type text NOT NULL,
  watermark timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, object_type)
);

CREATE TABLE salesforce_sync_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connection_id text NOT NULL,
  object_type text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  pages integer NOT NULL,
  records_seen integer NOT NULL,
  records_inserted integer NOT NULL,
  records_updated integer NOT NULL,
  records_unchanged integer NOT NULL,
  records_stale integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX salesforce_records_modstamp_idx
  ON salesforce_records (connection_id, object_type, system_modstamp);
CREATE INDEX salesforce_sync_runs_connection_idx
  ON salesforce_sync_runs (connection_id, object_type, id DESC);
